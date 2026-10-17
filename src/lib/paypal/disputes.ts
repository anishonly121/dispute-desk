import { paypalRequest } from "./client";
import type { DisputeDetail, DisputeList, DisputeSummary } from "./types";

// Safety stop so a bad "next" link can never loop forever.
const MAX_PAGES = 20;

// PayPal returns disputes a page at a time, with a "next" link while more pages exist.
export async function listDisputes(): Promise<DisputeSummary[]> {
  const all: DisputeSummary[] = [];
  let next: string | undefined = "/v1/customer/disputes";

  for (let page = 0; next && page < MAX_PAGES; page++) {
    const result: DisputeList = await paypalRequest<DisputeList>(next);
    all.push(...(result.items ?? []));
    next = result.links?.find((link) => link.rel === "next")?.href;
  }
  return all;
}

export function getDispute(disputeId: string): Promise<DisputeDetail> {
  return paypalRequest<DisputeDetail>(`/v1/customer/disputes/${encodeURIComponent(disputeId)}`);
}
