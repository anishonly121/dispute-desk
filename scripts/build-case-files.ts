// Builds and saves a case file for every dispute, then prints it.
// Run: npx tsx --env-file=.env scripts/build-case-files.ts

import { buildCaseFile } from "../src/lib/case-file";
import { prisma } from "../src/lib/db";

async function main() {
  const disputes = await prisma.dispute.findMany({ orderBy: { paypalCreatedAt: "asc" } });

  for (const dispute of disputes) {
    try {
      const caseFile = await buildCaseFile(dispute.id);
      console.log(`\n=== ${caseFile.disputeId} (${dispute.itemDescription ?? "?"}) ===`);
      for (const fact of caseFile.facts) console.log(`  ${fact.id.padEnd(4)}${fact.label}: ${fact.value}`);
      for (const msg of caseFile.messages) console.log(`  ${msg.id.padEnd(4)}${msg.from}: "${msg.text}"`);
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
