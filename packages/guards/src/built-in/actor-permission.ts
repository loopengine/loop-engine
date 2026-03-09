// @license MIT
// SPDX-License-Identifier: MIT
import type { GuardFunction } from "../types";

export const actorPermissionGuard: GuardFunction = async (context) => {
  const requiredRole = context.evidence.required_role;
  const roles = context.evidence.roles;
  if (typeof requiredRole !== "string") {
    return { passed: true };
  }
  if (!Array.isArray(roles)) {
    return { passed: false, message: "Missing actor roles in evidence" };
  }
  const hasRole = roles.includes(requiredRole);
  return {
    passed: hasRole,
    ...(hasRole ? {} : { message: `Actor missing required role: ${requiredRole}` })
  };
};
