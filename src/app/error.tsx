"use client";
// Shown when a page fails to load, for example if the database or PayPal can't
// be reached. Nothing is ever sent from a page load, so retrying is safe.

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">This page couldn&apos;t load</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Dispute Desk couldn&apos;t reach its database or PayPal. Nothing was sent. Try again in a moment.
        {error.digest && ` If it keeps happening, the server log has the details under ${error.digest}.`}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-decide px-4 py-2 font-semibold text-white hover:bg-decide-dark"
      >
        Try again
      </button>
    </main>
  );
}
