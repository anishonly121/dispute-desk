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
