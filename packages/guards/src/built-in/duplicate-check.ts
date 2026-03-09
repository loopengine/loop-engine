// @license MIT
// SPDX-License-Identifier: MIT
import type { GuardFunction } from "../types";

export const duplicateCheckPassedGuard: GuardFunction = async (context) => {
  const passed = context.evidence.duplicate_found !== true;
  return {
    passed,
    ...(passed ? {} : { message: "Duplicate detected" })
  };
};
