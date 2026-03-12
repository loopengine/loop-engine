// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import { guardId } from "@loop-engine/core";
import { approvalObtainedGuard } from "./built-in/approval-obtained";
import { actorPermissionGuard } from "./built-in/actor-permission";
import { deadlineNotExceededGuard } from "./built-in/deadline";
import { duplicateCheckPassedGuard } from "./built-in/duplicate-check";
import { fieldValueConstraintGuard } from "./built-in/field-value";
import { GuardRegistry, createGuardRegistry } from "./types";

export * from "./types";
export {
  approvalObtainedGuard,
  actorPermissionGuard,
  deadlineNotExceededGuard,
  duplicateCheckPassedGuard,
  fieldValueConstraintGuard
};

export const defaultRegistry = (() => {
  const registry = new GuardRegistry();
  registry.register(guardId("actor_has_permission"), actorPermissionGuard);
  registry.register(guardId("approval_obtained"), approvalObtainedGuard);
  registry.register(guardId("deadline_not_exceeded"), deadlineNotExceededGuard);
  registry.register(guardId("duplicate_check_passed"), duplicateCheckPassedGuard);
  registry.register(guardId("field_value_constraint"), fieldValueConstraintGuard);
  return registry;
})();

export { createGuardRegistry };
