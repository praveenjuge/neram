/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as agent from "../agent.js";
import type * as clerkWebhook from "../clerkWebhook.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as model from "../model.js";
import type * as organizationActions from "../organizationActions.js";
import type * as organizationJobs from "../organizationJobs.js";
import type * as organizations from "../organizations.js";
import type * as projects from "../projects.js";
import type * as sprintModel from "../sprintModel.js";
import type * as sprintRollover from "../sprintRollover.js";
import type * as sprintTime from "../sprintTime.js";
import type * as sprints from "../sprints.js";
import type * as subtasks from "../subtasks.js";
import type * as taskComments from "../taskComments.js";
import type * as taskModel from "../taskModel.js";
import type * as tasks from "../tasks.js";
import type * as tenancyMigration from "../tenancyMigration.js";
import type * as tenancyMigrationData from "../tenancyMigrationData.js";
import type * as tenancyMigrationModel from "../tenancyMigrationModel.js";
import type * as tenancyMigrationReads from "../tenancyMigrationReads.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  agent: typeof agent;
  clerkWebhook: typeof clerkWebhook;
  crons: typeof crons;
  http: typeof http;
  invites: typeof invites;
  members: typeof members;
  migrations: typeof migrations;
  model: typeof model;
  organizationActions: typeof organizationActions;
  organizationJobs: typeof organizationJobs;
  organizations: typeof organizations;
  projects: typeof projects;
  sprintModel: typeof sprintModel;
  sprintRollover: typeof sprintRollover;
  sprintTime: typeof sprintTime;
  sprints: typeof sprints;
  subtasks: typeof subtasks;
  taskComments: typeof taskComments;
  taskModel: typeof taskModel;
  tasks: typeof tasks;
  tenancyMigration: typeof tenancyMigration;
  tenancyMigrationData: typeof tenancyMigrationData;
  tenancyMigrationModel: typeof tenancyMigrationModel;
  tenancyMigrationReads: typeof tenancyMigrationReads;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
