import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http"
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { Entry } from "@napi-rs/keyring"
import open from "open"
import * as z from "zod/v3"

import { AgentError, createConvexApi, type NeramApi } from "./agent.js"
import type { RevocationResult } from "./format.js"

const appDir = join(homedir(), ".config", "neram")
const credentialsFile = join(appDir, "credentials.json")
const configFile = join(appDir, "config.json")
const service = "neram"
const account = "default"
const defaultConfigUrl = "https://neram.praveenjuge.com/.well-known/neram-agent.json"
// Refresh a little ahead of the hard expiry so an in-flight request never races
// the token going stale. Shared by refresh() and the per-request provider.
const REFRESH_WINDOW_MS = 90_000

const publicConfigSchema = z.object({
  convexUrl: z.string().url(),
  clerkFrontendApiUrl: z.string().url(),
  oauthClientId: z.string().min(1),
})
type PublicConfig = z.infer<typeof publicConfigSchema>
type Session = {
  idToken: string
  accessToken?: string
  refreshToken?: string
  expiresAt: number
  config: PublicConfig
}

function b64url(bytes: Buffer) {
  return bytes.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

async function ensureDir() {
  await mkdir(appDir, { recursive: true, mode: 0o700 })
}

async function readConfig() {
  try {
    return publicConfigSchema.parse(JSON.parse(await readFile(configFile, "utf8")))
  } catch {
    return null
  }
}

function definedConfig(config: Partial<PublicConfig>) {
  return Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined))
}

export async function loadPublicConfig(overrides: Partial<PublicConfig> = {}) {
  const env = {
    convexUrl: process.env.NERAM_CONVEX_URL,
    clerkFrontendApiUrl: process.env.NERAM_CLERK_FRONTEND_API_URL ?? process.env.CLERK_FRONTEND_API_URL,
    oauthClientId: process.env.NERAM_CLERK_OAUTH_CLIENT_ID,
  }
  const local = await readConfig()
  const merged = { ...local, ...definedConfig(env), ...definedConfig(overrides) }
  const parsed = publicConfigSchema.safeParse(merged)
  if (parsed.success) return parsed.data

  const url = process.env.NERAM_AGENT_CONFIG_URL ?? defaultConfigUrl
  const res = await fetch(url)
  if (!res.ok) throw new AgentError("MISSING_CONFIG", `Unable to load Neram agent config from ${url}.`)
  return publicConfigSchema.parse(await res.json())
}

async function writeConfig(config: PublicConfig) {
  await ensureDir()
  await writeFile(configFile, JSON.stringify(config, null, 2), { mode: 0o600 })
  await chmod(configFile, 0o600)
}

async function readSession() {
  try {
    const value = new Entry(service, account).getPassword()
    if (value) return JSON.parse(value) as Session
  } catch {
    // Fall back to the chmod-600 file below.
  }
  try {
    return JSON.parse(await readFile(credentialsFile, "utf8")) as Session
  } catch {
    return null
  }
}

async function writeSession(session: Session) {
  try {
    new Entry(service, account).setPassword(JSON.stringify(session))
    await rm(credentialsFile, { force: true })
    return
  } catch {
    await ensureDir()
    await writeFile(credentialsFile, JSON.stringify(session), { mode: 0o600 })
    await chmod(credentialsFile, 0o600)
  }
}

export async function clearSession() {
  try {
    new Entry(service, account).deletePassword()
  } catch {
    // File fallback cleanup still runs.
  }
  await rm(credentialsFile, { force: true })
}

