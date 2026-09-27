"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   NEXORA UI — Button
   ========================================================================== */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
  size?: "sm" | "md" | "lg" | "icon" | "xs";
  loading?: boolean;
  /** Render the child element (usually a Link) with button styling instead of a <button>. */
  asChild?: React.ReactElement;
}

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-500 shadow-[0_8px_24px_-12px_rgba(79,70,229,0.9)] border border-brand-500/40",
  secondary: "bg-surface-3 text-ink hover:bg-line-strong border border-line",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-white/5 border border-transparent",
  danger: "bg-danger text-white hover:bg-red-500 border border-red-500/40",
  success: "bg-success text-white hover:bg-emerald-500 border border-emerald-500/40",
  outline: "bg-transparent text-ink border border-line-strong hover:border-brand-500/60 hover:text-ink-strong",
};

const SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  xs: "h-7 px-2.5 text-[11px] gap-1.5 rounded-md",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-4 text-[13px] gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading, children, disabled, asChild, ...props },
  ref,
) {
  const classes = cn(
    "inline-flex items-center justify-center font-medium transition-all duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    "disabled:opacity-45 disabled:pointer-events-none select-none whitespace-nowrap",
    VARIANTS[variant],
    SIZES[size],
    className,
  );

  if (asChild) {
    const child = asChild.props as { className?: string };
    return React.cloneElement(asChild, {
      className: cn(classes, child.className),
    } as Record<string, unknown>);
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={classes}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ Card -- */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold tracking-tight text-ink-strong">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

/* ----------------------------------------------------------------- Badge -- */

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-white/5 text-ink-muted border-line",
  brand: "bg-brand-500/12 text-brand-300 border-brand-500/25",
  success: "bg-success/12 text-emerald-300 border-success/25",
  warning: "bg-warning/12 text-amber-300 border-warning/25",
  danger: "bg-danger/12 text-red-300 border-danger/25",
  info: "bg-info/12 text-blue-300 border-info/25",
  accent: "bg-accent-500/12 text-accent-300 border-accent-500/25",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Input -- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-lg border border-line bg-surface-2/60 px-3 text-[13px] text-ink placeholder:text-ink-faint",
          "focus:border-brand-500/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors",
          "disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }
>(function Textarea({ className, label, id, ...props }, ref) {
  const field = (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint",
        "focus:border-brand-500/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors resize-y",
        className,
      )}
      {...props}
    />
  );
  if (!label) return field;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {field}
    </div>
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }
>(function Select({ className, children, label, id, ...props }, ref) {
  const field = (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full appearance-none rounded-lg border border-line bg-surface-2/60 px-3 pr-8 text-[13px] text-ink",
        "focus:border-brand-500/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_10px_center] bg-no-repeat",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
  if (!label) return field;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {field}
    </div>
  );
});

export function Label({
  children,
  className,
  htmlFor,
}: {
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-[11px] font-semibold uppercase tracking-wider text-ink-faint", className)}>
      {children}
    </label>
  );
}

/* ---------------------------------------------------------------- Switch -- */

export function Switch({
  checked,
  onChange,
  disabled,
  label,
  hint,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  id?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      {label && (
        <div className="min-w-0">
          <label htmlFor={id} className="block text-[13px] font-medium text-ink">
            {label}
          </label>
          {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{hint}</p>}
        </div>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-200",
          checked ? "border-brand-500/60 bg-brand-600" : "border-line bg-surface-3",
          disabled && "opacity-40",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all duration-200",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- Progress -- */

export function Progress({
  value,
  tone = "brand",
  className,
  showLabel,
  indicatorClassName,
}: {
  value: number;
  tone?: "brand" | "success" | "warning" | "danger";
  className?: string;
  showLabel?: boolean;
  indicatorClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const colors = {
    brand: "bg-brand-500",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  };
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/6"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", colors[tone], indicatorClassName)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="tnum text-[11px] text-ink-faint">{Math.round(clamped)}%</span>}
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton -- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/* ------------------------------------------------------------- Empty state -- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && (
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface-2 text-ink-faint">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-faint">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- Error state -- */

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <p className="text-[13px] font-semibold text-red-300">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-faint">{description}</p>}
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Table -- */

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-[13px]", className)}>{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "border-b border-line/60 px-4 py-3 align-middle text-ink",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors hover:bg-white/[0.025]",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

/* ------------------------------------------------------------------ Modal -- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
      <button
        aria-label="Close dialog"
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "panel relative z-10 w-full animate-rise overflow-hidden",
          widths[width],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink-strong">{title}</h2>
            {description && <p className="mt-1 text-xs leading-relaxed text-ink-faint">{description}</p>}
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Tabs -- */

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto scrollbar-none border-b border-line", className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative shrink-0 px-3 py-2 text-[12.5px] font-medium transition-colors",
            active === tab.id ? "text-ink-strong" : "text-ink-faint hover:text-ink-muted",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 tnum rounded-full bg-white/6 px-1.5 py-0.5 text-[10px] text-ink-muted">
              {tab.count}
            </span>
          )}
          {active === tab.id && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />
          )}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Tooltip -- */

export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = React.useState(false);
  const pos = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-line-strong bg-surface-3 px-2 py-1 text-[11px] text-ink shadow-xl",
            pos[side],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------ Stat block -- */

export function Stat({
  label,
  value,
  delta,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; positive: boolean } | null;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "text-ink",
    brand: "text-brand-300",
    success: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-red-300",
  };
  return (
    <div className="panel group relative overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">{label}</p>
        {icon && <span className="text-ink-faint transition-colors group-hover:text-brand-300">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-[22px] font-semibold leading-none tracking-tight tnum", tones[tone])}>{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {delta && (
          <span
            className={cn(
              "tnum text-[11px] font-semibold",
              delta.positive ? "text-emerald-400" : "text-red-400",
            )}
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        )}
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Avatar -- */

export function Avatar({
  name,
  size = 28,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {letters || "?"}
    </span>
  );
}

/* -------------------------------------------------------------- KeyValue -- */

export function KeyValue({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
  columns?: 1 | 2 | 3;
}) {
  const cols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", cols[columns])}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-faint">{item.label}</dt>
          <dd className="mt-0.5 break-words text-[13px] text-ink">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
