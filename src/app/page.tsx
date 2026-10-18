// The queue: every open dispute, most urgent first.
import { connection } from "next/server";
import { Suspense } from "react";
import { type DisputeRow, DisputeGrid } from "@/components/dispute-grid";
import { SyncButton } from "@/components/sync-button";
import { prisma } from "@/lib/db";
import { isOperator } from "@/lib/operator";
import { ACTION_SHORT, daysUntil, formatDate, formatShortDate, reasonLabel, statusLabel } from "@/lib/labels";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-muted">Loading disputes...</p>}>
        <Queue />
      </Suspense>
    </main>
  );
}

async function Queue() {
  // The queue is live data, so render it per request instead of prerendering it.
  await connection();
  const disputes = await prisma.dispute.findMany({
    include: { recommendations: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const now = new Date();
  const canAct = await isOperator();

  // "Needs a reply" means PayPal is waiting on the seller. A case PayPal is
  // reviewing is still in the grid, but it isn't counted here.
  const open = disputes.filter((d) => d.status === "WAITING_FOR_SELLER_RESPONSE");
  const rows: DisputeRow[] = disputes.map((d) => {
    const rec = d.recommendations[0];
    return {
      id: d.id,
      item: d.itemDescription ?? d.id,
      amount: d.amount.toFixed(2),
      currency: d.currency,
      reason: reasonLabel(d.reason),
      status: statusLabel(d.status),
      daysLeft: d.sellerResponseDueAt ? daysUntil(d.sellerResponseDueAt, now) : null,
      dueDate: d.sellerResponseDueAt ? formatShortDate(d.sellerResponseDueAt) : null,
      suggestion: rec ? ACTION_SHORT[rec.action] : null,
      confidence: rec?.confidence ?? null,
    };
  });

  const nextDue = open
    .map((d) => d.sellerResponseDueAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const atStake = open.reduce((sum, d) => sum + d.amount.toNumber(), 0);
  const currencies = [...new Set(open.map((d) => d.currency))];

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {open.length === 0
              ? "No disputes need a reply."
              : `${open.length} dispute${open.length === 1 ? " needs" : "s need"} a reply.`}
            {nextDue && ` The first is due ${formatDate(nextDue)}.`}
          </h1>
          {open.length > 0 && (
            <p className="mt-3 text-lg text-muted">
              {atStake.toFixed(2)} {currencies.join(" / ")} is at stake. Open a case to see the evidence and a
              suggested reply you can edit before sending.
            </p>
          )}
        </div>
        <SyncButton canAct={canAct} />
      </div>
      <DisputeGrid rows={rows} />
    </>
  );
}
