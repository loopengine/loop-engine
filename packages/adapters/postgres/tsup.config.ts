import { cp, mkdir } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  // shims: true provides __dirname / __filename in ESM output and
  // import.meta.url in CJS output. The migration runner uses
  // __dirname + "sql" to locate the migration SQL files at runtime in
  // both module formats; without the shim, the ESM build would fail at
  // runtime with "__dirname is not defined" once a consumer triggers
  // `runMigrations`.
  shims: true,
  async onSuccess() {
    // The migration runner reads `*.sql` files from a `sql` subdirectory
    // next to the compiled entry point. Tsup does not copy non-code
    // assets; this hook mirrors `src/migrations/sql/` into
    // `dist/migrations/sql/` so the shipped package can locate migrations
    // at runtime.
    await mkdir("dist/migrations/sql", { recursive: true });
    await cp("src/migrations/sql", "dist/migrations/sql", { recursive: true });
  }
});
