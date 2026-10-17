// Acts as the merchant: shows the latest recommendation for one dispute, shows what
// PayPal allows right now, and only sends it if you type "yes".
// Run: npx tsx --env-file=.env scripts/approve.ts "Linen tote bag"

import { createInterface } from "node:readline/promises";
import { approveRecommendation, ApprovalError } from "../src/lib/actions";
import { prisma } from "../src/lib/db";
import { allowedActions, getDispute } from "../src/lib/paypal/disputes";

async function main() {
  const item = process.argv[2];
  if (!item) throw new Error('Usage: approve.ts "<item description>"');

  const dispute = await prisma.dispute.findFirst({ where: { itemDescription: item } });
  if (!dispute) throw new Error(`No dispute for "${item}"`);

  const rec = await prisma.recommendation.findFirst({
    where: { disputeId: dispute.id },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) throw new Error("No recommendation yet. Run scripts/recommend.ts first.");

  const live = await getDispute(dispute.id);
  console.log(`Dispute:  ${dispute.id} (${live.dispute_life_cycle_stage} / ${live.status})`);
  console.log(`Allowed:  ${[...allowedActions(live)].join(", ") || "nothing"}`);
  console.log(`Action:   ${rec.action}${rec.offerAmount ? ` ${rec.offerAmount.toFixed(2)} ${dispute.currency}` : ""}`);
  console.log(`Message:\n  ${rec.draft.replace(/\n/g, "\n  ")}\n`);

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await readline.question('Send this to PayPal? Type "yes" to send: ');
  readline.close();
  if (answer.trim().toLowerCase() !== "yes") return console.log("Not sent.");

  try {
    const action = await approveRecommendation({ recommendationId: rec.id });
    console.log(`\nResult:   ${action.status}${action.error ? ` - ${action.error}` : ""}`);
    console.log(`Key:      ${action.idempotencyKey}`);
  } catch (error) {
    if (error instanceof ApprovalError) console.log(`\nNot sent: ${error.message}`);
    else throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
