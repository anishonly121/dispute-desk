import assert from "node:assert/strict";
import { test } from "node:test";
import { hashKey, matchesKey } from "./operator";

test("only the operator key unlocks sending", () => {
  process.env.OPERATOR_KEY = "correct-horse";
  assert.equal(matchesKey(hashKey("correct-horse")), true);
  assert.equal(matchesKey(hashKey("wrong")), false);
  assert.equal(matchesKey("not-a-hash"), false);
});

test("nobody can unlock when no key is set", () => {
  delete process.env.OPERATOR_KEY;
  assert.equal(matchesKey(hashKey("")), false);
});
