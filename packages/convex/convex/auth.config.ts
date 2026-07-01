declare const process: {
  env: {
    CLERK_FRONTEND_API_URL?: string
  }
}

export default {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL,
      applicationID: "convex",
    },
  ],
}
