// @license Apache-2.0
// SPDX-License-Identifier: Apache-2.0

/**
 * Testcontainers helper for `@loop-engine/adapter-postgres` integration tests.
 *
 * Per SR-016's integration-test-first discipline, these tests must exercise a
 * real Postgres instance. Mocking `pg` is explicitly disallowed — production
 * behaviors under test (connection pooling exhaust-and-recover, transaction
 * isolation, migration idempotency, connection loss mid-operation, constraint
 * violation error-mapping) cannot be meaningfully verified against a mock.
 *
 * `assertDockerAvailable()` is called at the start of every test-file hook
 * that spins a container; if the Docker daemon is unreachable, the assertion
 * throws with a clear actionable diagnostic rather than letting testcontainers
 * surface a cryptic error several seconds later. This is the fail-loud
 * contract SR-016.1 established: the integration-test gate either proves the
 * infrastructure works or halts visibly, with no mock fallback.
 */

import { execSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool, type PoolConfig } from "pg";

/**
 * Postgres image matrix for SR-016. Pinned to specific minor versions of
 * `postgres:15-alpine` and `postgres:16-alpine` per operator decision:
 * 15 is the conservative production default; 16 is the current latest. The
 * adapter is documented to support Postgres 13+; these two images are the
 * tested matrix.
 */
export const POSTGRES_IMAGE_MATRIX = [
  "postgres:15-alpine",
  "postgres:16-alpine"
] as const;

export type PostgresImage = (typeof POSTGRES_IMAGE_MATRIX)[number];

/**
 * Verify that a Docker-compatible daemon is reachable before attempting to
 * spin a container. Throws with a multi-line diagnostic on failure — do not
 * wrap in try/catch to fall back to mocks; the SR-016 discipline explicitly
 * disallows mock-Postgres for these tests.
 */
export function assertDockerAvailable(): void {
  try {
    execSync("docker version --format '{{.Server.Version}}'", {
      stdio: "pipe",
      timeout: 5000
    });
  } catch (err) {
    const underlying =
      err instanceof Error ? err.message : String(err);
    throw new Error(
      [
        "[@loop-engine/adapter-postgres] Docker daemon is not reachable.",
        "",
        "Integration tests require a running Docker-compatible daemon",
        "(Docker Desktop, OrbStack, Colima, Podman, or Rancher Desktop).",
        "Install/start a daemon and verify `docker ps` returns cleanly,",
        "then re-run these tests.",
        "",
        "This is not a test failure — it is an environment prerequisite,",
        "and mocking Postgres here is explicitly disallowed per SR-016's",
        "integration-test-first discipline.",
        "",
        `Underlying diagnostic: ${underlying}`
      ].join("\n")
    );
  }
}

/**
 * Propagate the active `docker context`'s socket endpoint into the
 * `DOCKER_HOST` environment variable so `testcontainers`' Node client can
 * reach the daemon.
 *
 * Background: the `docker` CLI resolves its daemon via `docker context` (a
 * stack of named endpoints; one is marked current). Testcontainers' runtime
 * probe, however, scans a short list of conventional paths
 * (`/var/run/docker.sock`, `~/.docker/run/docker.sock`, etc.) and only
 * honors an explicit `DOCKER_HOST` override. On hosts where the active
 * context's socket is outside that scan list — notably Colima's
 * `~/.colima/default/docker.sock` and some Rancher/Podman configurations —
 * `docker ps` works but `testcontainers` reports "Could not find a working
 * container runtime strategy."
 *
 * This shim reads the current context's endpoint and sets `DOCKER_HOST` if
 * the caller hasn't already. Safe on Docker Desktop / OrbStack (where the
 * default socket paths work) — the resolved endpoint matches what
 * testcontainers would probe anyway, so setting it is a no-op
 * behaviorally. If `docker context inspect` fails (unlikely on a host
 * where `docker version` succeeded above), we leave `DOCKER_HOST` unset
 * and let testcontainers produce its standard error.
 */
export function propagateDockerHost(): void {
  let endpoint = "";

  if (!process.env.DOCKER_HOST) {
    try {
      endpoint = execSync(
        "docker context inspect --format '{{.Endpoints.docker.Host}}'",
        { stdio: ["pipe", "pipe", "pipe"], timeout: 5000, encoding: "utf8" }
      ).trim();

      if (
        endpoint.startsWith("unix://") ||
        endpoint.startsWith("tcp://") ||
        endpoint.startsWith("npipe://")
      ) {
        process.env.DOCKER_HOST = endpoint;
      }
    } catch {
      // Fall through; testcontainers will produce its own diagnostic if
      // the socket isn't reachable via its default probe list.
    }
  } else {
    endpoint = process.env.DOCKER_HOST;
  }

  // Colima / Rancher / Podman / OrbStack in VM mode: the host-side socket
  // path (e.g. `~/.colima/default/docker.sock`) does not exist inside the
  // Linux VM where testcontainers' reaper ("ryuk") runs. Inside the VM,
  // the Docker socket lives at the conventional `/var/run/docker.sock`.
  // `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE` tells testcontainers to mount
  // the VM-internal path into the reaper rather than the host path.
  // Safe to set unconditionally on Linux (no-op when the host path
  // already matches) and on Docker Desktop (it mirrors the same socket
  // path into its VM).
  if (!process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE) {
    const isVmBackedRuntime =
      endpoint.includes(".colima/") ||
      endpoint.includes(".rd/") ||
      endpoint.includes(".orbstack/") ||
      endpoint.includes(".podman/") ||
      endpoint.includes("rancher-desktop");
    if (isVmBackedRuntime) {
      process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = "/var/run/docker.sock";
    }
  }
}

export interface PostgresTestContext {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  teardown: () => Promise<void>;
}

/**
 * Spin up a Postgres container and return a `pg.Pool` connected to it.
 *
 * Accepts optional `pg.PoolConfig` overrides for tests that exercise
 * pool-config behavior (e.g., connection exhaustion in SR-016.4). The
 * container is configured to auto-expose port 5432 on a random host port to
 * avoid collisions when multiple test files run concurrently (though the
 * vitest config serializes test files via `singleFork`).
 *
 * The returned `teardown()` closes the pool before stopping the container.
 * Callers must await it in an `afterAll` / `afterEach` hook — forgetting to
 * call it will leave the container running and eventually exhaust Docker
 * resources across test iterations.
 */
export async function startPostgres(
  image: PostgresImage | string = "postgres:16-alpine",
  poolOverrides: Omit<PoolConfig, "host" | "port" | "user" | "password" | "database"> = {}
): Promise<PostgresTestContext> {
  assertDockerAvailable();
  propagateDockerHost();

  const container = await new PostgreSqlContainer(image).start();

  const pool = new Pool({
    host: container.getHost(),
    port: container.getMappedPort(5432),
    user: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
    ...poolOverrides
  });

  const teardown = async (): Promise<void> => {
    await pool.end();
    await container.stop();
  };

  return { container, pool, teardown };
}
