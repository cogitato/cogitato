import type { HTMLAttributes, ReactNode } from "react";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  /** Step on the space scale. */
  gap?: "0" | "1" | "2" | "3" | "4" | "6" | "8";
  align?: "start" | "center" | "end" | "stretch";
  children: ReactNode;
}

const ALIGN = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" } as const;

export function Stack({ direction = "column", gap = "4", align = "stretch", children, style, ...rest }: StackProps) {
  return (
    <div
      {...rest}
      style={{
        display: "flex",
        flexDirection: direction,
        alignItems: ALIGN[align],
        gap: `var(--kit-space-${gap})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Stack;
