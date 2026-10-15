"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Library, Search, Upload } from "lucide-react";
import { db, deleteBook } from "@/lib/db";
import { importBookFile } from "@/lib/importer";
import type { Book } from "@/lib/types";
import { pluralize } from "@/lib/utils";import BookCard from "@/components/library/BookCard";
import ImportProgressModal, {
  type QueueItem,
} from "@/components/library/ImportProgressModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Button from "@/components/ui/Button";

type SortKey = "recent" | "added" | "title";
const ACCEPT = ".txt,.md,.epub,.pdf";

export default function LibraryPage() {
  const booksRaw = useLiveQuery(
    () => db.books.orderBy("createdAt").reverse().toArray(),
    []
  );
  const books = useMemo(() => booksRaw ?? [], [booksRaw]);
  const progressListRaw = useLiveQuery(() => db.progress.toArray(), []);
  const progressList = useMemo(() => progressListRaw ?? [], [progressListRaw]);

  const progressMap = useMemo(
    () => new Map(progressList.map((p) => [p.bookId, p])),
    [progressList]
  );

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    document.title = "Zen Reader — Library";
  }, []);

  /* ---------- processing ---------- */
  const processFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const items: QueueItem[] = list.map((file) => ({ file, status: "queued" }));
    setQueue(items);

    for (let i = 0; i < items.length; i++) {
      const setItem = (patch: Partial<QueueItem>) =>
        setQueue((q) => q.map((it, j) => (j === i ? { ...it, ...patch } : it)));

      try {
        setItem({ status: "parsing", progress: 0 });
        await importBookFile(items[i].file, (stage, percent) => {
          setItem(
            stage === "saving"
              ? { status: "saving" }
              : { status: "parsing", progress: percent }
          );
        });
        setItem({ status: "done", progress: 100 });
      } catch (err) {
        console.error("Import failed:", err);
        setItem({
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  };

  /* ---------- global drag & drop ---------- */
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current++;
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (e.dataTransfer?.files?.length) {
        void processFiles(e.dataTransfer.files);
      }
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  /* ---------- filtering & sorting ---------- */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = books.filter((b) => {
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        (b.author ?? "").toLowerCase().includes(q) ||
        (b.genre ?? "").toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    switch (sort) {
      case "recent":
        sorted.sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0));
        break;
      case "added":
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [books, query, sort]);

  const importDone = queue.length > 0 && queue.every((i) => i.status === "done" || i.status === "error");

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---------- header ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <BookOpen className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-txt">
                Zen Reader
              </h1>
              <p className="-mt-0.5 text-[11px] text-muted">
                Your local reading library
              </p>
            </div>
          </div>
          <Button onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" />
            Import books
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {/* ---------- toolbar ---------- */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, author, genre…"
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-txt placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              {pluralize(visible.length, "book")}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-txt focus:border-accent focus:outline-none"
            >
              <option value="recent">Last read</option>
              <option value="added">Recently added</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
        </div>

        {/* ---------- empty state ---------- */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line bg-surface/40 px-6 py-20 text-center">
            <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Library className="size-8" />
            </span>
            <h2 className="text-lg font-semibold text-txt">
              {books.length === 0
                ? "Your library is empty"
                : "No books match your search"}
            </h2>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
              {books.length === 0
                ? "Import .txt, .md, .epub or .pdf novels — everything stays on your device."
                : "Try a different keyword or clear the search."}
            </p>
            {books.length === 0 && (
              <Button className="mt-6" onClick={() => inputRef.current?.click()}>
                <Upload className="size-4" />
                Choose files
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visible.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                progress={progressMap.get(book.id)}
                onDelete={(b) => setDeleteTarget(b)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ---------- hidden file input ---------- */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void processFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* ---------- drag overlay ---------- */}
      {dragging && (
        <div className="zr-fade-in fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
          <div className="flex size-full max-h-96 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-accent bg-surface/90 p-10 text-center">
            <Upload className="size-12 text-accent" />
            <p className="text-lg font-semibold text-txt">Drop novels here</p>
            <p className="text-xs text-muted">
              Supports .txt, .md, .epub and .pdf files
            </p>
          </div>
        </div>
      )}

      {/* ---------- import progress ---------- */}
      <ImportProgressModal
        items={queue}
        onClose={() => {
          if (importDone) setQueue([]);
        }}
      />

      {/* ---------- delete confirm ---------- */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove book"
        message={`"${deleteTarget?.title ?? ""}" and its reading progress will be removed from your library. This cannot be undone.`}
        confirmLabel="Remove"
        danger
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await deleteBook(deleteTarget.id);
            setDeleteTarget(null);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
