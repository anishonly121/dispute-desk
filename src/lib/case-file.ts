// Builds the "case file" for a dispute: a numbered list of facts taken from
// PayPal data. The AI only ever sees this file, and every claim it makes has to
// cite one of these IDs (F1, F2, M1...). That's how we stop it inventing evidence.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { getCapture, getOrder } from "./paypal/payments";
import type { Capture, DisputeDetail, Order } from "./paypal/types";

export type Fact = {
  id: string; // "F1", "F2", ...
  label: string;
  value: string;
  source: string; // where the value came from, so a human can check it
};

export type CaseMessage = {
  id: string; // "M1", "M2", ...
  from: string; // BUYER or SELLER
  at: string;
  text: string;
};

export type CaseFile = {
  disputeId: string;
  builtAt: string;
  facts: Fact[];
  messages: CaseMessage[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function buildCaseFileFromData(
  dispute: DisputeDetail,
  capture: Capture | null,
  order: Order | null,
  now = new Date(),
): CaseFile {
  const facts: Fact[] = [];
  const add = (label: string, value: string, source: string) =>
    facts.push({ id: `F${facts.length + 1}`, label, value, source });

  add("Dispute reason", dispute.reason, "dispute.reason");
  add("Disputed amount", `${dispute.dispute_amount.value} ${dispute.dispute_amount.currency_code}`, "dispute.dispute_amount");
  add("Dispute stage", `${dispute.dispute_life_cycle_stage} (${dispute.status})`, "dispute.dispute_life_cycle_stage");
  if (dispute.seller_response_due_date) {
    add("Seller must respond by", dispute.seller_response_due_date, "dispute.seller_response_due_date");
  }

  const unit = order?.purchase_units[0];
  if (order && unit) {
    add("Item purchased", unit.description ?? "(no description on order)", "order.purchase_units[0].description");
    add("Order total", `${unit.amount.value} ${unit.amount.currency_code}`, "order.purchase_units[0].amount");
  } else {
    add("Order", "Could not find the order for this payment", "dispute.disputed_transactions");
  }

  if (capture) {
    const holdReason = capture.status_details?.reason;
    add("Payment status", holdReason ? `${capture.status} (${holdReason})` : capture.status, "capture.status");
    add("Payment date", capture.create_time, "capture.create_time");
    add("Days since payment", String(daysBetween(new Date(capture.create_time), now)), "computed from capture.create_time");
  }

  // Shipping evidence: a tracking number on the order, or a clear note that there is none.
  const trackers = unit?.shipping?.trackers ?? [];
  if (trackers.length === 0) {
    add("Shipping tracking", "No tracking number has been added to this order", "order.purchase_units[0].shipping.trackers");
  }
  for (const tracker of trackers) {
    // PayPal's tracker ID is "<capture ID>-<tracking number>", so strip the capture ID.
    const prefix = capture ? `${capture.id}-` : "";
    const trackingNumber = prefix && tracker.id.startsWith(prefix) ? tracker.id.slice(prefix.length) : tracker.id;
    const added = tracker.create_time ? `, added ${tracker.create_time}` : "";
    add("Shipping tracking", `Tracking number ${trackingNumber}${added}`, "order.purchase_units[0].shipping.trackers");
  }

  const messages: CaseMessage[] = (dispute.messages ?? []).map((m, i) => ({
    id: `M${i + 1}`,
    from: m.posted_by,
    at: m.time_posted,
    text: m.content,
  }));

  return { disputeId: dispute.dispute_id, builtAt: now.toISOString(), facts, messages };
}

// Load the dispute from our database, fetch the latest order and payment from
// PayPal (tracking can be added at any time), then save the case file.
export async function buildCaseFile(disputeId: string): Promise<CaseFile> {
  const row = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
  const dispute = row.raw as unknown as DisputeDetail;

  const capture = row.captureId ? await getCapture(row.captureId) : null;
  const order = row.orderId ? await getOrder(row.orderId) : null;

  const caseFile = buildCaseFileFromData(dispute, capture, order);

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      caseFile: caseFile as unknown as Prisma.InputJsonValue,
      caseFileBuiltAt: new Date(caseFile.builtAt),
    },
  });
  return caseFile;
}
