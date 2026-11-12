import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const workspaceDir = fileURLToPath(new URL("../../../templates/workspace-react", import.meta.url));
export const templateDir = join(workspaceDir, "prototypes", "checkout");
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

/**
 * Copies the template workspace (no node_modules) to a temp folder and returns the checkout
 * prototype's folder. With `second`, adds prototypes/onboarding as a copy of checkout.
 */
export function copyTemplate(opts: { second?: boolean } = {}): string {
  const ws = mkdtempSync(join(tmpdir(), "cogitato-ws-"));
  for (const part of ["design", "kit", "package.json", ".env.example"]) {
    cpSync(join(workspaceDir, part), join(ws, part), { recursive: true });
  }
  const proto = join(ws, "prototypes", "checkout");
  for (const part of ["src", "design", "package.json"]) {
    cpSync(join(templateDir, part), join(proto, part), { recursive: true });
  }
  if (opts.second) cpSync(proto, join(ws, "prototypes", "onboarding"), { recursive: true });
  return proto;
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

/** Deletes the temp workspace that copyTemplate made, given the prototype folder it returned. */
export function removeTemplate(proto: string): void {
  rmSync(dirname(dirname(proto)), { recursive: true, force: true });
}
