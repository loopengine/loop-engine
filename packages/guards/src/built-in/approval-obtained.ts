// @license MIT
// SPDX-License-Identifier: MIT
import type { GuardFunction } from "../types";

export const approvalObtainedGuard: GuardFunction = async (context) => {
  const passed = context.evidence.approved === true;
  return {
    passed,
    ...(passed ? {} : { message: "Approval not obtained" })
  };
};
