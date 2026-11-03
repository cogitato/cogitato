import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
  elevation?: "flat" | "raised";
  children: ReactNode;
}

export function Card({ padding = "md", elevation = "flat", children, className, ...rest }: CardProps) {
  return (
    <div {...rest} className={[styles.card, styles[padding], styles[elevation], className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export default Card;
