// Checks that a webhook really came from PayPal, by asking PayPal to verify
// the signature headers it attached. Without this, anyone who finds the
// webhook URL could post fake dispute events to it.
import { paypalRequest } from "./client";

export async function verifyWebhookSignature(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("Missing PAYPAL_WEBHOOK_ID");

  const signature = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
  };

  // A request without PayPal's signature headers can't be from PayPal.
  if (Object.values(signature).some((value) => !value)) return false;

  // Build the request body by hand and drop the event in exactly as PayPal sent it.
  // Parsing and re-serialising the event could change its bytes (number formats,
  // escaping), and then the signature check would fail on a genuine event.
  const fields = JSON.stringify(signature).slice(0, -1); // remove the closing "}"
  const rawRequestBody = `${fields},"webhook_event":${rawBody}}`;

  const result = await paypalRequest<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    { method: "POST", rawBody: rawRequestBody },
  );
  return result.verification_status === "SUCCESS";
}
