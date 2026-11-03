import { useId, type InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  label: string;
  type?: "text" | "email" | "password" | "number" | "tel";
  /** Starting value. The field stays editable, so prototypes can be typed into. */
  value?: string;
  placeholder?: string;
  /** Help text shown under the field. */
  hint?: string;
  /** Error text. Setting it shows the error state. */
  error?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export function Input({ label, type = "text", value, hint, error, disabled = false, onChange, className, ...rest }: InputProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        {...rest}
        id={id}
        type={type}
        defaultValue={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[styles.input, error && styles.invalid].filter(Boolean).join(" ")}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {error ? (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className={styles.hint}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

export default Input;
