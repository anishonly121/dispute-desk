// Gets an AI recommendation for every dispute and prints it.
// Run: npx tsx --env-file=.env scripts/recommend.ts

import { recommendForDispute } from "../src/lib/ai/recommend-dispute";
import { prisma } from "../src/lib/db";

async function main() {
  const disputes = await prisma.dispute.findMany({ orderBy: { paypalCreatedAt: "asc" } });

  for (const dispute of disputes) {
    try {
      const { saved, attempts } = await recommendForDispute(dispute.id);
      const reasons = saved.reasons as { text: string; citations: string[] }[];

      console.log(`\n=== ${dispute.itemDescription ?? dispute.id} (${dispute.amount.toFixed(2)} ${dispute.currency}) ===`);
      console.log(`Action:     ${saved.action}${saved.offerAmount ? ` (offer ${saved.offerAmount.toFixed(2)})` : ""}`);
      console.log(`Confidence: ${Math.round(saved.confidence * 100)}%   (valid on attempt ${attempts})`);
      console.log(`Summary:    ${saved.summary}`);
      for (const reason of reasons) console.log(`  - ${reason.text} [${reason.citations.join(", ")}]`);
      console.log(`Draft:\n  ${saved.draft.replace(/\n/g, "\n  ")}`);
    } catch (error) {
      console.error(`${dispute.id} failed:`, error);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
