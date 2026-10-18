import assert from "node:assert/strict";
import { test } from "node:test";
import type { Capture, DisputeDetail, Order } from "./paypal/types";

// case-file.ts also exports a function that uses the database. These tests never
// call it, but the database client needs a connection string to load.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

const dispute = {
  dispute_id: "PP-R-TEST-1",
  reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
  status: "WAITING_FOR_SELLER_RESPONSE",
  dispute_life_cycle_stage: "INQUIRY",
  dispute_amount: { value: "38.00", currency_code: "SGD" },
  seller_response_due_date: "2026-11-06T00:00:00Z",
  messages: [{ posted_by: "BUYER", time_posted: "2026-10-16T08:00:00Z", content: "It hasn't arrived." }],
} as unknown as DisputeDetail;

const capture = { id: "CAP123", status: "COMPLETED", create_time: "2026-10-10T00:00:00Z" } as unknown as Capture;

const order = (trackers: { id: string; create_time?: string }[]) =>
  ({
    purchase_units: [
      { description: "Handmade ceramic mug", amount: { value: "38.00", currency_code: "SGD" }, shipping: { trackers } },
    ],
  }) as unknown as Order;

test("numbers every fact and message, and notes where each came from", async () => {
  const { buildCaseFileFromData } = await import("./case-file");
  const file = buildCaseFileFromData(dispute, capture, order([]), new Date("2026-10-17T00:00:00Z"));

  assert.deepEqual(
    file.facts.map((f) => f.id),
    file.facts.map((_, i) => `F${i + 1}`),
  );
  assert.ok(file.facts.every((f) => f.source.length > 0));
  assert.equal(file.facts.find((f) => f.label === "Item purchased")?.value, "Handmade ceramic mug");
  assert.equal(file.facts.find((f) => f.label === "Days since payment")?.value, "7");
  assert.deepEqual(file.messages, [{ id: "M1", from: "BUYER", at: "2026-10-16T08:00:00Z", text: "It hasn't arrived." }]);
});

test("says plainly when there is no tracking number", async () => {
  const { buildCaseFileFromData } = await import("./case-file");
  const file = buildCaseFileFromData(dispute, capture, order([]));
  assert.equal(
    file.facts.find((f) => f.label === "Shipping tracking")?.value,
    "No tracking number has been added to this order",
  );
});

test("strips PayPal's capture ID from the tracking number", async () => {
  const { buildCaseFileFromData } = await import("./case-file");
  const file = buildCaseFileFromData(dispute, capture, order([{ id: "CAP123-RR123456785SG" }]));
  assert.equal(file.facts.find((f) => f.label === "Shipping tracking")?.value, "Tracking number RR123456785SG");
});

test("still builds a case file when the order can't be found", async () => {
  const { buildCaseFileFromData } = await import("./case-file");
  const file = buildCaseFileFromData(dispute, null, null);
  assert.equal(file.facts.find((f) => f.label === "Order")?.value, "Could not find the order for this payment");
});
