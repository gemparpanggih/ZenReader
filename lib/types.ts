export type FileFormat = "txt" | "md" | "epub" | "pdf";

export type ReaderTheme = "dark" | "light" | "sepia";

export interface Book {
  id: string;
  title: string;
  author?: string;
  genre?: string;
  description?: string;
  /** Cover image, stored as a Blob inside IndexedDB. */
  cover?: Blob | null;
  fileFormat: FileFormat;
  fileName: string;
  chapterCount: number;
  totalWords?: number;
  createdAt: number;
  lastReadAt?: number;
}

export interface Chapter {
  /** `${bookId}:${index}` */
  id: string;
  bookId: string;
  index: number;
  title: string;
  /** Sanitized HTML. */
  content: string;
  words: number;
}

export interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  /** 0..100 scroll extent within the chapter. */
  scrollPercent: number;
  updatedAt: number;
}

export interface ReaderSettings {
  fontSize: number;
  fontFamily: "serif" | "sans";
  lineHeight: number;
  /** em */
  letterSpacing: number;
  /** px, max content width */
  maxWidth: number;
  theme: ReaderTheme;
}

export interface ParsedChapter {
  title: string;
  content: string;
  words: number;
}

export interface ParsedBook {
  title: string;
  author?: string;
  description?: string;
  cover?: Blob | null;
  chapters: ParsedChapter[];
}

export type ParseProgress = { page: number; total: number };
