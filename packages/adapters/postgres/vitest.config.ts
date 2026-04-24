import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    // Postgres container startup + image-pull on first run can exceed the
    // vitest default 5s hook timeout. 120s ceiling is generous for the pull
    // (first run) and conservative for the start (subsequent runs typically
    // spin in 2-5s after the image is cached).
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Serialize test files to a single worker so matrix containers
    // (postgres:15 + postgres:16) don't contend for Docker daemon bandwidth
    // or exhaust per-test container quotas. Intra-file parallelism is
    // unaffected; vitest still runs tests within a file serially by default.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
