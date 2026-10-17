import { paypalRequest } from "./client";
import type { DisputeDetail, DisputeList, DisputeSummary } from "./types";

// Safety stop so a bad "next" link can never loop forever.
const MAX_PAGES = 20;

// PayPal returns disputes a page at a time, with a "next" link while more pages exist.
export async function listDisputes(): Promise<DisputeSummary[]> {
  const all: DisputeSummary[] = [];
  let next: string | undefined = "/v1/customer/disputes";

  for (let page = 0; next && page < MAX_PAGES; page++) {
    const result: DisputeList = await paypalRequest<DisputeList>(next);
    all.push(...(result.items ?? []));
    next = result.links?.find((link) => link.rel === "next")?.href;
  }
  return all;
}

export function getDispute(disputeId: string): Promise<DisputeDetail> {
  return paypalRequest<DisputeDetail>(`/v1/customer/disputes/${encodeURIComponent(disputeId)}`);
}

// ---- Responding to a dispute ----

export const DISPUTE_ACTIONS = ["send_message", "make_offer", "accept_claim", "provide_evidence"] as const;
export type DisputeAction = (typeof DISPUTE_ACTIONS)[number];

// PayPal only includes a link for an action when the merchant is allowed to take it
// at the dispute's current stage, e.g. provide-evidence only appears at the claim stage.
export function allowedActions(dispute: DisputeDetail): Set<DisputeAction> {
  const allowed = new Set<DisputeAction>();
  for (const link of dispute.links ?? []) {
    // ".../disputes/PP-R-123/make-offer" -> "make_offer"
    const name = (link.href.split("/").pop() ?? "").replace(/-/g, "_");
    if ((DISPUTE_ACTIONS as readonly string[]).includes(name)) allowed.add(name as DisputeAction);
  }
  return allowed;
}

const disputePath = (id: string, action: string) => `/v1/customer/disputes/${encodeURIComponent(id)}/${action}`;

export function sendMessage(disputeId: string, message: string, idempotencyKey: string) {
  return paypalRequest(disputePath(disputeId, "send-message"), {
    method: "POST",
    body: { message },
    idempotencyKey,
  });
}

// A partial refund: the buyer keeps the item and gets part of their money back.
export function makeOffer(disputeId: string, amount: string, currency: string, note: string, idempotencyKey: string) {
  return paypalRequest(disputePath(disputeId, "make-offer"), {
    method: "POST",
    body: { note, offer_type: "REFUND", offer_amount: { currency_code: currency, value: amount } },
    idempotencyKey,
  });
}

// Closes the dispute in the buyer's favour. PayPal refunds the buyer automatically.
export function acceptClaim(disputeId: string, note: string, idempotencyKey: string) {
  return paypalRequest(disputePath(disputeId, "accept-claim"), {
    method: "POST",
    body: { note },
    idempotencyKey,
  });
}

// Sends proof of shipment. PayPal requires multipart/form-data here, with the
// JSON in a part called "input", so the body is built by hand.
export function provideEvidence(disputeId: string, trackingNumber: string, notes: string, idempotencyKey: string) {
  const input = {
    evidences: [
      {
        evidence_type: "PROOF_OF_FULFILLMENT",
        evidence_info: { tracking_info: [{ carrier_name: "OTHER", carrier_name_other: "SingPost", tracking_number: trackingNumber }] },
        notes,
      },
    ],
  };
  const boundary = `dispute-desk-${crypto.randomUUID()}`;
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="input"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(input)}\r\n` +
    `--${boundary}--\r\n`;

  return paypalRequest(disputePath(disputeId, "provide-evidence"), {
    method: "POST",
    rawBody: body,
    contentType: `multipart/form-data; boundary=${boundary}`,
    idempotencyKey,
  });
}
