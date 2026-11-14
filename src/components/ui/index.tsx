import React, { useEffect } from 'react';
import { Check, X, Minus, Plus, ChevronRight } from 'lucide-react';

type Tone = 'neutral' | 'rose' | 'emerald' | 'amber' | 'blue' | 'violet';

const toneStyles: Record<Tone, { box: string; icon: string; title: string }> = {
  neutral: { box: 'bg-white/[0.03] border-white/[0.08]', icon: 'text-zinc-400', title: 'text-zinc-100' },
  rose: { box: 'bg-rose-500/[0.08] border-rose-500/25', icon: 'text-rose-400', title: 'text-rose-200' },
  emerald: { box: 'bg-emerald-500/[0.08] border-emerald-500/25', icon: 'text-emerald-400', title: 'text-emerald-200' },
  amber: { box: 'bg-amber-500/[0.08] border-amber-500/25', icon: 'text-amber-400', title: 'text-amber-200' },
  blue: { box: 'bg-sky-500/[0.08] border-sky-500/25', icon: 'text-sky-400', title: 'text-sky-200' },
  violet: { box: 'bg-violet-500/[0.08] border-violet-500/25', icon: 'text-violet-400', title: 'text-violet-200' },
};

export const chipTone: Record<Tone, string> = {
  neutral: 'bg-white/[0.06] text-zinc-300',
  rose: 'bg-rose-500/15 text-rose-300',
  emerald: 'bg-emerald-500/15 text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-300',
  blue: 'bg-sky-500/15 text-sky-300',
  violet: 'bg-violet-500/15 text-violet-300',
};

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }> = ({
  className,
  padded = true,
  children,
  ...rest
}) => (
  <div className={cx('card', padded && 'p-4', className)} {...rest}>
    {children}
  </div>
);

