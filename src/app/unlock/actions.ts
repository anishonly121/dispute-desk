"use server";
// Unlock and lock sending for this browser.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, hashKey, matchesKey } from "@/lib/operator";

export async function unlock(_previous: string | null, formData: FormData) {
  const hash = hashKey(String(formData.get("key") ?? "").trim());
  if (!matchesKey(hash)) return "That key isn't right. Check it and try again.";

  (await cookies()).set(OPERATOR_COOKIE, hash, {
    httpOnly: true, // page scripts can't read it
    secure: process.env.NODE_ENV === "production", // only sent over HTTPS on the live site
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  redirect("/");
}

export async function lock() {
  (await cookies()).delete(OPERATOR_COOKIE);
  redirect("/");
}
