import { create } from "zustand";
import {
  DEFAULT_READER_SETTINGS,
  getReaderSettings,
  saveReaderSettings,
} from "@/lib/db";
import type { ReaderSettings } from "@/lib/types";

interface ReaderStore {
  initialized: boolean;
  /** Set once the user changes anything — init() must not clobber it. */
  touched: boolean;
  settings: ReaderSettings;
  init: () => Promise<void>;
  update: (patch: Partial<ReaderSettings>) => void;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

export const useReaderStore = create<ReaderStore>((set, get) => ({
  initialized: false,
  touched: false,
  settings: DEFAULT_READER_SETTINGS,

  init: async () => {
    if (get().initialized) return;
    const settings = await getReaderSettings();
    set((s) =>
      s.touched
        ? { initialized: true } // user already chose — keep their settings
        : { settings, initialized: true }
    );
  },

  update: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ touched: true, settings: next });
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void saveReaderSettings(next).catch(() => undefined);
    }, 500);
  },
}));