export const ScreenTitle: React.FC<{ title: string; subtitle?: React.ReactNode; right?: React.ReactNode }> = ({
  title,
  subtitle,
  right,
}) => (
  <div className="flex items-end justify-between gap-3 pt-1">
    <div className="min-w-0">
      <h1 className="text-[22px] leading-tight font-bold tracking-tight text-white">{title}</h1>
      {subtitle && <p className="text-sm text-zinc-400 mt-0.5">{subtitle}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

export const SectionHeader: React.FC<{ title: string; action?: React.ReactNode; className?: string }> = ({
  title,
  action,
  className,
}) => (
  <div className={cx('flex items-center justify-between px-1 mb-2', className)}>
    <h2 className="section-label">{title}</h2>
    {action}
  </div>
);

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export const Notice: React.FC<{
  tone?: Tone;
  icon?: React.ElementType;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ tone = 'neutral', icon: Icon, title, children, action, onClick, className }) => {
  const t = toneStyles[tone];
  return (
    <div
      onClick={onClick}
      className={cx(
        'flex items-start gap-3 rounded-2xl border p-3.5',
        t.box,
        onClick && 'cursor-pointer active:scale-[0.99] transition',
        className
      )}
    >
      {Icon && <Icon className={cx('w-5 h-5 shrink-0 mt-0.5', t.icon)} />}
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm font-semibold leading-snug', t.title)}>{title}</p>
        {children && <div className="text-[13px] text-zinc-400 leading-relaxed mt-0.5">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
};

export const Chip: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className,
}) => <span className={cx('chip', chipTone[tone], className)}>{children}</span>;

export const ProgressBar: React.FC<{ value: number; tone?: 'rose' | 'emerald' | 'amber'; className?: string }> = ({
  value,
  tone = 'rose',
  className,
}) => (
  <div className={cx('h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden', className)}>
    <div
      className={cx(
        'h-full rounded-full transition-all duration-500',
        tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-rose-500'
      )}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

export const Switch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  tone?: 'rose' | 'amber' | 'blue' | 'emerald';
  label?: string;
}> = ({ checked, onChange, disabled, tone = 'rose', label }) => {
  const on =
    tone === 'amber' ? 'bg-amber-500' : tone === 'blue' ? 'bg-sky-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500';
  return (
    <button
      type="button"
      role="switch"
      data-haptic="medium"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-40',
        checked ? on : 'bg-white/[0.12]'
      )}
    >
      <span
        className={cx(
          'inline-block h-6 w-6 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
};

export const CheckButton: React.FC<{
  checked: boolean;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  size?: 'md' | 'lg';
  label?: string;
}> = ({ checked, onClick, disabled, size = 'md', label }) => (
  <button
    type="button"
    aria-pressed={checked}
    aria-label={label}
    disabled={disabled}
    onClick={e => {
      e.stopPropagation();
      onClick(e);
    }}
    className={cx(
      'shrink-0 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:cursor-not-allowed',
      size === 'lg' ? 'w-9 h-9' : 'w-8 h-8',
      checked
        ? 'bg-emerald-500 text-ink-950 shadow-glow-green animate-pop'
        : 'border-2 border-white/20 text-transparent hover:border-white/40',
      disabled && !checked && 'opacity-40'
    )}
  >
    <Check className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} strokeWidth={3} />
  </button>
);

export const Stepper: React.FC<{
  value: React.ReactNode;
  onDec: () => void;
  onInc: () => void;
  disabled?: boolean;
}> = ({ value, onDec, onInc, disabled }) => (
  <div className="inline-flex items-center rounded-xl bg-ink-850 border border-white/[0.08] h-11">
    <button
      type="button"
      disabled={disabled}
      onClick={onDec}
      data-haptic="selection"
      aria-label="Decrease"
      className="w-11 h-full flex items-center justify-center text-zinc-300 active:bg-white/[0.06] rounded-l-xl disabled:opacity-40"
    >
      <Minus className="w-4 h-4" />
    </button>
    <span className="min-w-[64px] text-center text-[15px] font-semibold text-white tabular">{value}</span>
    <button
      type="button"
      disabled={disabled}
      onClick={onInc}
      data-haptic="selection"
      aria-label="Increase"
      className="w-11 h-full flex items-center justify-center text-rose-300 active:bg-white/[0.06] rounded-r-xl disabled:opacity-40"
    >
      <Plus className="w-4 h-4" />
    </button>
  </div>
);

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  options: Array<{ value: T; label: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('flex p-1 rounded-xl bg-ink-850 border border-white/[0.06]', className)}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          data-haptic="selection"
          className={cx(
            'flex-1 h-9 px-2 rounded-lg text-[13px] font-semibold transition whitespace-nowrap disabled:opacity-50',
            value === o.value ? 'bg-white/[0.1] text-white shadow-sm' : 'text-zinc-400'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** iOS-settings style row */
export const ListRow: React.FC<{
  icon?: React.ElementType;
  iconTone?: Tone;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
}> = ({ icon: Icon, iconTone = 'neutral', title, subtitle, right, onClick, chevron, danger }) => {
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx(
        'w-full flex items-center gap-3 px-4 py-3 text-left min-h-[56px]',
        onClick && 'active:bg-white/[0.04] transition'
      )}
    >
      {Icon && (
        <span className={cx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', chipTone[iconTone])}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className={cx('block text-[15px] font-medium', danger ? 'text-rose-400' : 'text-zinc-100')}>{title}</span>
        {subtitle && <span className="block text-[13px] text-zinc-500 mt-0.5 leading-snug line-clamp-2">{subtitle}</span>}
      </span>
      {right}
      {chevron && <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />}
    </Comp>
  );
};

export const ListGroup: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('card overflow-hidden divide-y divide-white/[0.05]', className)}>{children}</div>
);

/* ------------------------------------------------------------------ */
/* Bottom sheet (mobile) / dialog (desktop)                            */
/* ------------------------------------------------------------------ */

export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}> = ({ open, onClose, title, subtitle, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'relative w-full bg-ink-900 border-t sm:border border-white/[0.08] rounded-t-3xl sm:rounded-3xl shadow-2xl',
          'flex flex-col max-h-[92dvh] animate-sheet-up sm:animate-fade-in',
          size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-md'
        )}
      >
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-3 sm:pt-5 pb-3">
            <div className="min-w-0">
              {title && <h3 className="text-lg font-bold text-white leading-snug">{title}</h3>}
              {subtitle && <p className="text-sm text-zinc-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 -mr-1 rounded-full bg-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="px-5 pb-5 overflow-y-auto no-scrollbar flex-1">{children}</div>
        {footer && (
          <div className="px-5 pt-3 border-t border-white/[0.06]" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
            {footer}
          </div>
        )}
        {!footer && <div style={{ height: 'var(--safe-bottom)' }} />}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Stat tile                                                           */
/* ------------------------------------------------------------------ */

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'white' | 'amber' | 'emerald' | 'rose';
  className?: string;
}> = ({ label, value, hint, tone = 'white', className }) => (
  <div className={cx('card p-3.5', className)}>
    <p className="text-[12px] font-medium text-zinc-500">{label}</p>
    <p
      className={cx(
        'text-2xl font-bold tracking-tight mt-1 tabular',
        tone === 'amber' ? 'text-amber-400' : tone === 'emerald' ? 'text-emerald-400' : tone === 'rose' ? 'text-rose-400' : 'text-white'
      )}
    >
      {value}
    </p>
    {hint && <p className="text-[12px] text-zinc-500 mt-0.5">{hint}</p>}
  </div>
);
