// One dispute: the case file on the left, the suggested next step on the right,
// and a history of everything sent to PayPal.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { type PanelRecommendation, RecommendationPanel } from "@/components/recommendation-panel";
import { SuggestButton } from "@/components/suggest-button";
import type { CaseFile } from "@/lib/case-file";
import { prisma } from "@/lib/db";
import { daysUntil, displayFactValue, formatDate, reasonLabel, stageLabel, statusLabel } from "@/lib/labels";
import { isOperator } from "@/lib/operator";
import { allowedActions, getDispute } from "@/lib/paypal/disputes";

export default function DisputePage({ params }: PageProps<"/disputes/[id]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm font-medium text-decide-dark hover:underline">
        Back to all disputes
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading case...</p>}>
        <Case params={params} />
      </Suspense>
    </main>
  );
}

// Ask PayPal what's allowed right now. If PayPal can't be reached, the page still
// loads and the approval is checked again on the server when it's sent.
async function loadAllowed(id: string) {
  try {
    return [...allowedActions(await getDispute(id))];
  } catch {
    return null;
  }
}

async function Case({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dispute = await prisma.dispute.findUnique({
    where: { id: decodeURIComponent(id) },
    include: {
      recommendations: { orderBy: { createdAt: "desc" }, take: 1 },
      actions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!dispute) notFound();

  const [allowed, canAct] = await Promise.all([loadAllowed(dispute.id), isOperator()]);
  const caseFile = dispute.caseFile as unknown as CaseFile | null;
  const latest = dispute.recommendations[0];
  const amount = dispute.amount.toFixed(2);
  const now = new Date();
  const daysLeft = dispute.sellerResponseDueAt ? daysUntil(dispute.sellerResponseDueAt, now) : null;

  const rec: PanelRecommendation | null = latest
    ? {
        id: latest.id,
        action: latest.action,
        confidence: latest.confidence,
        summary: latest.summary,
        reasons: latest.reasons as PanelRecommendation["reasons"],
        offerAmount: latest.offerAmount?.toFixed(2) ?? null,
        draft: latest.draft,
        model: latest.model,
      }
    : null;
  const alreadySent = latest ? dispute.actions.some((a) => a.recommendationId === latest.id && a.status !== "FAILED") : false;

  return (
    <>
      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{dispute.itemDescription ?? dispute.id}</h1>
        <p className="mt-2 text-lg text-muted">
          {amount} {dispute.currency} disputed as {reasonLabel(dispute.reason).toLowerCase()}.{" "}
          {stageLabel(dispute.stage)} stage, {statusLabel(dispute.status).toLowerCase()}.
        </p>
        {dispute.sellerResponseDueAt && daysLeft !== null && (
          <p className={`mt-3 inline-block rounded-md px-3 py-1 font-semibold ${daysLeft <= 5 ? "bg-due-wash text-due" : "bg-sheet text-ink"}`}>
            Reply by {formatDate(dispute.sellerResponseDueAt)}, {daysLeft} day{daysLeft === 1 ? "" : "s"} left
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section aria-labelledby="case-file">
          <div className="flex items-baseline justify-between">
            <h2 id="case-file" className="text-xl font-bold">Case file</h2>
            {dispute.caseFileBuiltAt && (
              <span className="text-sm text-muted">Built from PayPal data {formatDate(dispute.caseFileBuiltAt)}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            The suggestion can only use these facts, and every reason it gives points back to one.
          </p>

          {caseFile ? (
            <>
              <ol className="mt-4 divide-y divide-line rounded-lg border border-line bg-sheet">
                {caseFile.facts.map((fact) => (
                  <li key={fact.id} id={`fact-${fact.id}`} className="grid grid-cols-[3rem_1fr] gap-3 px-4 py-3">
                    <span className="font-semibold text-decide-dark">{fact.id}</span>
                    <div>
                      <div className="text-sm text-muted">{fact.label}</div>
                      <div className="break-words">{displayFactValue(fact.label, fact.value)}</div>
                    </div>
                  </li>
                ))}
              </ol>

              <h3 className="mt-6 font-semibold">Messages</h3>
              {caseFile.messages.length === 0 && <p className="mt-2 text-muted">No messages yet.</p>}
              <ol className="mt-2 space-y-3">
                {caseFile.messages.map((msg) => (
                  <li key={msg.id} id={`fact-${msg.id}`} className="grid grid-cols-[3rem_1fr] gap-3 rounded-lg border border-line bg-sheet px-4 py-3">
                    <span className="font-semibold text-decide-dark">{msg.id}</span>
                    <blockquote>
                      <div className="text-sm text-muted">
                        {msg.from === "BUYER" ? "Buyer" : "You"}
                        {!Number.isNaN(Date.parse(msg.at)) && `, ${formatDate(new Date(msg.at))}`}
                      </div>
                      <p className="mt-1 leading-relaxed">{msg.text}</p>
                    </blockquote>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-muted">
              No case file yet. Getting a suggestion builds it from PayPal first.
            </p>
          )}
        </section>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {rec ? (
            <>
              <RecommendationPanel
                key={rec.id}
                disputeId={dispute.id}
                amount={amount}
                currency={dispute.currency}
                rec={rec}
                allowed={allowed}
                alreadySent={alreadySent}
                canAct={canAct}
              />
              <SuggestButton disputeId={dispute.id} label="Get a new suggestion" canAct={canAct} />
            </>
          ) : (
            <div className="rounded-lg border border-line bg-sheet p-5">
              <h2 className="text-xl font-bold">No suggestion yet</h2>
              <p className="mt-2 mb-4 text-muted">
                Dispute Desk reads the case file and suggests one next step, with a reply you can edit.
              </p>
              <SuggestButton disputeId={dispute.id} label="Get a suggestion" canAct={canAct} />
            </div>
          )}

          <section aria-labelledby="history">
            <h2 id="history" className="text-xl font-bold">Sent to PayPal</h2>
            {dispute.actions.length === 0 ? (
              <p className="mt-2 text-muted">Nothing sent yet.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {dispute.actions.map((action) => (
                  <li key={action.id} className="rounded-lg border border-line bg-sheet px-4 py-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold">{action.type.replace(/_/g, " ").toLowerCase()}</span>
                      <span className={action.status === "SUCCEEDED" ? "text-decide-dark" : action.status === "FAILED" ? "text-risk" : "text-muted"}>
                        {action.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-1 text-muted">
                      {action.createdAt.toLocaleString("en-SG")}. Request ID {action.idempotencyKey}
                    </div>
                    {action.error && <div className="mt-1 text-risk">{action.error}</div>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
