import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await isAdmin();
  if (!ok) redirect("/editor");
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <a href="/admin" className="font-semibold text-violet-400">Admin</a>
        <Link href="/editor" className="text-sm text-gray-400 hover:text-gray-200">Back to app</Link>
      </header>
      {children}
    </div>
  );
}
