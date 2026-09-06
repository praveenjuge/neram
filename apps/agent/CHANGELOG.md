# Changelog

All notable changes to the `neram` CLI/MCP package. Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow SemVer.

## [0.3.0]

MCP 2026-07-28 alignment plus review follow-ups.

### Added

- MCP resources (`neram://workspace/status`, `neram://sprint/current`, `neram://projects`, `neram://brief/daily`) and resource templates (`neram://project/{id}`, `neram://task/{id}`).
- MCP prompts: `plan-sprint`, `daily-standup`, `project-retro`, `triage-capture`.
- Stable output schemas on registered tools.
- `neram mcp serve` (loopback-only local Streamable HTTP for Inspector testing) and `neram mcp list` (tools, resources, resource templates, prompts without a client).
- `neram mcp install --write [--merge]` writes the stdio snippet into a client config file (print-only by default).
- `Mcp-Method`/`Mcp-Name` routing-header validation against the JSON-RPC body, with per-id error envelopes for batches.
- RFC 9728 protected-resource metadata at `/.well-known/oauth-protected-resource`; `401` challenges carry `WWW-Authenticate` with `resource_metadata`.
- `scripts/live-hosted-handshake.mjs`: authenticated hosted smoke test (skips cleanly without `NERAM_ID_TOKEN`).

### Fixed

- `neram mcp` completes the stdio handshake even when unauthenticated; the first tool call returns `UNAUTHENTICATED` as an `isError` result instead of the server exiting.
- `mcp list` now includes resource templates (`neram://project/{id}`, `neram://task/{id}`).
- `writeMcpInstall` resolves parent directories with `dirname` (plus backslash normalization), so nested and Windows-style config paths get their parent created instead of receiving the full file path.
- `mcp install --write` refuses to overwrite malformed or unreadable configs instead of silently replacing them.

### Changed

- Minor release bump: 0.2.1 → 0.3.0 (new MCP surface: resources, prompts, `serve`/`list`/`--write`).
