export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Job Schedule Manager
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Construction schedule management for Schell Brothers.
          List, Calendar, and Gantt views — coming soon.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          {["List", "Calendar", "Gantt"].map((view) => (
            <span
              key={view}
              className="rounded-full border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400"
            >
              {view}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
