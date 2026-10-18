"use client";

import { useState, useTransition } from "react";
import { suggestAction } from "@/app/disputes/[id]/actions";

type Props = { disputeId: string; label: string; canAct: boolean };

export function SuggestButton({ disputeId, label, canAct }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending || !canAct}
        title={canAct ? undefined : "Unlock sending to get a new suggestion"}
        onClick={() => startTransition(async () => setError(await suggestAction(disputeId)))}
        className="rounded-md border border-line bg-sheet px-3 py-2 text-sm font-medium hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Reading the case file..." : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-risk">
          {error}
        </p>
      )}
    </div>
  );
}
