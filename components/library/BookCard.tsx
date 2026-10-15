"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, MoreHorizontal, Trash2 } from "lucide-react";
import { CoverArt } from "./CoverArt";
import type { Book, ReadingProgress } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

export default function BookCard({
  book,
  progress,
  onDelete,
}: {
  book: Book;
  progress?: ReadingProgress;
  onDelete: (book: Book) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const readPercent =
    progress && book.chapterCount > 0
      ? Math.min(100, Math.round(((progress.chapterIndex + 1) / book.chapterCount) * 100))
      : 0;

  return (
    <div className="group relative flex flex-col rounded-xl border border-line bg-surface transition-colors hover:border-[var(--accent)]/40 hover:bg-surface-2">
      <Link href={`/book/${book.id}`} className="flex flex-col p-3 pb-2">
        <div className="relative mb-3 overflow-hidden rounded-lg">
          <CoverArt
            book={book}
            className="aspect-[2/3] w-full transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute right-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
            {book.fileFormat}
          </span>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-txt">
          {book.title}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">
          {book.author || "Unknown author"}
        </p>
      </Link>

      <div className="px-3 pb-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
          <span>{book.chapterCount} chapters</span>
          <span>{formatRelative(book.lastReadAt)}</span>
        </div>
        {progress ? (
          <div className="h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${readPercent}%` }}
            />
          </div>
        ) : (
          <div className="h-1 w-full rounded-full bg-line/60" />
        )}
      </div>

      {/* ⋯ menu */}
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          className="rounded-md bg-black/50 p-1 text-white/80 backdrop-blur-sm hover:bg-black/70 hover:text-white"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Book options"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-line bg-surface-2 shadow-2xl"
          >
            <Link
              href={`/book/${book.id}/read`}
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-xs text-txt hover:bg-surface"
              onClick={() => setMenuOpen(false)}
            >
              <BookOpen className="size-3.5 text-accent" /> Continue reading
            </Link>
            <button
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-xs text-danger hover:bg-danger-soft"
              onClick={() => {
                setMenuOpen(false);
                onDelete(book);
              }}
            >
              <Trash2 className="size-3.5" /> Remove book
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
