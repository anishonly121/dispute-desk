import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedActions } from "./disputes";
import type { DisputeDetail } from "./types";

test("allowedActions reads the actions PayPal allows from the dispute's links", () => {
  const base = "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-R-TEST-1";
  const dispute = {
    links: [
      { href: base, rel: "self", method: "GET" },
      { href: `${base}/send-message`, rel: "send_message", method: "POST" },
      { href: `${base}/make-offer`, rel: "make_offer", method: "POST" },
      { href: `${base}/accept-claim`, rel: "accept_claim", method: "POST" },
      { href: `${base}/escalate`, rel: "escalate", method: "POST" },
    ],
  } as unknown as DisputeDetail;

  assert.deepEqual([...allowedActions(dispute)].sort(), ["accept_claim", "make_offer", "send_message"]);
});

test("allowedActions returns nothing when PayPal sends no links", () => {
  assert.equal(allowedActions({} as DisputeDetail).size, 0);
});
