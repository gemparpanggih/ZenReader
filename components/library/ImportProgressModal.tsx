"use client";

import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import Modal from "../ui/Modal";

export interface QueueItem {
  file: File;
  status: "queued" | "parsing" | "saving" | "done" | "error";
  progress?: number;
  error?: string;
}

export default function ImportProgressModal({
  items,
  onClose,
}: {
  items: QueueItem[];
  onClose: () => void;
}) {
  const open = items.length > 0;
  const done = items.every((i) => i.status === "done" || i.status === "error");
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? "Import finished" : "Importing books…"}
      maxWidth={480}
      footer={
        done ? (
          <button
            onClick={onClose}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#0b0e14] hover:opacity-90"
          >
            {doneCount === items.length
              ? "Done"
              : `Close (${items.length - doneCount} failed)`}
          </button>
        ) : undefined
      }
    >
      {!done && (
        <p className="mb-4 text-xs text-muted">
          Files are stored locally in your browser — nothing is uploaded.
        </p>
      )}
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5"
          >
            {item.status === "done" && (
              <CheckCircle2 className="size-4 shrink-0 text-ok" />
            )}
            {item.status === "error" && (
              <AlertCircle className="size-4 shrink-0 text-danger" />
            )}
            {(item.status === "queued" ||
              item.status === "parsing" ||
              item.status === "saving") && (
              <span
                className="size-4 shrink-0 rounded-full border-2 border-line border-t-accent"
                style={{ animation: "zr-spin 0.8s linear infinite" }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-txt">
                {item.file.name}
              </p>
              <p className="text-[11px] text-muted">
                {item.status === "done" && "Imported"}
                {item.status === "error" && (item.error ?? "Failed")}
                {item.status === "queued" && "Waiting…"}
                {item.status === "saving" && "Saving to library…"}
                {item.status === "parsing" &&
                  (item.progress !== undefined
                    ? `Reading pages… ${item.progress}%`
                    : "Analyzing content…")}
              </p>
            </div>
            {item.status === "parsing" && item.progress !== undefined && (
              <span className="text-[11px] font-semibold text-accent">
                {item.progress}%
              </span>
            )}
            {item.status === "done" && (
              <FileText className="size-3.5 shrink-0 text-muted" />
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
