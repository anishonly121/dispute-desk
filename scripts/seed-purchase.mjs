// Dev helper: creates a sandbox order, then captures it after you pay as the buyer.
// Usage:
//   node --env-file=.env scripts/seed-purchase.mjs create "Handmade ceramic mug" 38.00
//   node --env-file=.env scripts/seed-purchase.mjs capture ORDER_ID
//   node --env-file=.env scripts/seed-purchase.mjs buy "Ceramic plant pot" 22.00
//     (creates the order, waits while you pay in the browser, then captures it)

const base = process.env.PAYPAL_API_BASE;
const siteUrl = "https://dispute-desk-nine.vercel.app";

// Swap the client ID and secret for a short-lived access token.
async function getToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// Create an order and print the link the buyer uses to pay.
async function createOrder(token, description, value) {
  const res = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ description, amount: { currency_code: "SGD", value } }],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            return_url: siteUrl,
            cancel_url: siteUrl,
          },
        },
      },
    }),
  });

  const order = await res.json();
  if (!res.ok) throw new Error(`Create order failed: ${JSON.stringify(order)}`);

  const payLink = order.links.find((link) => link.rel === "payer-action").href;
  console.log("Order ID:", order.id);
  console.log("Open this link and pay as the buyer:");
  console.log(payLink);
  return order.id;
}

// Check the order every 3 seconds until the buyer has approved it (paid).
async function waitForApproval(token, orderId) {
  console.log("Waiting for you to pay in the browser...");
  for (let attempt = 0; attempt < 200; attempt++) {
    const res = await fetch(`${base}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const order = await res.json();
    if (order.status === "APPROVED") return;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Gave up waiting after 10 minutes. Run capture manually once you've paid.");
}

// After the buyer has paid, capture the money into the business account.
async function captureOrder(token, orderId) {
  const res = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const result = await res.json();
  if (!res.ok) throw new Error(`Capture failed: ${JSON.stringify(result)}`);

  const capture = result.purchase_units[0].payments.captures[0];
  console.log("Status:", result.status);
  console.log("Capture ID:", capture.id);
  console.log("Amount:", capture.amount.value, capture.amount.currency_code);
}

const [command, arg1, arg2] = process.argv.slice(2);
const token = await getToken();

if (command === "create") await createOrder(token, arg1, arg2);
else if (command === "capture") await captureOrder(token, arg1);
else if (command === "buy") {
  const orderId = await createOrder(token, arg1, arg2);
  await waitForApproval(token, orderId);
  await captureOrder(token, orderId);
} else console.log('Use: buy "<description>" <amount>, create "<description>" <amount>, or capture <orderId>');
