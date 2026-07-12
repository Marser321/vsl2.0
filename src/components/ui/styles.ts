export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 disabled:cursor-not-allowed disabled:opacity-50";

export const buttonVariants = {
  primary: "bg-brand-blue font-semibold text-white hover:bg-brand-navy",
  secondary: "border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50",
  danger: "bg-danger font-semibold text-white hover:bg-danger-strong",
  ghost: "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
} as const;

export const buttonSizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2",
} as const;

export const btnPrimary = `${buttonBase} ${buttonVariants.primary} ${buttonSizes.md}`;
export const btnSecondary = `${buttonBase} ${buttonVariants.secondary} ${buttonSizes.md}`;
