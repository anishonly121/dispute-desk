// Session 2 check: print every dispute together with the order it came from.
// Run: npx tsx --env-file=.env scripts/check-disputes.ts

import { getDispute, listDisputes } from "../src/lib/paypal/disputes";
import { getCapture, getOrder } from "../src/lib/paypal/payments";
import type { DisputeDetail } from "../src/lib/paypal/types";

// Follow the chain dispute -> capture -> order to find what was bought.
async function findItemDescription(dispute: DisputeDetail): Promise<string> {
  const captureId = dispute.disputed_transactions?.[0]?.seller_transaction_id;
  if (!captureId) return "(no transaction on dispute)";

  const capture = await getCapture(captureId);
  const orderId = capture.supplementary_data?.related_ids?.order_id;
  if (!orderId) return "(no order linked to capture)";

  const order = await getOrder(orderId);
  return order.purchase_units[0]?.description ?? "(order has no description)";
}

async function main() {
  const disputes = await listDisputes();
  console.log(`Found ${disputes.length} dispute(s)\n`);

  for (const summary of disputes) {
    // One broken dispute shouldn't stop the others from printing.
    try {
      const dispute = await getDispute(summary.dispute_id);
      const item = await findItemDescription(dispute);
      const buyerMessage = dispute.messages?.filter((m) => m.posted_by === "BUYER").at(-1)?.content;

      console.log(`${dispute.dispute_id}  ${dispute.dispute_amount.value} ${dispute.dispute_amount.currency_code}`);
      console.log(`  Item:     ${item}`);
      console.log(`  Reason:   ${dispute.reason}`);
      console.log(`  Stage:    ${dispute.dispute_life_cycle_stage} / ${dispute.status}`);
      console.log(`  Reply by: ${dispute.seller_response_due_date ?? "n/a"}`);
      console.log(`  Buyer:    ${buyerMessage ?? "(no message)"}\n`);
    } catch (error) {
      console.error(`${summary.dispute_id}  failed:`, error, "\n");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
