import { UnlockForm } from "@/components/unlock-form";

export default function UnlockPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Unlock sending</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Anyone can browse the disputes and case files. To get new suggestions, sync with PayPal, or send replies and
        offers, enter the operator key.
      </p>
      <UnlockForm />
    </main>
  );
}
