// @license MIT
// SPDX-License-Identifier: MIT
import type { GuardFunction } from "../types";

export const deadlineNotExceededGuard: GuardFunction = async (context) => {
  const deadlineIso = context.evidence.deadline_iso;
  if (typeof deadlineIso !== "string") {
    return { passed: true };
  }
  const deadline = Date.parse(deadlineIso);
  if (Number.isNaN(deadline)) {
    return { passed: false, message: "Invalid deadline format" };
  }
  const passed = Date.now() < deadline;
  return {
    passed,
    ...(passed ? {} : { message: "Deadline exceeded" })
  };
};
