// Copies a dispute from PayPal into our database, together with the order it
// came from. Safe to run any number of times: it updates instead of duplicating.
import { prisma } from "./db";
import { getDispute, listDisputes } from "./paypal/disputes";
import { getCapture, getOrder } from "./paypal/payments";
import type { DisputeDetail } from "./paypal/types";

type OrderInfo = { captureId?: string; orderId?: string; itemDescription?: string };

// Follow dispute -> capture -> order to find what was bought.
async function findOrderInfo(dispute: DisputeDetail): Promise<OrderInfo> {
  const captureId = dispute.disputed_transactions?.[0]?.seller_transaction_id;
  if (!captureId) return {};

  const capture = await getCapture(captureId);
  const orderId = capture.supplementary_data?.related_ids?.order_id;
  if (!orderId) return { captureId };

  const order = await getOrder(orderId);
  return { captureId, orderId, itemDescription: order.purchase_units[0]?.description };
}

export async function syncDispute(disputeId: string) {
  const dispute = await getDispute(disputeId);
  const orderInfo = await findOrderInfo(dispute);
  const lastBuyerMessage = dispute.messages?.filter((m) => m.posted_by === "BUYER").at(-1)?.content;

  const data = {
    reason: dispute.reason,
    status: dispute.status,
    stage: dispute.dispute_life_cycle_stage,
    amount: dispute.dispute_amount.value, // a string like "38.00", stored exactly
    currency: dispute.dispute_amount.currency_code,
    captureId: orderInfo.captureId ?? null,
    orderId: orderInfo.orderId ?? null,
    itemDescription: orderInfo.itemDescription ?? null,
    lastBuyerMessage: lastBuyerMessage ?? null,
    sellerResponseDueAt: dispute.seller_response_due_date ? new Date(dispute.seller_response_due_date) : null,
    paypalCreatedAt: new Date(dispute.create_time),
    paypalUpdatedAt: new Date(dispute.update_time),
    raw: dispute,
  };

  // Upsert: insert the dispute the first time, update it every time after.
  return prisma.dispute.upsert({
    where: { id: dispute.dispute_id },
    create: { id: dispute.dispute_id, ...data },
    update: data,
  });
}

export async function syncAllDisputes() {
  const summaries = await listDisputes();
  let synced = 0;
  const failed: string[] = [];

  // One at a time, to stay well inside PayPal's rate limits.
  for (const summary of summaries) {
    try {
      await syncDispute(summary.dispute_id);
      synced++;
    } catch (error) {
      console.error(`Failed to sync ${summary.dispute_id}:`, error);
      failed.push(summary.dispute_id);
    }
  }
  return { total: summaries.length, synced, failed };
}
