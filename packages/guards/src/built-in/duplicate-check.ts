// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { GuardFunction } from "../types";

export const duplicateCheckPassedGuard: GuardFunction = async (context) => {
  const passed = context.evidence.duplicate_found !== true;
  return {
    passed,
    ...(passed ? {} : { message: "Duplicate detected" })
  };
};
