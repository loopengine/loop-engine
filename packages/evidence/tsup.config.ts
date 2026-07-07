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
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
});
