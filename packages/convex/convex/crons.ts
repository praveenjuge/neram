import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
  "repair interrupted Sprint rollovers",
  { minutes: 5 },
  internal.sprintRollover.repair
)

export default crons
