"use server";
// Server actions for the case page. The browser can call these, but they run
// only on the server, where the PayPal and Gemini keys live.

import { revalidatePath } from "next/cache";
import { ApprovalError, approveRecommendation } from "@/lib/actions";
import { recommendForDispute } from "@/lib/ai/recommend-dispute";
import { prisma } from "@/lib/db";
import { OperatorError, requireOperator } from "@/lib/operator";

export type ApproveState = { ok: boolean; message: string } | null;

// Gemini's free tier has a small quota, so one dispute can't ask for a new
// suggestion more than once a minute.
const SUGGEST_COOLDOWN_MS = 60_000;

export async function approveAction(_previous: ApproveState, formData: FormData): Promise<ApproveState> {
  const recommendationId = String(formData.get("recommendationId"));
  const disputeId = String(formData.get("disputeId"));
  const draft = String(formData.get("draft") ?? "");
  const offerAmount = formData.get("offerAmount");

  try {
    await requireOperator();
    const action = await approveRecommendation({
      recommendationId,
      draft,
      offerAmount: offerAmount ? String(offerAmount) : undefined,
    });
    revalidatePath(`/disputes/${disputeId}`);
    revalidatePath("/");

    if (action.status === "SUCCEEDED") return { ok: true, message: "Sent to PayPal." };
    if (action.status === "PENDING") return { ok: true, message: "Already sending. Refresh in a moment." };
    return { ok: false, message: action.error ?? "PayPal didn't accept the request." };
  } catch (error) {
    // Problems the merchant can fix are shown in the form; anything else is a real bug.
    if (error instanceof ApprovalError || error instanceof OperatorError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function suggestAction(disputeId: string) {
  try {
    await requireOperator();

    const latest = await prisma.recommendation.findFirst({
      where: { disputeId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < SUGGEST_COOLDOWN_MS) {
      return "A suggestion was made less than a minute ago. Wait a moment, then try again.";
    }

    await recommendForDispute(disputeId);
    revalidatePath(`/disputes/${disputeId}`);
    revalidatePath("/");
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Couldn't get a suggestion.";
  }
}
