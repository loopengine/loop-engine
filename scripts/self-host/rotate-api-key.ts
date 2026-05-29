/**
 * RT-20c — Rotate the OSS self-host demo API key.
 *
 * Inserts a fresh `LoopEngineApiKey` row, hashing the supplied `le_*` token
 * with SHA-256. The 24-hour rotation grace window honored by `DbAuthAdapter`
 * means both the old and new keys keep working until you explicitly remove
 * the old row.
 *
 * Usage (inside compose):
 *   docker compose -f deploy/compose/docker-compose.yml exec loop-engine-runtime \
 *     pnpm exec tsx scripts/self-host/rotate-api-key.ts \
 *       --tenant self-host-tenant \
 *       --token le_<new_hex_token>
 *
 * Usage (on the host, against a local compose-exposed Postgres):
 *   pnpm tsx scripts/self-host/rotate-api-key.ts \
 *     --tenant self-host-tenant \
 *     --token le_<new_hex_token>
 *
 * Hard rules:
 *   - Validates the `le_<32 hex>` shape upfront so we can't insert garbage.
 *   - Never logs the plaintext token to stdout.
 *   - Idempotent: re-inserting an already-known hash is a no-op (upserts by hash).
 */
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@loop-engine/runtime-db";

type Args = {
  tenantId: string;
  token: string;
};

function parseArgs(argv: string[]): Args {
  let tenantId = process.env.LOOP_ENGINE_DEFAULT_TENANT_ID ?? "self-host-tenant";
  let token = "";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--tenant" && argv[i + 1]) {
      tenantId = String(argv[++i]);
    } else if (arg === "--token" && argv[i + 1]) {
      token = String(argv[++i]);
    } else if (arg === "--generate") {
      token = `le_${randomBytes(16).toString("hex")}`;
      console.log(`Generated new token (copy this into LOOP_ENGINE_API_KEY): ${token}`);
    }
  }
  if (!token) {
    console.error(
      "rotate-api-key: --token <le_...> is required (or use --generate to mint a new one).",
    );
    process.exit(2);
  }
  if (!/^le_[0-9a-f]{32}$/.test(token)) {
    console.error(`rotate-api-key: token does not match /^le_[0-9a-f]{32}$/ — refusing to insert`);
    process.exit(2);
  }
  return { tenantId, token };
}

function hashLoopApiKey(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

async function main(): Promise<void> {
  const { tenantId, token } = parseArgs(process.argv.slice(2));
  const hash = hashLoopApiKey(token);
  const prefix = `${token.slice(0, 12)}...`;
  const db = new PrismaClient();
  try {
    const row = await db.loopEngineApiKey.upsert({
      where: { keyHash: hash },
      update: { tenantId, status: "ACTIVE" },
      create: {
        tenantId,
        name: "self-host-rotated",
        keyHash: hash,
        keyPrefix: prefix,
        status: "ACTIVE",
      },
      select: { id: true, tenantId: true, keyPrefix: true, createdAt: true },
    });
    console.log(
      `Inserted/updated LoopEngineApiKey id=${row.id} tenant=${row.tenantId} prefix=${row.keyPrefix} created=${row.createdAt.toISOString()}`,
    );
    console.log(
      "The old demo key is still valid until you explicitly revoke it. To revoke now:",
    );
    console.log(
      '  psql $LOOP_ENGINE_DATABASE_URL -c "UPDATE \\"LoopEngineApiKey\\" SET status=\'REVOKED\' WHERE \\"keyPrefix\\" LIKE \'le_5e1f0057de51%\';"',
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("rotate-api-key: failed", err instanceof Error ? err.message : err);
  process.exit(1);
});
