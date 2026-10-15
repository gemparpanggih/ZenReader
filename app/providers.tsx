"use client";

import { useEffect } from "react";
import { useReaderStore } from "@/store/readerStore";

/**
 * Initializes persisted settings (reader prefs) once on app start and
 * mirrors the chosen reading theme onto <html data-theme="…"> so the
 * whole app (library, details, reader) follows the same light/dark/sepia
 * appearance instead of just the reader surface.
 */
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const init = useReaderStore((s) => s.init);
  const theme = useReaderStore((s) => s.settings.theme);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return <>{children}</>;
}
