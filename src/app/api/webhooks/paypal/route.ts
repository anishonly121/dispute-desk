// PayPal calls this URL whenever a dispute is created or changes.
// Flow: verify the signature -> record the event once -> sync the dispute.
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/paypal/webhooks";
import { syncDispute } from "@/lib/sync";

// Runs on the Node.js runtime (the Next.js default), which the database driver needs.

type PayPalEvent = {
  id: string;
  event_type: string;
  resource?: { dispute_id?: string };
};

export async function POST(request: Request) {
  // Read the body as text first: signature verification needs the exact bytes.
  const rawBody = await request.text();

  if (!(await verifyWebhookSignature(request.headers, rawBody))) {
    console.warn("PayPal webhook rejected: signature did not verify");
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as PayPalEvent;
  const disputeId = event.resource?.dispute_id;
  console.log(`PayPal webhook received: ${event.event_type} ${event.id} ${disputeId ?? ""}`);

  // Store the event under PayPal's event ID. If it's already stored, leave it as it is.
  const record = await prisma.webhookEvent.upsert({
    where: { id: event.id },
    create: {
      id: event.id,
      eventType: event.event_type,
      resourceId: disputeId ?? null,
      payload: JSON.parse(rawBody) as Prisma.InputJsonValue,
    },
    update: {},
  });

  // PayPal can deliver the same event more than once. If we've already
  // processed this one, acknowledge it and do nothing.
  if (record.processedAt) {
    return Response.json({ ok: true, duplicate: true });
  }

  try {
    if (event.event_type.startsWith("CUSTOMER.DISPUTE.") && disputeId) {
      await syncDispute(disputeId);
    }
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date(), error: null },
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`PayPal webhook processing failed for ${event.id}:`, error);
    // Record what went wrong and return 500, so PayPal retries the event later.
    // The retry gets processed because processedAt is still empty.
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
