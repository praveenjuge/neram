import { JoinClient } from "@/app/join/[token]/join-client"

export const metadata = {
  title: "Join Project",
}

export const instant = false

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <JoinClient token={token} />
}
