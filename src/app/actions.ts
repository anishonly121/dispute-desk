"use server";
// Server actions: functions the browser can call, which run only on the server.

import { revalidatePath } from "next/cache";
import { OperatorError, requireOperator } from "@/lib/operator";
import { syncAllDisputes } from "@/lib/sync";

export async function syncNow() {
  try {
    await requireOperator();
  } catch (error) {
    if (error instanceof OperatorError) return error.message;
    throw error;
  }

  let result;
  try {
    result = await syncAllDisputes();
  } catch (error) {
    // PayPal or the database couldn't be reached. Say so instead of crashing the page.
    console.error("Sync failed:", error);
    return "Couldn't reach PayPal just now. Nothing changed. Try again in a moment.";
  }
  revalidatePath("/");
  return result.failed.length
    ? `Synced ${result.synced} of ${result.total}. Couldn't load: ${result.failed.join(", ")}`
    : `Synced ${result.synced} dispute${result.synced === 1 ? "" : "s"} from PayPal.`;
}
