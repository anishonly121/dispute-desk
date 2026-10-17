"use client";
// The AI's suggested next step, which the merchant can edit and approve.
// Nothing is sent until they press the button, and the button stays disabled
// while any [placeholder] is left in the message.

import { useActionState, useState } from "react";
import { type ApproveState, approveAction } from "@/app/disputes/[id]/actions";
import type { RecommendedAction } from "@/generated/prisma/client";
import { actionSentence, approveLabel } from "@/lib/labels";

export type PanelRecommendation = {
  id: string;
  action: RecommendedAction;
  confidence: number;
  summary: string;
  reasons: { text: string; citations: string[] }[];
  offerAmount: string | null;
  draft: string;
  model: string;
};

type Props = {
  disputeId: string;
  amount: string;
  currency: string;
  rec: PanelRecommendation;
  allowed: string[] | null; // actions PayPal allows right now; null if PayPal couldn't be reached
  alreadySent: boolean;
};

const PAYPAL_NAME: Record<RecommendedAction, string> = {
  ACCEPT_CLAIM: "accept_claim",
  MAKE_OFFER: "make_offer",
  PROVIDE_EVIDENCE: "provide_evidence",
  SEND_MESSAGE: "send_message",
};

// Jump to a cited fact in the case file and highlight it for a moment.
function showFact(id: string) {
  const el = document.getElementById(`fact-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("cited");
  void el.offsetWidth; // restart the highlight if the same fact is clicked twice
  el.classList.add("cited");
}

export function RecommendationPanel({ disputeId, amount, currency, rec, allowed, alreadySent }: Props) {
  const [draft, setDraft] = useState(rec.draft);
  const [offer, setOffer] = useState(rec.offerAmount ?? "");
  const [state, formAction, sending] = useActionState<ApproveState, FormData>(approveAction, null);

  const placeholders = draft.match(/\[[^\]]+\]/g) ?? [];
  const notAllowed = allowed !== null && !allowed.includes(PAYPAL_NAME[rec.action]);
  const blocked = placeholders.length > 0 || notAllowed || alreadySent || draft.trim() === "";

  return (
    <section aria-labelledby="suggestion" className="rounded-lg border border-line bg-sheet p-5">
      <h2 id="suggestion" className="text-xl font-bold leading-snug">
        {actionSentence(rec.action, amount, rec.offerAmount, currency)}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {Math.round(rec.confidence * 100)}% confident, suggested by {rec.model}
      </p>

      <p className="mt-4 leading-relaxed">{rec.summary}</p>

      <h3 className="mt-5 font-semibold">Why</h3>
      <ul className="mt-2 space-y-2">
        {rec.reasons.map((reason, i) => (
          <li key={i} className="leading-relaxed">
            {reason.text}{" "}
            {reason.citations.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => showFact(id)}
                title={`Show ${id} in the case file`}
                className="mr-1 rounded border border-decide/40 bg-decide-wash px-1.5 text-sm font-semibold text-decide-dark hover:border-decide"
              >
                {id}
              </button>
            ))}
          </li>
        ))}
      </ul>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="recommendationId" value={rec.id} />
        <input type="hidden" name="disputeId" value={disputeId} />

        {rec.action === "MAKE_OFFER" && (
          <label className="block">
            <span className="font-semibold">Refund offer ({currency})</span>
            <span className="block text-sm text-muted">Less than the {amount} {currency} in dispute.</span>
            <input
              name="offerAmount"
              inputMode="decimal"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              className="mt-1 w-32 rounded-md border border-line px-3 py-2"
            />
          </label>
        )}

        <label className="block">
          <span className="font-semibold">Message</span>
          <span className="block text-sm text-muted">
            {rec.action === "PROVIDE_EVIDENCE" ? "Sent to PayPal with your tracking number." : "Sent to the buyer through PayPal."}
          </span>
          <textarea
            name="draft"
            rows={7}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 leading-relaxed"
          />
        </label>

        {placeholders.length > 0 && (
          <p className="rounded-md bg-due-wash px-3 py-2 text-sm text-due">
            Fill in before sending: {placeholders.join(", ")}
          </p>
        )}
        {notAllowed && (
          <p className="rounded-md bg-risk-wash px-3 py-2 text-sm text-risk">
            PayPal doesn&apos;t allow this step on the dispute right now. Get a new suggestion.
          </p>
        )}
        {alreadySent && <p className="text-sm text-muted">This suggestion has already been sent.</p>}

        <button
          type="submit"
          disabled={blocked || sending}
          className="w-full rounded-md bg-decide px-4 py-3 font-semibold text-white hover:bg-decide-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
        >
          {sending ? "Sending to PayPal..." : approveLabel(rec.action, amount, offer, currency)}
        </button>

        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-decide-dark" : "text-risk"}`}>
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
