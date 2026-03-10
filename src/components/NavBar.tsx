"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function NavBar() {
  const { user, displayName, loading, signOut } = useAuth();

  if (loading || !user) return null;

  const name = displayName || user.email?.split("@")[0] || "User";

  return (
    <div className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-800">
      <div>
        <h1 className="text-lg font-bold tracking-tight sm:text-3xl">
          Job Schedule Manager
        </h1>
        <p className="mt-0.5 hidden text-sm text-gray-500 dark:text-gray-400 sm:block">
          Select a job to view its schedule
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/profile"
          className="text-xs text-gray-600 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-gray-200 sm:text-sm"
        >
          {name}
        </Link>
        <button
          onClick={signOut}
          className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 sm:px-3 sm:py-1.5 sm:text-xs"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
