import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
};

export function Card({ children, className = "", hover = false }: CardProps) {
  return (
    <article className={`dm-card ${hover ? "dm-card-hover" : ""} ${className}`.trim()}>{children}</article>
  );
}
