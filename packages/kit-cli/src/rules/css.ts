import postcss from "postcss";
import type { Issue } from "../issue.js";
import type { ContractView } from "../project.js";
import { FINDING_CODES, checkCssValue } from "./css-values.js";

/** Token rule for a .css / .module.css file. */
export function checkCssFile(file: string, text: string, contract: ContractView): Issue[] {
  let root: postcss.Root;
  try {
    root = postcss.parse(text, { from: file });
  } catch (e) {
    const err = e as { line?: number; column?: number; reason?: string };
    return [
      {
        code: "code-css-unreadable",
        severity: "error",
        file,
        path: "",
        ...(err.line ? { line: err.line } : {}),
        ...(err.column ? { column: err.column } : {}),
        message: `This stylesheet has a typo Cogitato can't read past (${err.reason ?? "invalid CSS"}).`,
      },
    ];
  }
  const issues: Issue[] = [];
  root.walkDecls((decl) => {
    for (const f of checkCssValue(contract, decl.prop, decl.value)) {
      issues.push({
        code: FINDING_CODES[f.kind],
        severity: "error",
        file,
        path: "",
        ...(decl.source?.start ? { line: decl.source.start.line, column: decl.source.start.column } : {}),
        message: f.message,
        ...(f.suggestion ? { suggestion: f.suggestion } : {}),
      });
    }
  });
  return issues;
}
