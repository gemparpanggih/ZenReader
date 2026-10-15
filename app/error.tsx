"use client";

import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-2xl">📚</p>
      <h1 className="text-lg font-semibold text-txt">Something went wrong</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted">
        An unexpected error occurred while rendering this page. Your books are
        safe — reload the page to continue.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="ghost">Back to library</Button>
        </Link>
      </div>
    </div>
  );
}
