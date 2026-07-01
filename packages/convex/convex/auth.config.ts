declare const process: {
  env: {
    CLERK_FRONTEND_API_URL?: string
    NERAM_CLERK_OAUTH_CLIENT_ID?: string
  }
}

const providers = [
  {
    domain: process.env.CLERK_FRONTEND_API_URL,
    applicationID: "convex",
  },
]

if (process.env.NERAM_CLERK_OAUTH_CLIENT_ID) {
  providers.push({
    domain: process.env.CLERK_FRONTEND_API_URL,
    applicationID: process.env.NERAM_CLERK_OAUTH_CLIENT_ID,
  })
}

export default {
  providers,
}
