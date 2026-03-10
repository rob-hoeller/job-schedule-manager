"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function NavBar() {
  const { user, displayName, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  if (loading || !user) return null;

  const name = displayName || user.email?.split("@")[0] || "User";
  const parts = name.split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

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

      {/* Profile avatar + dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 sm:h-10 sm:w-10 sm:text-sm"
          title={name}
        >
          {initials}
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{name}</p>
              <p className="truncate text-[11px] text-gray-400">{user.email}</p>
            </div>
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Profile Settings
            </Link>
            <button
              onClick={() => { setMenuOpen(false); signOut(); }}
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
