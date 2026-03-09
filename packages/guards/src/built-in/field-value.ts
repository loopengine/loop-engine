// @license MIT
// SPDX-License-Identifier: MIT
import type { GuardFunction } from "../types";

type Constraint = {
  field: string;
  operator: "eq" | "gt" | "lt" | "in";
  value: unknown;
};

export const fieldValueConstraintGuard: GuardFunction = async (context) => {
  const constraint = context.evidence.constraint as Constraint | undefined;
  if (!constraint) {
    return { passed: true };
  }
  const actual = context.evidence[constraint.field];
  let passed = true;
  switch (constraint.operator) {
    case "eq":
      passed = actual === constraint.value;
      break;
    case "gt":
      passed = typeof actual === "number" && typeof constraint.value === "number" && actual > constraint.value;
      break;
    case "lt":
      passed = typeof actual === "number" && typeof constraint.value === "number" && actual < constraint.value;
      break;
    case "in":
      passed = Array.isArray(constraint.value) && constraint.value.includes(actual);
      break;
  }
  return {
    passed,
    ...(passed ? {} : { message: `Field constraint failed for ${constraint.field}` })
  };
};
