"use client";

import { useUser, SignInButton, SignOutButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";

export function AuthStrip() {
  const { user, isLoaded } = useUser();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/credits", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { balance: 0 }))
      .then((d) => setCredits(d.balance ?? 0))
      .catch(() => setCredits(0));
  }, [isLoaded, user]);

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <SignInButton mode="modal">
        <button className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">
          Sign in
        </button>
      </SignInButton>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={user.primaryEmailAddress?.emailAddress}>
        {user.firstName ?? user.primaryEmailAddress?.emailAddress ?? "User"}
      </span>
      {credits !== null && (
        <>
          <span className="text-xs text-gray-600 dark:text-gray-300" title="AI credits">
            {credits} credits
          </span>
          <button
            type="button"
            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            onClick={async () => {
              try {
                const res = await fetch("/api/stripe/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ amount: 50 }),
                });
                const data = await res.json();
                if (data?.url) window.location.href = data.url;
              } catch {
                // ignore
              }
            }}
          >
            Buy credits
          </button>
        </>
      )}
      <SignOutButton signOutOptions={{ redirectUrl: "/editor" }}>
        <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          Sign out
        </button>
      </SignOutButton>
    </div>
  );
}
