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
import type * as invites from "../invites.js";
import type * as members from "../members.js";
import type * as model from "../model.js";
import type * as projects from "../projects.js";
import type * as subtasks from "../subtasks.js";
import type * as taskComments from "../taskComments.js";
import type * as taskModel from "../taskModel.js";
import type * as tasks from "../tasks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  agent: typeof agent;
  invites: typeof invites;
  members: typeof members;
  model: typeof model;
  projects: typeof projects;
  subtasks: typeof subtasks;
  taskComments: typeof taskComments;
  taskModel: typeof taskModel;
  tasks: typeof tasks;
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

export declare const components: {};
