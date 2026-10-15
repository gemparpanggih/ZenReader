"use client";

import { FileText } from "lucide-react";
import { useObjectUrl } from "@/lib/useObjectUrl";
import type { Book } from "@/lib/types";

/** Deterministic gradient from a string (used for books without covers). */
function gradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash) % 360;
  return `linear-gradient(150deg, hsl(${h} 45% 32%), hsl(${(h + 40) % 360} 55% 20%))`;
}

export function CoverArt({
  book,
  className = "",
}: {
  book: Pick<Book, "title" | "cover">;
  className?: string;
}) {
  const url = useObjectUrl(book.cover ?? null);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`Cover of ${book.title}`}
        className={`object-cover ${className}`}
        draggable={false}
      />
    );
  }

  const letter = (book.title.trim()[0] ?? "?").toUpperCase();

  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 ${className}`}
      style={{ background: gradientFor(book.title) }}
    >
      <span className="select-none text-4xl font-bold text-white/90 drop-shadow">
        {letter}
      </span>
      <FileText className="size-3.5 text-white/50" aria-hidden />
    </div>
  );
}
