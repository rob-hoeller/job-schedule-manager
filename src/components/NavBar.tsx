"use client";

import { useAuth } from "./AuthProvider";

export function NavBar() {
  const { user, displayName, loading, signOut } = useAuth();

  if (loading || !user) return null;

  const name = displayName || user.email?.split("@")[0] || "User";

  return (
    <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Job Schedule Manager
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Select a job to view its schedule
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-400">{name}</span>
        <button
          onClick={signOut}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
