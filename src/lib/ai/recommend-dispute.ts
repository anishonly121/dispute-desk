// Builds a fresh case file for a dispute, asks the AI for a recommendation,
// and saves it. The saved row is what the merchant reviews and approves.
import { buildCaseFile } from "../case-file";
import { prisma } from "../db";
import { MODEL_ID, recommend } from "./recommend";

export async function recommendForDispute(disputeId: string) {
  const caseFile = await buildCaseFile(disputeId);
  const { recommendation, attempts } = await recommend(caseFile);

  const saved = await prisma.recommendation.create({
    data: {
      disputeId,
      action: recommendation.action,
      confidence: recommendation.confidence,
      summary: recommendation.summary,
      reasons: recommendation.reasons,
      offerAmount: recommendation.offerAmount,
      draft: recommendation.draft,
      model: MODEL_ID,
    },
  });
  return { saved, attempts, caseFile };
}
