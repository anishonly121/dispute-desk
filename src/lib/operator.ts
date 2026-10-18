// Who is allowed to act. The live demo is public, so anyone can read the queue
// and the case files. Only someone with the operator key can send to PayPal,
// ask Gemini for a suggestion, or run a sync. Everyone else gets a read-only view.
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const OPERATOR_COOKIE = "dd_operator";

export class OperatorError extends Error {}

// The cookie holds a hash of the key, never the key itself.
export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

// Compare in constant time so the check doesn't leak how much of a guess was right.
export function matchesKey(candidateHash: string) {
  const key = process.env.OPERATOR_KEY;
  if (!key) return false; // no key set means nobody can act
  const expected = hashKey(key);
  if (candidateHash.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidateHash), Buffer.from(expected));
}

export async function isOperator() {
  const value = (await cookies()).get(OPERATOR_COOKIE)?.value;
  return value ? matchesKey(value) : false;
}

// Every server action that changes something calls this first. Hiding a button
// isn't enough, because anyone can call a server action directly.
export async function requireOperator() {
  if (!(await isOperator())) {
    throw new OperatorError("This is a read-only demo. Unlock sending with the operator key first.");
  }
}
