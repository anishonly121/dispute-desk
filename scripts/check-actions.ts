// Read-only: print every Action row stored for one dispute. Sends nothing to PayPal.
// Run: npx tsx --env-file=.env scripts/check-actions.ts PP-R-CKC-10193211

import { prisma } from "../src/lib/db";

async function main() {
  const disputeId = process.argv[2];
  if (!disputeId) throw new Error("Usage: check-actions.ts <dispute ID>");

  const actions = await prisma.action.findMany({
    where: { disputeId },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${actions.length} action(s) for ${disputeId}\n`);

  for (const a of actions) {
    console.log(`${a.type}  ${a.status}`);
    console.log(`  idempotencyKey: ${a.idempotencyKey}`);
    console.log(`  error:          ${a.error ?? "(none)"}\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
