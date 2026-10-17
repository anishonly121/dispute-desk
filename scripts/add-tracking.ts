// Adds a tracking number to the mug and tote bag orders, so some cases have
// shipping evidence (strong for the seller) and some don't (weak).
// Run: npx tsx --env-file=.env scripts/add-tracking.ts

import { prisma } from "../src/lib/db";
import { addTracking } from "../src/lib/paypal/payments";

const SHIPMENTS = [
  { item: "Handmade ceramic mug", trackingNumber: "RR123456785SG" },
  { item: "Linen tote bag", trackingNumber: "RR987654321SG" },
];

async function main() {
  for (const shipment of SHIPMENTS) {
    const dispute = await prisma.dispute.findFirst({ where: { itemDescription: shipment.item } });
    if (!dispute?.orderId || !dispute.captureId) {
      console.log(`${shipment.item}: no order or capture in the database, run npm run sync first`);
      continue;
    }

    const order = await addTracking(dispute.orderId, {
      captureId: dispute.captureId,
      trackingNumber: shipment.trackingNumber,
      carrier: "OTHER",
      carrierNameOther: "SingPost",
    });
    const trackers = order.purchase_units[0]?.shipping?.trackers ?? [];
    console.log(`${shipment.item}: ${trackers.length} tracker(s) on order ${order.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
