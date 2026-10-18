// The checks that stop the AI's answer from reaching the merchant when it isn't
// backed by the case file. Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CaseFile } from "../case-file";
import { type Recommendation, validateRecommendation } from "./recommend";

const caseFile = (withTracking: boolean): CaseFile => ({
  disputeId: "PP-R-TEST-1",
  builtAt: "2026-10-18T00:00:00.000Z",
  facts: [
    { id: "F1", label: "Dispute reason", value: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED", source: "dispute.reason" },
    { id: "F2", label: "Disputed amount", value: "25.00 SGD", source: "dispute.dispute_amount" },
    {
      id: "F3",
      label: "Shipping tracking",
      value: withTracking ? "Tracking number RR987654321SG" : "No tracking number has been added to this order",
      source: "order.purchase_units[0].shipping.trackers",
    },
  ],
  messages: [{ id: "M1", from: "BUYER", at: "2026-10-17T09:00:00Z", text: "The bag is much smaller than the photos." }],
});

const valid: Recommendation = {
  action: "MAKE_OFFER",
  confidence: 0.85,
  summary: "The bag arrived but is smaller than described.",
  reasons: [{ text: "The buyer says it's smaller than the photos.", citations: ["M1"] }],
  offerAmount: "10.00",
  draft: "Sorry the bag wasn't what you expected. We'd like to offer a 10.00 SGD refund.",
};

describe("validateRecommendation", () => {
  test("accepts a suggestion that is backed by the case file", () => {
    assert.deepEqual(validateRecommendation(valid, caseFile(true)), []);
  });

  test("rejects a citation that isn't in the case file", () => {
    const rec = { ...valid, reasons: [{ text: "Photos show damage.", citations: ["F9"] }] };
    assert.match(validateRecommendation(rec, caseFile(true)).join(), /F9, which is not in the case file/);
  });

  test("rejects a reason with no citation", () => {
    const rec = { ...valid, reasons: [{ text: "Trust me.", citations: [] }] };
    assert.match(validateRecommendation(rec, caseFile(true)).join(), /has no citation/);
  });

  test("rejects sending tracking when there is no tracking number", () => {
    const rec: Recommendation = { ...valid, action: "PROVIDE_EVIDENCE", offerAmount: null };
    assert.match(validateRecommendation(rec, caseFile(false)).join(), /needs a tracking number/);
  });

  test("rejects an offer that isn't below the disputed amount", () => {
    assert.match(validateRecommendation({ ...valid, offerAmount: "25.00" }, caseFile(true)).join(), /must be below/);
    assert.match(validateRecommendation({ ...valid, offerAmount: "0" }, caseFile(true)).join(), /greater than 0/);
  });

  test("rejects an offer amount on any step other than an offer", () => {
    const rec: Recommendation = { ...valid, action: "SEND_MESSAGE" };
    assert.match(validateRecommendation(rec, caseFile(true)).join(), /must be null/);
  });

  test("rejects a reply that claims a shipping status the data can't back up", () => {
    const rec: Recommendation = {
      ...valid,
      action: "SEND_MESSAGE",
      offerAmount: null,
      draft: "Your order is being prepared and will be with you soon.",
    };
    assert.match(validateRecommendation(rec, caseFile(false)).join(), /shipping or processing status/);
  });
});
