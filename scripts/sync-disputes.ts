// Pull every PayPal dispute into the database.
// Run: npx tsx --env-file=.env scripts/sync-disputes.ts

import { prisma } from "../src/lib/db";
import { syncAllDisputes } from "../src/lib/sync";

async function main() {
  const result = await syncAllDisputes();
  console.log(`Synced ${result.synced} of ${result.total} dispute(s)`);
  if (result.failed.length) console.log("Failed:", result.failed.join(", "));

  const rows = await prisma.dispute.findMany({ orderBy: { sellerResponseDueAt: "asc" } });
  for (const row of rows) {
    console.log(`${row.id}  ${row.amount.toFixed(2)} ${row.currency}  ${row.itemDescription ?? "?"}  (${row.stage})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
