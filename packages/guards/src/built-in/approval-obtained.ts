// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0
import type { GuardFunction } from "../types";

export const approvalObtainedGuard: GuardFunction = async (context) => {
  const passed = context.evidence.approved === true;
  return {
    passed,
    ...(passed ? {} : { message: "Approval not obtained" })
  };
};
