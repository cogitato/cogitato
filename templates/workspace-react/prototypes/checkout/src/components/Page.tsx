import type { ReactNode } from "react";
import { Stack } from "@/kit/Stack";
import { Text } from "@/kit/Text";
import styles from "./Page.module.css";

const STEPS = ["Cart", "Shipping", "Payment"] as const;

/** Page frame shared by the checkout screens. `step` highlights the progress row. */
export function Page({ title, step, children }: { title: string; step?: (typeof STEPS)[number]; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <Stack gap="6">
        {step && (
          // Stand-in for the Stepper component until it exists (gap_stepper).
          <Stack direction="row" gap="3" aria-label="Checkout progress">
            {STEPS.map((s) => (
              <Text key={s} as="span" variant="label" tone={s === step ? "default" : "muted"}>
                {s}
              </Text>
            ))}
          </Stack>
        )}
        <Text as="h1" variant="heading">
          {title}
        </Text>
        {children}
      </Stack>
    </main>
  );
}
