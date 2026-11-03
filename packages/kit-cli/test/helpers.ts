import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const templateDir = fileURLToPath(new URL("../../../templates/prototype-react", import.meta.url));
export const referenceFlows = fileURLToPath(new URL("../../contract/fixtures/reference/design/flows.json", import.meta.url));
export const badDir = fileURLToPath(new URL("./fixtures/bad", import.meta.url));

/**
 * A seeded bad prototype: edits applied to a temp copy of the template, and the issue codes
 * `kit validate` must report. `find` must occur exactly once in the file.
 */
export interface BadCase {
  description: string;
  ok?: boolean;
  expect: string[];
  ops: (
    | { op: "replace"; file: string; find: string; with: string }
    | { op: "write"; file: string; text: string }
    | { op: "delete"; file: string }
  )[];
}

/** Copies the template's source and design folders to a temp folder (no node_modules). */
export function copyTemplate(): string {
  const root = mkdtempSync(join(tmpdir(), "cogitato-proto-"));
  for (const part of ["src", "design", "package.json", ".env.example"]) {
    cpSync(join(templateDir, part), join(root, part), { recursive: true });
  }
  return root;
}

export function applyOps(root: string, ops: BadCase["ops"]): void {
  for (const op of ops) {
    const path = join(root, op.file);
    if (op.op === "delete") rmSync(path, { recursive: true });
    else if (op.op === "write") {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, op.text);
    } else {
      const text = readFileSync(path, "utf8");
      const count = text.split(op.find).length - 1;
      if (count !== 1) throw new Error(`"${op.find}" occurs ${count} times in ${op.file}; it must occur once`);
      writeFileSync(path, text.replace(op.find, op.with));
    }
  }
}
