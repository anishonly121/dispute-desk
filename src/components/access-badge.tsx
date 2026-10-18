// Top-right of the header: shows whether this browser can send, with the way
// to switch. It reads a cookie, so it renders per request inside a Suspense.
import Link from "next/link";
import { lock } from "@/app/unlock/actions";
import { isOperator } from "@/lib/operator";

export async function AccessBadge() {
  if (await isOperator()) {
    return (
      <form action={lock}>
        <button type="submit" className="rounded border border-line px-2 py-0.5 text-sm text-muted hover:border-ink">
          Lock sending
        </button>
      </form>
    );
  }
  return (
    <Link href="/unlock" className="rounded border border-line px-2 py-0.5 text-sm text-muted hover:border-ink">
      Read-only. Unlock
    </Link>
  );
}
