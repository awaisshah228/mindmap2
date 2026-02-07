import type { Metadata } from "next";
import Link from "next/link";
import { SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Smart diagrams from text",
  description:
    "Generate architecture diagrams, mind maps, flowcharts, and Excalidraw sketches with AI. Use without signing in — data is saved in your browser. Sign in for cloud sync.",
  openGraph: {
    title: "Smart diagrams from text",
    description:
      "Generate architecture diagrams, mind maps, flowcharts, and Excalidraw sketches with AI. Try free, no sign-in required.",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold text-lg text-gray-900 dark:text-white">AI Diagram</span>
          <nav className="flex items-center gap-4">
            <Link
              href="/editor"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Open app
            </Link>
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">
                  Sign up
                </button>
              </SignUpButton>
              <Link href="/sign-in" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Sign in
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/admin" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                Admin
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <section className="text-center mb-20">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Smart diagrams from text
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
            Generate architecture diagrams, mind maps, and flowcharts with AI. Use without signing in — data is saved in your browser. Sign in for cloud sync and plans.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/editor"
              className="inline-block rounded-lg bg-violet-600 px-6 py-3 text-base font-medium text-white hover:bg-violet-500"
            >
              Try it — no sign-in required
            </Link>
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="rounded-lg border border-violet-600 text-violet-600 dark:text-violet-400 px-6 py-3 text-base font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20">
                  Sign up for cloud sync
                </button>
              </SignUpButton>
            </SignedOut>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AI-powered</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Describe your system or flow in plain English; get a clean diagram in seconds.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Export & share</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Export to PNG/SVG. When not signed in, projects are saved in your browser only; sign in for cloud sync.
            </p>
          </div>
          <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Fair pricing</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Free trial to start. Paid plans and on-demand credits so you only pay for what you use.
            </p>
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-10">Plans that cover our costs</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Free trial</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">$0</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">5 diagram generations</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• No card required</li>
                <li>• Full editor access</li>
              </ul>
              <SignUpButton mode="modal">
                <button className="mt-4 w-full rounded-lg border border-violet-600 text-violet-600 dark:text-violet-400 px-4 py-2 text-sm font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20">
                  Start free
                </button>
              </SignUpButton>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-violet-200 dark:border-violet-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Starter</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">$5<span className="text-sm font-normal text-gray-500">/mo</span></p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">50 diagrams/month (expire each month)</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Cloud project sync</li>
                <li>• Export & share</li>
              </ul>
              <Link
                href="/editor"
                className="mt-4 block w-full text-center rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-500"
              >
                Subscribe in app
              </Link>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Pro</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">$29<span className="text-sm font-normal text-gray-500">/mo</span></p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">200 diagrams/month</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Everything in Starter</li>
                <li>• Higher limits</li>
              </ul>
              <Link
                href="/editor"
                className="mt-4 block w-full text-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Subscribe in app
              </Link>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Credit pack</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">$9</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">50 credits (never expire)</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Top up anytime</li>
                <li>• No subscription, credits don&apos;t expire</li>
              </ul>
              <Link
                href="/editor"
                className="mt-4 block w-full text-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Buy in app
              </Link>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Pricing is set to cover AI and infrastructure costs. 1 credit = 1 diagram generation.
          </p>
        </section>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link href="/editor" className="hover:text-gray-900 dark:hover:text-white">Go to app</Link>
        </div>
      </footer>
    </div>
  );
}
