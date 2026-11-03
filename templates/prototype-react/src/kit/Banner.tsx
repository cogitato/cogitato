import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Banner.module.css";

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
  /** Shows a close button when set. */
  onDismiss?: () => void;
  "data-kit-id"?: string;
}

export function Banner({ tone = "info", title, children, onDismiss, className, ...rest }: BannerProps) {
  const kitId = rest["data-kit-id"];
  return (
    <div
      {...rest}
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={[styles.banner, styles[tone], className].filter(Boolean).join(" ")}
    >
      <div className={styles.body}>
        {title && <strong className={styles.title}>{title}</strong>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          aria-label="Dismiss"
          data-kit-id={kitId ? `${kitId}.dismiss` : undefined}
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default Banner;
