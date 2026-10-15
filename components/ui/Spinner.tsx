"use client";

export default function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block size-8 rounded-full border-2 border-line border-t-accent ${className}`}
      style={{ animation: "zr-spin 0.8s linear infinite" }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoading() {
  return (
    <div className="flex h-full min-h-64 flex-1 items-center justify-center p-10">
      <Spinner className="size-10" />
    </div>
  );
}
