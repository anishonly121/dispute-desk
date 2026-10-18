// The queue: every open dispute, most urgent first.
import { connection } from "next/server";
import { Suspense } from "react";
import { type DisputeRow, DisputeGrid } from "@/components/dispute-grid";
import { SyncButton } from "@/components/sync-button";
import { prisma } from "@/lib/db";
import { isOperator } from "@/lib/operator";
import { ACTION_SENT, ACTION_SHORT, daysUntil, formatDate, formatShortDate, reasonLabel, statusLabel, statusTone } from "@/lib/labels";

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
    include: {
      recommendations: { orderBy: { createdAt: "desc" }, take: 1 },
      actions: { where: { status: "SUCCEEDED" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const now = new Date();
  const canAct = await isOperator();

  // "Needs a reply" means PayPal is waiting on the seller. A case PayPal is
  // reviewing is still in the grid, but it isn't counted here.
  const open = disputes.filter((d) => d.status === "WAITING_FOR_SELLER_RESPONSE");
  const rows: DisputeRow[] = disputes.map((d) => {
    const rec = d.recommendations[0];
    const lastSent = d.actions[0];
    return {
      id: d.id,
      item: d.itemDescription ?? d.id,
      amount: d.amount.toFixed(2),
      currency: d.currency,
      reason: reasonLabel(d.reason),
      status: statusLabel(d.status),
      statusTone: statusTone(d.status),
      daysLeft: d.sellerResponseDueAt ? daysUntil(d.sellerResponseDueAt, now) : null,
      dueDate: d.sellerResponseDueAt ? formatShortDate(d.sellerResponseDueAt) : null,
      suggestion: rec ? ACTION_SHORT[rec.action] : null,
      confidence: rec?.confidence ?? null,
      // Once the latest suggestion has been sent, say so instead of suggesting it again.
      sent: rec && lastSent?.recommendationId === rec.id ? ACTION_SENT[lastSent.type] : null,
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
      <HowItWorks />
    </>
  );
}

// A short explainer under the queue for first-time visitors. It's a real
// sequence (each step feeds the next), so it's numbered.
const STEPS = [
  {
    title: "A case file from PayPal",
    text: "Each dispute is followed to its payment and order. The item, dates, tracking and buyer messages become numbered facts.",
  },
  {
    title: "AI suggests, code checks",
    text: "Gemini reads only the case file and picks one step. Every reason must cite a fact, and code rejects anything it can't back up.",
  },
  {
    title: "You approve, it's sent once",
    text: "You edit the reply and press send. It goes to PayPal's Disputes API with an idempotency key, and lands in the case history.",
  },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how" className="mt-14 border-t border-line pt-8">
      <h2 id="how" className="text-lg font-bold">
        How it works
      </h2>
      <ol className="mt-4 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-decide text-sm font-bold text-white">
              {i + 1}
            </span>
            <div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
