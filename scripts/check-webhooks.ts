// Shows the latest webhook events and every dispute stored in the database.
// Run: npx tsx --env-file=.env scripts/check-webhooks.ts

import { prisma } from "../src/lib/db";

async function main() {
  const events = await prisma.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 10 });
  console.log(`Webhook events received: ${events.length}`);
  for (const e of events) {
    const state = e.processedAt ? "processed" : e.error ? `FAILED: ${e.error}` : "not processed";
    console.log(`  ${e.receivedAt.toISOString()}  ${e.eventType}  ${e.resourceId ?? ""}  ${state}`);
  }

  const disputes = await prisma.dispute.findMany({ orderBy: { paypalCreatedAt: "asc" } });
  console.log(`\nDisputes in database: ${disputes.length}`);
  for (const d of disputes) {
    console.log(`  ${d.id}  ${d.amount.toFixed(2)} ${d.currency}  ${d.itemDescription ?? "?"}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
