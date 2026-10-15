"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";

export default function ToCSidebar({
  open,
  chapters,
  activeIndex,
  onSelect,
  onClose,
}: {
  open: boolean;
  chapters: { index: number; title: string }[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: "center" });
  }, [open, activeIndex]);

  if (!open) return null;

  return (
    <div className="zr-fade-in fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col shadow-2xl"
        style={{ background: "var(--reader-surface)", color: "var(--reader-text)" }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3.5"
          style={{ borderColor: "var(--reader-border)" }}
        >
          <h2 className="text-sm font-semibold">Table of contents</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 transition-opacity hover:opacity-70"
            aria-label="Close table of contents"
          >
            <X className="size-4" />
          </button>
        </div>
        <ul ref={listRef} className="flex-1 overflow-y-auto py-2">
          {chapters.map((c) => {
            const isActive = c.index === activeIndex;
            const isRead = c.index < activeIndex && !isActive;
            return (
              <li key={c.index}>
                <button
                  data-active={isActive}
                  onClick={() => onSelect(c.index)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] leading-snug transition-colors"
                  style={{
                    color: isActive
                      ? "var(--reader-bg)"
                      : "var(--reader-text)",
                    background: isActive
                      ? "var(--reader-accent)"
                      : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLElement).style.background =
                        "color-mix(in srgb, var(--reader-text) 8%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                  }}
                >
                  {isRead && (
                    <Check className="size-3.5 shrink-0" style={{ color: "var(--reader-muted)" }} />
                  )}
                  {!isRead && (
                    <span
                      className="w-4 shrink-0 text-center text-[10px] font-semibold"
                      style={{ color: isActive ? "var(--reader-bg)" : "var(--reader-muted)" }}
                    >
                      {c.index + 1}
                    </span>
                  )}
                  <span className="truncate">{c.title || `Chapter ${c.index + 1}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
