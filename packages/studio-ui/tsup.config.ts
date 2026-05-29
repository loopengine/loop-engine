import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: {
    compilerOptions: {
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
    },
  },
  sourcemap: true,
  clean: true,
  outDir: "dist",
  splitting: false,
  treeshake: true,
  external: ["react", "react-dom", "@loop-engine/observability"],
  injectStyle: true,
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
});
