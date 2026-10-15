"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  Settings2,
} from "lucide-react";
import { db } from "@/lib/db";
import { useReaderStore } from "@/store/readerStore";
import ToCSidebar from "@/components/reader/ToCSidebar";
import SettingsPanel from "@/components/reader/SettingsPanel";
import { PageLoading } from "@/components/ui/Spinner";

export default function ReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Reader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function Reader({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { id } = use(params);
  const sp = use(searchParams);
  const startChapter =
    sp.c !== undefined ? parseInt(sp.c, 10) : null;

  /* ---------- data ---------- */
  const book = useLiveQuery(() => db.books.get(id), [id]);
  const chaptersRaw = useLiveQuery(
    () => db.chapters.where("bookId").equals(id).sortBy("index"),
    [id]
  );
  const chapters = useMemo(() => chaptersRaw ?? [], [chaptersRaw]);
  const progress = useLiveQuery(() => db.progress.get(id), [id]);
  const settings = useReaderStore((s) => s.settings);

  /* ---------- state ---------- */
  const [chapterIndex, setChapterIndex] = useState<number | null>(null);
  const [scrollPct, setScrollPct] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  /** One-shot scroll target applied when its chapter content mounts. */
  const [restore, setRestore] = useState<{ at: number; pct: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  /* ---------- save helpers ---------- */
  const saveProgress = useCallback(
    (index: number, pct: number) => {
      void db.progress.put({
        bookId: id,
        chapterIndex: index,
        scrollPercent: Math.round(pct * 100) / 100,
        updatedAt: Date.now(),
      });
      void db.books.update(id, { lastReadAt: Date.now() });
    },
    [id]
  );

  /* ---------- seed chapter from URL params or saved progress ----------
     Render-phase state adjustment (React-recommended pattern): runs until
     chapterIndex is set, then short-circuits. */
  if (chapterIndex === null && chapters.length > 0) {
    let ci = 0;
    let restored = false;
    if (startChapter !== null && startChapter >= 0 && startChapter < chapters.length) {
      ci = startChapter;
    } else if (progress && progress.chapterIndex < chapters.length) {
      ci = progress.chapterIndex;
      restored = true;
    }
    setRestore({ at: ci, pct: restored ? progress?.scrollPercent ?? 0 : 0 });
    setChapterIndex(ci);
  }

  /* ---------- navigation ---------- */
  const goChapter = useCallback(
    (target: number) => {
      if (!chapters.length || target < 0 || target >= chapters.length) return;
      setChapterIndex(target);
      setRestore({ at: target, pct: 0 });
      setScrollPct(0);
      saveProgress(target, 0);
      setTocOpen(false);
    },
    [chapters.length, saveProgress]
  );

  /* ---------- scroll: track + debounce-save ---------- */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 100;
    setScrollPct(pct);
    if (chapterIndex === null) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveProgress(chapterIndex, pct), 600);
  }, [chapterIndex, saveProgress]);

  /* restore scroll position when a chapter's content is rendered */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || chapterIndex === null) return;
    const max = el.scrollHeight - el.clientHeight;
    const target = restore?.at === chapterIndex ? restore.pct : 0;
    el.scrollTop = max > 0 ? (target / 100) * max : 0;
  }, [chapterIndex, chapters, restore]);

  /* ---------- keyboard navigation ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        if (tocOpen) setTocOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        return;
      }
      if (tocOpen || settingsOpen) return;

      if (e.key === "ArrowRight" || e.key === "PageUp") {
        e.preventDefault();
        if (chapterIndex !== null) goChapter(chapterIndex + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageDown") {
        if (chapterIndex !== null) goChapter(chapterIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tocOpen, settingsOpen, chapterIndex, goChapter]);

  useEffect(() => {
    if (book && chapters[chapterIndex ?? 0]) {
      document.title = `${chapters[chapterIndex ?? 0].title} — ${book.title} · Zen Reader`;
    } else if (book) {
      document.title = `${book.title} · Zen Reader`;
    }
  }, [book, chapters, chapterIndex]);

  /* ---------- guards ---------- */
  if (!book) {
    if (!ready) return <PageLoading />;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-semibold text-txt">Book not found</p>
        <Link href="/" className="text-sm text-accent underline underline-offset-4">
          Back to library
        </Link>
      </div>
    );
  }

  if (!chapters.length || chapterIndex === null) return <PageLoading />;

  const chapter = chapters[chapterIndex];
  const isLast = chapterIndex === chapters.length - 1;
  const globalPct =
    ((chapterIndex + scrollPct / 100) / chapters.length) * 100;

  const serif =
    "Georgia, 'Times New Roman', 'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', 'Noto Serif CJK SC', SimSun, serif";
  const fontFamily = settings.fontFamily === "serif" ? serif : "inherit";

  return (
    <div
      data-reader-theme={settings.theme}
      className="flex h-dvh flex-col overflow-hidden"
      style={{ background: "var(--reader-bg)", color: "var(--reader-text)" }}
    >
      {/* top progress bar */}
      <div
        className="h-0.5 shrink-0"
        style={{ background: "var(--reader-border)" }}
      >
        <div
          className="h-full transition-[width] duration-200"
          style={{ width: `${globalPct}%`, background: "var(--reader-accent)" }}
        />
      </div>

      {/* top bar */}
      <header
        className="flex h-12 shrink-0 items-center gap-2 px-2 sm:px-4"
        style={{ background: "var(--reader-surface)" }}
      >
        <Link
          href={`/book/${id}`}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: "var(--reader-muted)" }}
          aria-label="Back to book details"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Library</span>
        </Link>
        <div className="mx-1 h-5 w-px shrink-0" style={{ background: "var(--reader-border)" }} />
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[13px] font-semibold leading-tight">
            {book.title}
          </p>
          <p
            className="truncate text-[11px] leading-tight"
            style={{ color: "var(--reader-muted)" }}
          >
            {chapter.title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setTocOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:opacity-70"
            style={{ color: "var(--reader-text)" }}
          >
            <List className="size-4" />
            <span className="hidden sm:inline">Contents</span>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-2 transition-colors hover:opacity-70"
            style={{ color: "var(--reader-text)" }}
            aria-label="Reading settings"
          >
            <Settings2 className="size-4" />
          </button>
        </div>
      </header>

      {/* scroll area */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        <article
          className="mx-auto px-5 py-10 sm:px-8"
          style={{ maxWidth: Math.max(settings.maxWidth, 420) }}
        >
          <h1
            className="mb-8 text-center text-xl font-bold sm:text-2xl"
            style={{ color: "var(--reader-text)" }}
          >
            {chapter.title}
          </h1>
          <div
            className="reader-content"
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              letterSpacing: `${settings.letterSpacing}em`,
              fontFamily,
            }}
            // content is sanitized at parse time (txt: escaped; epub: DOMPurify)
            dangerouslySetInnerHTML={{ __html: chapter.content }}
          />

          {/* end of book */}
          {isLast && (
            <div
              className="mt-14 rounded-2xl border px-6 py-8 text-center"
              style={{ borderColor: "var(--reader-border)" }}
            >
              <p className="text-sm" style={{ color: "var(--reader-muted)" }}>
                You&apos;ve reached the end of{" "}
                <span className="font-semibold" style={{ color: "var(--reader-text)" }}>
                  {book.title}
                </span>
              </p>
              <Link
                href={`/book/${id}`}
                className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
                style={{ color: "var(--reader-accent)" }}
              >
                Back to book details
              </Link>
            </div>
          )}
        </article>
      </div>

      {/* bottom bar */}
      <footer
        className="flex h-14 shrink-0 items-center justify-between px-4"
        style={{
          background: "var(--reader-surface)",
          borderTop: `1px solid var(--reader-border)`,
        }}
      >
        <button
          onClick={() => goChapter(chapterIndex - 1)}
          disabled={chapterIndex === 0}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
          style={{ color: "var(--reader-text)" }}
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <button
          onClick={() => setTocOpen(true)}
          className="rounded-lg px-3 py-1.5 text-[11px] tabular-nums"
          style={{ color: "var(--reader-muted)" }}
        >
          Ch. {chapterIndex + 1}/{chapters.length} · {Math.round(globalPct)}%
        </button>

        <button
          onClick={() => goChapter(chapterIndex + 1)}
          disabled={isLast}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
          style={{ color: "var(--reader-text)" }}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </button>
      </footer>

      {/* drawers */}
      <ToCSidebar
        open={tocOpen}
        chapters={chapters.map((c) => ({ index: c.index, title: c.title }))}
        activeIndex={chapterIndex}
        onSelect={goChapter}
        onClose={() => setTocOpen(false)}
      />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
