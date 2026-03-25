import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    betterdata: "src/adapters/betterdata.ts"
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist"
});
