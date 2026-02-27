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
      ? "border-slate-300 bg-slate-100/10 text-slate-50"
      : "border-slate-600/80 bg-transparent text-slate-300 hover:border-slate-400 hover:text-slate-100"
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
