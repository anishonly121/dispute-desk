"use client";

import { useActionState } from "react";
import { unlock } from "@/app/unlock/actions";

export function UnlockForm() {
  const [error, formAction, pending] = useActionState(unlock, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className="font-semibold">Operator key</span>
        <input
          name="key"
          type="password"
          autoComplete="off"
          required
          className="mt-1 w-full rounded-md border border-line bg-sheet px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-decide px-4 py-3 font-semibold text-white hover:bg-decide-dark disabled:opacity-60"
      >
        {pending ? "Checking..." : "Unlock sending"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-risk">
          {error}
        </p>
      )}
    </form>
  );
}
