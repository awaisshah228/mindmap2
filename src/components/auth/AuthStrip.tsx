"use client";

import { useUser, SignInButton, SignOutButton } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import { PRICE_PER_CREDIT_CENTS } from "@/lib/plans";

export function AuthStrip() {
  const { user, isLoaded } = useUser();
  const [credits, setCredits] = useState<number | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyAmount, setBuyAmount] = useState(50);
  const [buying, setBuying] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/credits", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { balance: 0 }))
      .then((d) => setCredits(d.balance ?? 0))
      .catch(() => setCredits(0));
  }, [isLoaded, user]);

  // Close popover on click outside
  useEffect(() => {
    if (!buyOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setBuyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [buyOpen]);

  const pricePerCredit = PRICE_PER_CREDIT_CENTS / 100;
  const totalPrice = ((buyAmount * PRICE_PER_CREDIT_CENTS) / 100).toFixed(2);

  const handleBuy = async () => {
    setBuying(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: buyAmount }),
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setBuying(false);
    }
  };

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
    <div className="flex items-center gap-3 relative">
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={user.primaryEmailAddress?.emailAddress}>
        {user.firstName ?? user.primaryEmailAddress?.emailAddress ?? "User"}
      </span>
      {credits !== null && (
        <div ref={popoverRef} className="relative">
          <span className="text-xs text-gray-600 dark:text-gray-300" title="AI credits">
            {credits} credits
          </span>
          <button
            type="button"
            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline ml-1"
            onClick={() => setBuyOpen((o) => !o)}
          >
            Buy credits
          </button>
          {buyOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 w-64 p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                ${pricePerCredit.toFixed(2)} per credit — buy as many as you want
              </p>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  min={10}
                  max={5000}
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(Math.max(10, Math.min(5000, parseInt(e.target.value, 10) || 10)))}
                  className="w-20 px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">credits</span>
              </div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                Total: ${totalPrice}
              </p>
              <button
                type="button"
                disabled={buying}
                onClick={handleBuy}
                className="w-full py-2 px-3 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {buying ? "Loading…" : `Buy ${buyAmount} credits`}
              </button>
            </div>
          )}
        </div>
      )}
      <SignOutButton signOutOptions={{ redirectUrl: "/editor" }}>
        <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          Sign out
        </button>
      </SignOutButton>
    </div>
  );
}
