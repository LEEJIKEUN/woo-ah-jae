import { ReactNode } from "react";

type Props = {
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  href?: string;
  as?: "button" | "span";
};

export default function Chip({ label, icon, selected = false, onClick, as = "button" }: Props) {
  const className = `inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium leading-none transition ${
    selected
      ? "border-slate-300 bg-slate-100/10 text-slate-900"
      : "border-slate-200/80 bg-transparent text-slate-600 hover:border-slate-400 hover:text-slate-900"
  }`;

  if (as === "span") {
    return <span className={className}>{icon}{label}</span>;
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-label={label}>
      {icon}
      {label}
    </button>
  );
}
