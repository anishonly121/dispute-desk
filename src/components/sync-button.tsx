"use client";

import { useState, useTransition } from "react";
import { syncNow } from "@/app/actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="flex items-center gap-3">
      <span role="status" className="text-sm text-muted">
        {message}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setMessage(await syncNow()))}
        className="rounded-md border border-line bg-sheet px-3 py-2 text-sm font-medium hover:border-ink disabled:opacity-60"
      >
        {pending ? "Syncing..." : "Sync with PayPal"}
      </button>
    </div>
  );
}
