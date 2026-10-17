// Turns a merchant's approval into exactly one PayPal call, and records it.
// Nothing reaches PayPal without going through approveRecommendation.
import { Prisma, type RecommendedAction } from "@/generated/prisma/client";
import type { CaseFile } from "./case-file";
import { prisma } from "./db";
import {
  acceptClaim,
  allowedActions,
  type DisputeAction,
  getDispute,
  makeOffer,
  provideEvidence,
  sendMessage,
} from "./paypal/disputes";
import { syncDispute } from "./sync";

// Thrown for problems the merchant can fix (empty message, unfilled placeholder...).
export class ApprovalError extends Error {}

const PAYPAL_ACTION: Record<RecommendedAction, DisputeAction> = {
  ACCEPT_CLAIM: "accept_claim",
  MAKE_OFFER: "make_offer",
  PROVIDE_EVIDENCE: "provide_evidence",
  SEND_MESSAGE: "send_message",
};

// Matches an unfilled "[something]" placeholder left by the AI for the merchant.
export const PLACEHOLDER = /\[[^\]]+\]/;

type ApproveInput = {
  recommendationId: string;
  draft?: string; // the merchant's edited text, if they changed it
  offerAmount?: string; // the merchant's edited offer, if they changed it
};

export async function approveRecommendation({ recommendationId, draft, offerAmount }: ApproveInput) {
  const rec = await prisma.recommendation.findUniqueOrThrow({
    where: { id: recommendationId },
    include: { dispute: true },
  });
  const disputeId = rec.disputeId;

  // 1. Check what the merchant is about to send.
  const text = (draft ?? rec.draft).trim();
  if (!text) throw new ApprovalError("The message is empty.");
  if (PLACEHOLDER.test(text)) throw new ApprovalError("Fill in every [placeholder] in the message before sending.");

  let amount: string | null = null;
  if (rec.action === "MAKE_OFFER") {
    amount = offerAmount ?? rec.offerAmount?.toFixed(2) ?? null;
    const value = Number(amount);
    if (!(value > 0) || !(value < rec.dispute.amount.toNumber())) {
      throw new ApprovalError(`The offer must be more than 0 and less than ${rec.dispute.amount.toFixed(2)}.`);
    }
    amount = value.toFixed(2);
  }

  let trackingNumber: string | null = null;
  if (rec.action === "PROVIDE_EVIDENCE") {
    const caseFile = rec.dispute.caseFile as unknown as CaseFile | null;
    const fact = caseFile?.facts.find((f) => f.value.startsWith("Tracking number"));
    trackingNumber = fact?.value.split(" ")[2]?.replace(/,$/, "") ?? null;
    if (!trackingNumber) throw new ApprovalError("There is no tracking number to send as evidence.");
  }

  // 2. One approval means one PayPal call. If this recommendation already has an
  //    action that succeeded or is still in progress, return it instead of sending again.
  const previous = await prisma.action.findMany({ where: { recommendationId }, orderBy: { createdAt: "asc" } });
  const active = previous.find((a) => a.status !== "FAILED");
  if (active) return active;

  // A double click produces the same key, so the unique constraint stops the second.
  // A retry after a failure gets a fresh key.
  const idempotencyKey = `dd-${recommendationId}-${previous.length + 1}`;
  let action;
  try {
    action = await prisma.action.create({
      data: {
        disputeId,
        recommendationId,
        type: rec.action,
        idempotencyKey,
        request: { text, offerAmount: amount, trackingNumber },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.action.findUniqueOrThrow({ where: { idempotencyKey } });
    }
    throw error;
  }

  // 3. Send it, and record the outcome either way.
  try {
    // Ask PayPal whether this action is still allowed. The stage may have moved on
    // since the recommendation was made (e.g. the buyer escalated to a claim).
    const live = await getDispute(disputeId);
    const paypalAction = PAYPAL_ACTION[rec.action];
    if (!allowedActions(live).has(paypalAction)) {
      throw new ApprovalError(
        `PayPal doesn't allow "${paypalAction}" on this dispute right now (stage: ${live.dispute_life_cycle_stage}).`,
      );
    }

    let response: unknown;
    switch (rec.action) {
      case "SEND_MESSAGE":
        response = await sendMessage(disputeId, text, idempotencyKey);
        break;
      case "MAKE_OFFER":
        response = await makeOffer(disputeId, amount!, rec.dispute.currency, text, idempotencyKey);
        break;
      case "ACCEPT_CLAIM":
        response = await acceptClaim(disputeId, text, idempotencyKey);
        break;
      case "PROVIDE_EVIDENCE":
        response = await provideEvidence(disputeId, trackingNumber!, text, idempotencyKey);
        break;
    }

    const done = await prisma.action.update({
      where: { id: action.id },
      data: { status: "SUCCEEDED", response: (response ?? {}) as Prisma.InputJsonValue, completedAt: new Date() },
    });

    // Refresh our copy of the dispute so its new status shows straight away.
    // If this fails it doesn't matter: PayPal's webhook will update it too.
    await syncDispute(disputeId).catch(() => undefined);
    return done;
  } catch (error) {
    return prisma.action.update({
      where: { id: action.id },
      data: { status: "FAILED", error: error instanceof Error ? error.message : String(error), completedAt: new Date() },
    });
  }
}
