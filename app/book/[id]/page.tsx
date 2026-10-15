"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Clock,
  FileText,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { db, deleteBook } from "@/lib/db";
import { estimateReadMinutes, formatDate, formatNumber, pluralize } from "@/lib/utils";
import { CoverArt } from "@/components/library/CoverArt";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { PageLoading } from "@/components/ui/Spinner";

export default function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <BookDetail params={params} />
    </Suspense>
  );
}

function BookDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const book = useLiveQuery(() => db.books.get(id), [id]);
  const chaptersRaw = useLiveQuery(
    () => db.chapters.where("bookId").equals(id).sortBy("index"),
    [id]
  );
  const chapters = useMemo(() => chaptersRaw ?? [], [chaptersRaw]);
  const progress = useLiveQuery(() => db.progress.get(id), [id]);

  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", genre: "", description: "" });

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (book) document.title = `${book.title} — Zen Reader`;
  }, [book]);

  const readMinutes = useMemo(() => {
    if (!chapters?.length) return 0;
    return chapters.reduce((sum, c) => sum + estimateReadMinutes(c.title + " " + c.content.replace(/<[^>]+>/g, " ")), 0);
  }, [chapters]);

  if (!book) {
    if (!ready) return <PageLoading />;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-semibold text-txt">Book not found</p>
        <p className="text-sm text-muted">It may have been removed from your library.</p>
        <Link href="/">
          <Button>Back to library</Button>
        </Link>
      </div>
    );
  }

  const readPct =
    progress && book.chapterCount > 0
      ? Math.round(((progress.chapterIndex + 1) / book.chapterCount) * 100)
      : 0;

  const openEdit = () => {
    setForm({
      title: book.title,
      author: book.author ?? "",
      genre: book.genre ?? "",
      description: book.description ?? "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await db.books.update(id, {
      title: form.title.trim() || book.title,
      author: form.author.trim() || undefined,
      genre: form.genre.trim() || undefined,
      description: form.description.trim() || undefined,
    });
    setEditing(false);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteBook(id);
      router.replace("/");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-dvh">
      {/* header */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-txt"
          >
            <ArrowLeft className="size-4" />
            Library
          </Link>
          <span className="truncate text-sm font-medium text-txt">{book.title}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {/* ---------- hero ---------- */}
        <section className="flex flex-col gap-6 sm:flex-row">
          <div className="mx-auto w-44 shrink-0 sm:mx-0 sm:w-52">
            <CoverArt book={book} className="aspect-[2/3] w-full rounded-2xl shadow-2xl ring-1 ring-white/10" />
            <span className="mt-2.5 flex items-center justify-center gap-1 rounded-lg bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <FileText className="size-3" /> {book.fileFormat}
            </span>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold leading-tight text-txt sm:text-3xl">
              {book.title}
            </h1>
            <p className="mt-1 text-sm text-accent">
              {book.author || "Unknown author"}
              {book.genre ? ` · ${book.genre}` : ""}
            </p>

            {/* stats */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted sm:justify-start">
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" />
                {pluralize(book.chapterCount, "chapter")}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="size-3.5" />
                {formatNumber(book.totalWords)} words
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                ~{readMinutes} min read
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                Added {formatDate(book.createdAt)}
              </span>
            </div>

            {/* reading progress */}
            {progress && (
              <div className="mx-auto mt-5 max-w-sm sm:mx-0">
                <div className="mb-1.5 flex justify-between text-[11px] text-muted">
                  <span>
                    Chapter {progress.chapterIndex + 1} of {book.chapterCount}
                  </span>
                  <span className="font-semibold text-accent">{readPct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${readPct}%` }} />
                </div>
              </div>
            )}

            {/* actions */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <Link href={`/book/${id}/read${progress ? "" : "?c=0"}`}>
                <Button size="md">
                  <Play className="size-4" />
                  {progress ? "Continue reading" : "Start reading"}
                </Button>
              </Link>
              <Button variant="ghost" onClick={openEdit}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="!text-danger hover:!bg-danger-soft">
                <Trash2 className="size-4" /> Remove
              </Button>
            </div>

            {book.description && (
              <p className="mt-6 border-l-2 border-line pl-3.5 text-left text-sm leading-relaxed text-muted">
                {book.description}
              </p>
            )}
          </div>
        </section>

        {/* ---------- chapter list ---------- */}
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
            <BookOpen className="size-4" /> Table of contents
          </h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {chapters.map((ch, i) => {
              const isRead = progress ? i < progress.chapterIndex : false;
              const isCurrent = progress?.chapterIndex === i;
              return (
                <li key={ch.id}>
                  <Link
                    href={`/book/${id}/read?c=${i}`}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                      isCurrent
                        ? "border-accent/50 bg-accent-soft"
                        : "border-line bg-surface hover:border-[var(--accent)]/40 hover:bg-surface-2"
                    }`}
                  >
                    {isRead ? (
                      <Check className="size-4 shrink-0 text-ok" />
                    ) : (
                      <span className="w-4 shrink-0 text-center text-[11px] font-semibold text-muted">
                        {i + 1}
                      </span>
                    )}
                    <span className="truncate text-txt">{ch.title}</span>
                    {isCurrent && (
                      <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-accent">
                        Reading
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      {/* ---------- edit modal ---------- */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit book details"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-txt focus:border-accent focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Author</span>
              <input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-txt focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Genre</span>
              <input
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-txt focus:border-accent focus:outline-none"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Synopsis</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-txt focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      </Modal>

      {/* ---------- delete confirm ---------- */}
      <ConfirmDialog
        open={confirmDelete}
        title="Remove book"
        message={`"${book.title}" and all reading progress will be deleted from your browser. This cannot be undone.`}
        confirmLabel="Remove"
        danger
        busy={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />
    </div>
  );
}
