"use client";

import { useEffect } from "react";
import { useReaderStore } from "@/store/readerStore";

/**
 * Initializes persisted settings (reader prefs) once on app start.
 * Reader themes are exclusive to the reading page — the rest of the app
 * keeps the default dark palette, so nothing is mirrored onto <html>.
 */
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const init = useReaderStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return <>{children}</>;
}
