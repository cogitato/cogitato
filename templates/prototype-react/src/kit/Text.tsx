import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Text.module.css";

export interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: "body" | "label" | "heading";
  tone?: "default" | "muted" | "danger" | "inverse";
  as?: "p" | "span" | "h1" | "h2" | "h3" | "label";
  children: ReactNode;
}

export function Text({ variant = "body", tone = "default", as: Tag = "p", children, className, ...rest }: TextProps) {
  return (
    <Tag {...rest} className={[styles.text, styles[variant], styles[tone], className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}

export default Text;
