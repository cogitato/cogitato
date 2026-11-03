import type { ValidationResult } from "@cogitato/contract";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Plain-language report for people. `--json` prints the ValidationReport instead. */
export function formatResult(r: ValidationResult, success = "All good: the prototype follows the design contract."): string {
  const errors = r.issues.filter((i) => i.severity === "error").length;
  const warnings = r.issues.length - errors;
  if (r.issues.length === 0) return success;

  const lines: string[] = [];
  lines.push(
    errors
      ? `Found ${plural(errors, "problem")}${warnings ? ` and ${plural(warnings, "warning")}` : ""} to fix.`
      : `No problems, but ${plural(warnings, "warning")}:`,
  );
  const byFile = new Map<string, typeof r.issues>();
  for (const i of r.issues) byFile.set(i.file, [...(byFile.get(i.file) ?? []), i]);
  for (const [file, list] of byFile) {
    lines.push("", file);
    for (const i of list) {
      const where = i.line ? `line ${i.line}: ` : "";
      const tag = i.severity === "warning" ? "(warning) " : "";
      lines.push(`  ${tag}${where}${i.message}`);
      if (i.suggestion) lines.push(`    suggested: ${i.suggestion}`);
    }
  }
  return lines.join("\n");
}
