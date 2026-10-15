"use client";

import { X } from "lucide-react";
import { useReaderStore } from "@/store/readerStore";
import type { ReaderTheme } from "@/lib/types";

const THEMES: { id: ReaderTheme; label: string; swatch: string }[] = [
  { id: "dark", label: "Dark", swatch: "#0e1116" },
  { id: "sepia", label: "Sepia", swatch: "#f3ead4" },
  { id: "light", label: "Light", swatch: "#fbfaf8" },
];

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--reader-muted)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full flex-1 cursor-pointer appearance-none rounded-full"
        style={{ accentColor: "var(--reader-accent)", background: "var(--reader-border)" }}
      />
      <span className="w-11 shrink-0 text-right text-xs tabular-nums" style={{ color: "var(--reader-text)" }}>
        {display}
      </span>
    </div>
  );
}

export default function SettingsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { settings, update } = useReaderStore();

  if (!open) return null;

  return (
    <div className="zr-fade-in fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside
        className="absolute inset-y-0 right-0 flex w-80 max-w-[90vw] flex-col overflow-y-auto shadow-2xl"
        style={{ background: "var(--reader-surface)", color: "var(--reader-text)" }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3.5"
          style={{ background: "var(--reader-surface)", borderColor: "var(--reader-border)" }}
        >
          <h2 className="text-sm font-semibold">Reading settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 transition-opacity hover:opacity-70"
            aria-label="Close settings"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-4">
          {/* theme */}
          <Row label="Theme">
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => update({ theme: t.id })}
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] transition-all"
                  style={{
                    borderColor:
                      settings.theme === t.id
                        ? "var(--reader-accent)"
                        : "var(--reader-border)",
                    background:
                      settings.theme === t.id
                        ? "color-mix(in srgb, var(--reader-accent) 14%, transparent)"
                        : "transparent",
                    color:
                      settings.theme === t.id
                        ? "var(--reader-accent)"
                        : "var(--reader-text)",
                  }}
                >
                  <span
                    className="size-4 rounded-full border"
                    style={{ background: t.swatch, borderColor: "var(--reader-border)" }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
          </Row>

          {/* font family */}
          <Row label="Font family">
            <div className="flex gap-2">
              {(["serif", "sans"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => update({ fontFamily: f })}
                  className="flex-1 rounded-xl border px-3 py-2 text-[13px] transition-all"
                  style={{
                    fontFamily:
                      f === "serif"
                        ? "Georgia, 'Times New Roman', 'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', 'Noto Serif CJK SC', SimSun, serif"
                        : "inherit",
                    borderColor:
                      settings.fontFamily === f
                        ? "var(--reader-accent)"
                        : "var(--reader-border)",
                    color: "var(--reader-text)",
                  }}
                >
                  {f === "serif" ? "Serif" : "Sans"}
                </button>
              ))}
            </div>
          </Row>

          {/* font size */}
          <Row label="Font size">
            <Slider
              value={settings.fontSize}
              min={14}
              max={28}
              step={1}
              display={`${settings.fontSize}px`}
              onChange={(fontSize) => update({ fontSize })}
            />
          </Row>

          {/* line height */}
          <Row label="Line height">
            <Slider
              value={settings.lineHeight}
              min={1.4}
              max={2.6}
              step={0.05}
              display={settings.lineHeight.toFixed(2)}
              onChange={(lineHeight) => update({ lineHeight })}
            />
          </Row>

          {/* letter spacing */}
          <Row label="Letter spacing">
            <Slider
              value={settings.letterSpacing}
              min={0}
              max={0.12}
              step={0.005}
              display={`${Math.round(settings.letterSpacing * 1000)}`}
              onChange={(letterSpacing) => update({ letterSpacing })}
            />
          </Row>

          {/* column width */}
          <Row label="Column width">
            <Slider
              value={settings.maxWidth}
              min={520}
              max={880}
              step={20}
              display={`${settings.maxWidth}px`}
              onChange={(maxWidth) => update({ maxWidth })}
            />
          </Row>
        </div>
      </aside>
    </div>
  );
}
