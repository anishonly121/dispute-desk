import assert from "node:assert/strict";
import { test } from "node:test";
import { displayFactValue, reasonLabel, statusTone } from "./labels";

test("PayPal codes are shown in plain English", () => {
  assert.equal(reasonLabel("MERCHANDISE_OR_SERVICE_NOT_RECEIVED"), "Not received");
  assert.equal(reasonLabel("SOME_NEW_CODE"), "Some new code"); // a code PayPal adds later
  assert.equal(displayFactValue("Dispute stage", "INQUIRY (WAITING_FOR_SELLER_RESPONSE)"), "Inquiry, your reply needed");
});

test("statuses are grouped by who has to act", () => {
  assert.equal(statusTone("WAITING_FOR_SELLER_RESPONSE"), "due");
  assert.equal(statusTone("UNDER_REVIEW"), "wait");
  assert.equal(statusTone("RESOLVED"), "done");
});
