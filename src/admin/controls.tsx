"use client";

import { useEffect, useId, useRef, useState } from "react";

/* Panel controls shared by the catalog sections. */

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? "opacity-40" : "cursor-pointer"}`}>
      <span className="min-w-0">
        <span className="block text-[0.92rem] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.8rem] text-ink-soft">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${checked ? "bg-ink" : "bg-ink-line-2"}`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-paper transition-[left] duration-200 ${checked ? "left-6" : "left-1"}`} />
      </span>
    </label>
  );
}

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%23777' stroke-width='1.6'/%3E%3C/svg%3E")`;

export function Select({ label, children, ...rest }: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  const el = (
    <select
      id={id}
      className="field cursor-pointer appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10"
      style={{ backgroundImage: CHEVRON }}
      {...rest}
    >
      {children}
    </select>
  );
  if (!label) return el;
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[0.88rem] font-medium">{label}</span>
      {el}
    </label>
  );
}

/** A destructive button that asks once more in place (no browser dialog). */
export function ConfirmButton({
  children,
  confirm = "Əminsiniz? Bir də basın",
  onConfirm,
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  confirm?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${className} ${armed ? "!bg-danger !text-white !outline-danger" : ""}`}
      onClick={() => {
        clearTimeout(timer.current);
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 4000);
        } else {
          setArmed(false);
          onConfirm();
        }
      }}
    >
      {armed ? confirm : children}
    </button>
  );
}

export function Card({
  title,
  lead,
  children,
  action,
}: {
  title?: string;
  lead?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] bg-paper-2 p-4 sm:p-5">
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[1.08rem]">{title}</h2>}
            {lead && <p className="mt-1 text-[0.82rem] text-ink-soft">{lead}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Small round icon button (edit, move, remove). */
export function IconBtn({ label, children, className = "", ...rest }: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-full bg-paper text-ink transition-colors hover:bg-paper-3 disabled:opacity-30 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({ on, children, onClick, swatch }: { on: boolean; children: React.ReactNode; onClick: () => void; swatch?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[0.86rem] font-medium transition-colors ${on ? "bg-ink text-paper" : "bg-paper text-ink outline outline-1 -outline-offset-1 outline-ink-line-2"}`}
    >
      {swatch && <span className="size-4 rounded-full outline outline-1 -outline-offset-1 outline-ink-line-2" style={{ background: swatch }} />}
      {children}
    </button>
  );
}

/* minimal line icons (1.6 stroke, currentColor) */
const I = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
export const UpIcon = () => <I d="M6 14l6-6 6 6" />;
export const DownIcon = () => <I d="M6 10l6 6 6-6" />;
export const XIcon = () => <I d="M6 6l12 12M18 6L6 18" />;
export const PlusIcon = () => <I d="M12 5v14M5 12h14" />;
export const BackIcon = () => <I d="M15 5l-7 7 7 7" />;
export const DragIcon = () => <I d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" size={20} />;
export const CameraIcon = () => <I d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z" />;
export const ImageIcon = () => <I d="M4 5h16v14H4zM4 15l5-5 5 5 2-2 4 4M15 9h.01" />;
