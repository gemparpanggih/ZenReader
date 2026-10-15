"use client";

import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "soft" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-[#0b0e14] font-semibold hover:opacity-90",
  ghost:
    "border border-line text-txt hover:bg-surface-2 hover:border-[var(--line)]",
  soft: "bg-accent-soft text-accent font-medium hover:bg-[rgba(108,159,255,0.2)]",
  danger: "bg-danger text-white font-semibold hover:opacity-90",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 transition-all focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}
