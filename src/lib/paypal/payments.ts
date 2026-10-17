import { paypalRequest } from "./client";
import type { Capture, Order } from "./types";

// A capture is the money actually moving. Its ID is what a dispute points to.
export function getCapture(captureId: string): Promise<Capture> {
  return paypalRequest<Capture>(`/v2/payments/captures/${encodeURIComponent(captureId)}`);
}

// The order holds what was bought, such as the item description.
export function getOrder(orderId: string): Promise<Order> {
  return paypalRequest<Order>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

type TrackingInput = {
  captureId: string;
  trackingNumber: string;
  carrier: string; // a PayPal carrier code, or "OTHER" with carrierNameOther
  carrierNameOther?: string;
};

// Attach a shipment's tracking number to an order. Tracking is the strongest
// evidence a seller has against an "item not received" dispute.
export function addTracking(orderId: string, input: TrackingInput): Promise<Order> {
  return paypalRequest<Order>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/track`, {
    method: "POST",
    body: {
      capture_id: input.captureId,
      tracking_number: input.trackingNumber,
      carrier: input.carrier,
      carrier_name_other: input.carrierNameOther,
      notify_payer: false,
    },
    // Same capture + tracking number = same key, so running this twice adds it once.
    idempotencyKey: `track-${input.captureId}-${input.trackingNumber}`,
  });
}
