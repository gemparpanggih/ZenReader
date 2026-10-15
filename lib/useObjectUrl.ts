"use client";

import { useEffect, useState } from "react";

/** Create + revoke an object URL for a Blob (e.g. book covers). */
export function useObjectUrl(blob?: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!blob) {
      // Defer so the update is async (avoids cascading-render warning).
      queueMicrotask(() => {
        if (active) setUrl(null);
      });
      return;
    }
    const u = URL.createObjectURL(blob);
    queueMicrotask(() => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(u);
    };
  }, [blob]);

  return url;
}
