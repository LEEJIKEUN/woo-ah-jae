import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className }: Props) {
  return (
    <article className={`rounded-2xl bg-[color:var(--surface)] p-4 ${className ?? ""}`}>
      {children}
    </article>
  );
}
