import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  fullWidth?: boolean;
  /** Button label. */
  children: ReactNode;
  onPress?: () => void;
}

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  children,
  onPress,
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], fullWidth && styles.full, className];
  return (
    <button
      type="button"
      {...rest}
      className={classes.filter(Boolean).join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onPress}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}

export default Button;
