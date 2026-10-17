"use server";
// Server actions: functions the browser can call, which run only on the server.

import { revalidatePath } from "next/cache";
import { syncAllDisputes } from "@/lib/sync";

export async function syncNow() {
  const result = await syncAllDisputes();
  revalidatePath("/");
  return result.failed.length
    ? `Synced ${result.synced} of ${result.total}. Couldn't load: ${result.failed.join(", ")}`
    : `Synced ${result.synced} dispute${result.synced === 1 ? "" : "s"} from PayPal.`;
}
