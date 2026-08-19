import { connection } from "next/server"

export async function DynamicMarker() {
  await connection()
  return null
}
