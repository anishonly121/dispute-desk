import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">No dispute here</h1>
      <p className="mt-3 leading-relaxed text-muted">
        That dispute isn&apos;t in Dispute Desk. If it&apos;s new, it may not have arrived from PayPal yet.
      </p>
      <Link href="/" className="mt-6 inline-block font-medium text-decide-dark hover:underline">
        Back to all disputes
      </Link>
    </main>
  );
}
