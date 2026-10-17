"use server";
// Server actions for the case page. The browser can call these, but they run
// only on the server, where the PayPal and Gemini keys live.

import { revalidatePath } from "next/cache";
import { ApprovalError, approveRecommendation } from "@/lib/actions";
import { recommendForDispute } from "@/lib/ai/recommend-dispute";

export type ApproveState = { ok: boolean; message: string } | null;

export async function approveAction(_previous: ApproveState, formData: FormData): Promise<ApproveState> {
  const recommendationId = String(formData.get("recommendationId"));
  const disputeId = String(formData.get("disputeId"));
  const draft = String(formData.get("draft") ?? "");
  const offerAmount = formData.get("offerAmount");

  try {
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
    if (error instanceof ApprovalError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function suggestAction(disputeId: string) {
  try {
    await recommendForDispute(disputeId);
    revalidatePath(`/disputes/${disputeId}`);
    revalidatePath("/");
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Couldn't get a suggestion.";
  }
}
