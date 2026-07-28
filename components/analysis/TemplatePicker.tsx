"use client";

import { useEffect, useRef, useState } from "react";
import { TEMPLATES } from "@/lib/analysis/dimensions";
import type { AnalysisTemplate } from "@/lib/analysis/types";

interface TemplatePickerProps {
  activeTemplateId: string | null;
  onSelect: (template: AnalysisTemplate) => void;
}

export function TemplatePicker({
  activeTemplateId,
  onSelect,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = "analysis-template-menu";

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative font-serif" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className="h-9 border border-[var(--purple)] bg-[var(--purple)] px-3 text-[11px] text-white transition hover:bg-[var(--purple-deep)] hover:text-white focus:bg-[var(--purple-deep)] focus:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--purple)] active:bg-[var(--purple-deep)] active:text-white"
      >
        <span className="text-white">预设模板</span>{" "}
        <span aria-hidden="true" className="inline-block text-white transition-transform">
          {open ? "⌃" : "⌄"}
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="预设分析模板"
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] border border-[var(--line-dark)] bg-[var(--surface)] py-2 shadow-[0_10px_24px_rgba(39,36,42,.1)]"
        >
          <p className="px-4 pb-2 pt-1 text-[9px] tracking-[.08em] text-[var(--muted)]">
            选择预设方案快速开始
          </p>
          {TEMPLATES.map((template) => {
            const active = template.id === activeTemplateId;
            return (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={active}
                key={template.id}
                onClick={() => {
                  onSelect(template);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12px] transition hover:bg-[var(--paper-deep)] focus:bg-[var(--paper-deep)] focus:outline-none ${
                  active ? "bg-[var(--purple-pale)] text-[var(--purple-deep)]" : ""
                }`}
              >
                <span
                  className="grid size-7 place-items-center bg-[var(--purple-pale)] text-[12px] text-[var(--purple)]"
                  aria-hidden="true"
                >
                  {template.icon}
                </span>
                <span className="min-w-0 flex-1">{template.name}</span>
                {active ? (
                  <span aria-hidden="true" className="text-[12px] text-[var(--purple)]">✓</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
