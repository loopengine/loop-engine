// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Better Data, Inc.

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  format: ["esm", "cjs"],
  splitting: false,
  treeshake: true,
  external: [
    "@loop-engine/auth-iface",
    "@loop-engine/entitlements-iface",
    "@loop-engine/observability",
    "@loop-engine/runtime-db",
    "@loop-engine/core",
  ],
  loader: {
    ".json": "json",
  },
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
});