async function discovery(issuer: string) {
  const res = await fetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`)
  if (!res.ok) throw new AgentError("MISSING_CONFIG", "Unable to load Clerk OIDC discovery metadata.")
  return z.object({
    authorization_endpoint: z.string().url(),
    token_endpoint: z.string().url(),
    revocation_endpoint: z.string().url().optional(),
  }).parse(await res.json())
}

async function exchange(tokenEndpoint: string, body: URLSearchParams, config: PublicConfig) {
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) throw new AgentError("AUTH_FAILED", `Clerk token exchange failed with HTTP ${res.status}.`)
  const token = z.object({
    id_token: z.string(),
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    expires_in: z.number().default(3600),
  }).parse(await res.json())
  return {
    idToken: token.id_token,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    config,
  } satisfies Session
}

export async function login(overrides: Partial<PublicConfig> = {}) {
  const config = await loadPublicConfig(overrides)
  const meta = await discovery(config.clerkFrontendApiUrl)
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash("sha256").update(verifier).digest())
  const state = b64url(randomBytes(24))
  let redirectUri = ""
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      if (url.pathname !== "/callback") {
        res.writeHead(404).end()
        return
      }
      if (url.searchParams.get("state") !== state) {
        res.writeHead(400).end("Invalid state")
        reject(new AgentError("AUTH_FAILED", "OAuth state did not match."))
        server.close()
        return
      }
      const received = url.searchParams.get("code")
      if (!received) {
        res.writeHead(400).end("Missing code")
        reject(new AgentError("AUTH_FAILED", "OAuth callback did not include a code."))
        server.close()
        return
      }
      res.writeHead(200, { "content-type": "text/plain" }).end("Neram CLI login complete. You can close this tab.")
      resolve(received)
      server.close()
    })
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") return reject(new AgentError("AUTH_FAILED", "Unable to bind callback port."))
      redirectUri = `http://127.0.0.1:${address.port}/callback`
      const authUrl = new URL(meta.authorization_endpoint)
      authUrl.search = new URLSearchParams({
        response_type: "code",
        client_id: config.oauthClientId,
        redirect_uri: redirectUri,
        scope: "openid profile email offline_access",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }).toString()
      void open(authUrl.toString()).catch(() => undefined)
      console.error(`Open this URL to sign in:\n${authUrl.toString()}`)
    })
  })
  const session = await exchange(meta.token_endpoint, new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.oauthClientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  }), config)
  await writeConfig(config)
  await writeSession(session)
  return { user: claims(session.idToken), config }
}

async function refresh(session: Session) {
  if (session.expiresAt - Date.now() > REFRESH_WINDOW_MS || !session.refreshToken) return session
  const meta = await discovery(session.config.clerkFrontendApiUrl)
  const next = await exchange(meta.token_endpoint, new URLSearchParams({
    grant_type: "refresh_token",
    client_id: session.config.oauthClientId,
    refresh_token: session.refreshToken,
  }), session.config)
  await writeSession(next)
  return next
}

export async function authClient(): Promise<{ client: NeramApi; session: Session }> {
  const stored = await readSession()
  if (!stored) throw new AgentError("UNAUTHENTICATED", "Run `neram login` first.")
  const session = await refresh(stored)
  // Cache the session in the closure so the hot path (token still comfortably
  // valid) returns synchronously without touching disk, keyring, or the
  // network. Only when the token nears expiry do we re-read the latest stored
  // session (another process may have already refreshed it) and refresh. This
  // keeps a one-shot CLI call cheap and lets the long-lived MCP process survive
  // token expiry for as long as a refresh token exists. When no refresh token
  // is available the stale token surfaces the usual UNAUTHENTICATED error.
  let current = session
  const provider = async () => {
    if (current.expiresAt - Date.now() > REFRESH_WINDOW_MS) return current.idToken
    const latest = await readSession()
    if (!latest) throw new AgentError("UNAUTHENTICATED", "Run `neram login` first.")
    current = await refresh(latest)
    return current.idToken
  }
  return { client: createConvexApi(session.config.convexUrl, provider), session }
}

export async function logout(): Promise<{
  revocation: RevocationResult
  configRetained: boolean
}> {
  const session = await readSession()
  // Best-effort refresh-token revocation. "skipped" when there's nothing to
  // revoke, "failed" (non-fatal) when the provider rejects or the request
  // throws. Either way, local credentials are always cleared below.
  let revocation: RevocationResult = "skipped"
  if (session?.refreshToken) {
    try {
      const meta = await discovery(session.config.clerkFrontendApiUrl)
      if (meta.revocation_endpoint) {
        const res = await fetch(meta.revocation_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: session.refreshToken, client_id: session.config.oauthClientId }),
        })
        revocation = res.ok ? "succeeded" : "failed"
      }
    } catch {
      // Local logout should still clear credentials.
      revocation = "failed"
    }
  }
  await clearSession()
  // Cached public config (config.json) is intentionally kept for the next login.
  return { revocation, configRetained: true }
}

export function claims(idToken: string) {
  const [, payload] = idToken.split(".")
  if (!payload) throw new AgentError("AUTH_FAILED", "Invalid id_token.")
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>
}
