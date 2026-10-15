# 📚 Zen Reader

A **local novel reader** built with Next.js — import novels from your device and read them with a clean, distraction-free interface. Everything stays in your browser; nothing is uploaded.

## Features

- **Multi-format import** — `.txt`, `.md`, `.epub` and `.pdf` via file picker or drag & drop
  - Smart chapter detection (English, Indonesian, Chinese/Japanese, volume markers, prologue/epilogue) with CJK-aware word counting
  - Fallback chunking (~3,000 words) when a file has no chapter headings
  - EPUB metadata & cover extraction (OPF parser), XHTML sanitization
  - PDF text extraction with pdf.js, first-page cover rendering
- **Library** — book grid with covers, search by title/author/genre, sort by last-read / added / title, reading progress bars
- **Book details** — cover, stats (chapters, words, est. reading time), editable metadata, full table of contents
- **Reader** — continue-where-you-left-off (chapter + scroll position saved to IndexedDB), table-of-contents drawer, keyboard navigation (←/→, Esc), reading progress bar
- **Reading settings** — 3 themes (dark / sepia / light), font family, font size, line height, letter spacing, column width — all persisted
- **100% local storage** — books, chapters, covers and preferences live in IndexedDB (Dexie)

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zustand · Dexie (IndexedDB) · pdf.js · JSZip · Vitest

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
```

## Scripts

| Command            | Description                |
| ------------------ | -------------------------- |
| `npm run dev`      | Development server         |
| `npm run build`    | Production build           |
| `npm run start`    | Serve production build     |
| `npm test`         | Run tests (Vitest)         |
| `npm run typecheck`| `tsc --noEmit`             |
| `npm run lint`     | ESLint                     |

## Project structure

```
app/                 # App Router pages (library, book detail, reader)
components/          # UI primitives, library + reader components
lib/
  db.ts              # Dexie schema & helpers
  importer.ts        # file → IndexedDB pipeline
  parse/             # txt / epub / pdf parsers, chapter detection
  useObjectUrl.ts    # blob URL hook for covers
store/               # Zustand stores (reader settings)
tests/               # Vitest: parsers, chapter detection, DB round-trip
```

## Roadmap

Bookmarks & notes, reading stats, text-to-speech, in-book search, multi-device sync.
