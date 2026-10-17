// Plain-English names for PayPal's codes. The merchant should never see
// MERCHANDISE_OR_SERVICE_NOT_RECEIVED on screen.
import type { RecommendedAction } from "@/generated/prisma/client";

const REASONS: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Not as described",
  UNAUTHORISED: "Unauthorised payment",
  CREDIT_NOT_PROCESSED: "Refund not processed",
  DUPLICATE_TRANSACTION: "Charged twice",
  INCORRECT_AMOUNT: "Wrong amount charged",
  PAYMENT_BY_OTHER_MEANS: "Paid another way",
  CANCELED_RECURRING_BILLING: "Cancelled subscription",
  PROBLEM_WITH_REMITTANCE: "Problem with payment",
  OTHER: "Other",
};

const STATUSES: Record<string, string> = {
  WAITING_FOR_SELLER_RESPONSE: "Your reply needed",
  WAITING_FOR_BUYER_RESPONSE: "Waiting for buyer",
  UNDER_REVIEW: "PayPal reviewing",
  RESOLVED: "Resolved",
  OPEN: "Open",
  OTHER: "Other",
};

const STAGES: Record<string, string> = {
  INQUIRY: "Inquiry",
  CHARGEBACK: "Chargeback",
  PRE_ARBITRATION: "Pre-arbitration",
  ARBITRATION: "Arbitration",
};

// Fall back to "SOME_NEW_CODE" -> "Some new code" if PayPal adds a value we don't know.
const humanise = (code: string) => code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " ");

export const reasonLabel = (code: string) => REASONS[code] ?? humanise(code);
export const statusLabel = (code: string) => STATUSES[code] ?? humanise(code);
export const stageLabel = (code: string) => STAGES[code] ?? humanise(code);

// Short names for the queue.
export const ACTION_SHORT: Record<RecommendedAction, string> = {
  ACCEPT_CLAIM: "Accept and refund",
  MAKE_OFFER: "Offer partial refund",
  PROVIDE_EVIDENCE: "Send tracking",
  SEND_MESSAGE: "Reply to buyer",
};

// The full step, as a sentence, for the case page heading.
export function actionSentence(action: RecommendedAction, amount: string, offer: string | null, currency: string) {
  switch (action) {
    case "ACCEPT_CLAIM":
      return `Accept the claim and refund ${amount} ${currency}`;
    case "MAKE_OFFER":
      return `Offer a partial refund of ${offer ?? "?"} ${currency}`;
    case "PROVIDE_EVIDENCE":
      return "Send your tracking number to PayPal";
    case "SEND_MESSAGE":
      return "Reply to the buyer";
  }
}

// The button names exactly what will happen when it's pressed.
export function approveLabel(action: RecommendedAction, amount: string, offer: string, currency: string) {
  switch (action) {
    case "ACCEPT_CLAIM":
      return `Accept and refund ${amount} ${currency}`;
    case "MAKE_OFFER":
      return `Send offer of ${offer || "?"} ${currency}`;
    case "PROVIDE_EVIDENCE":
      return "Send tracking to PayPal";
    case "SEND_MESSAGE":
      return "Send reply";
  }
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

export function daysUntil(date: Date, now: Date) {
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T[\d:.]+Z/g;

// Case-file values are kept exactly as PayPal sent them (that's what the AI sees).
// On screen we show them in plain English: codes become words, timestamps become dates.
export function displayFactValue(label: string, value: string) {
  if (label === "Dispute reason") return reasonLabel(value);

  const stage = value.match(/^([A-Z_]+) \(([A-Z_]+)\)$/);
  if (label === "Dispute stage" && stage) return `${stageLabel(stage[1])}, ${statusLabel(stage[2]).toLowerCase()}`;

  return value
    .replace(ISO_TIMESTAMP, (iso) => formatDate(new Date(iso)))
    .replace(/\b[A-Z][A-Z_]{3,}\b/g, (code) => humanise(code)); // e.g. COMPLETED -> Completed
}

export function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}
