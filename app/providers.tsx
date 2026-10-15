"use client";

import { useEffect } from "react";
import { useReaderStore } from "@/store/readerStore";

/** Initializes persisted settings (reader prefs) once on app start. */
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
