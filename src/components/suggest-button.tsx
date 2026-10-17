"use client";

import { useState, useTransition } from "react";
import { suggestAction } from "@/app/disputes/[id]/actions";

export function SuggestButton({ disputeId, label }: { disputeId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setError(await suggestAction(disputeId)))}
        className="rounded-md border border-line bg-sheet px-3 py-2 text-sm font-medium hover:border-ink disabled:opacity-60"
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
