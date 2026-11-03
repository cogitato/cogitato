import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const referenceDir = fileURLToPath(new URL("../fixtures/reference/design", import.meta.url));
export const badDir = fileURLToPath(new URL("../fixtures/bad", import.meta.url));

/**
 * A known-bad case: edits applied to a copy of the reference project, and the issue codes
 * validation must report. `at` is "file#/json/pointer" (or just "file" for file operations).
 */
export interface BadCase {
  description: string;
  ok?: boolean;
  expect: string[];
  ops: (
    | { op: "set"; at: string; value: unknown }
    | { op: "remove"; at: string }
    | { op: "delete"; at: string }
    | { op: "rename"; at: string; to: string }
    | { op: "writeText"; at: string; text: string }
  )[];
}

type Container = Record<string, unknown> | unknown[];

function walk(doc: unknown, pointer: string): { parent: Container; key: string } {
  const keys = pointer.slice(1).split("/").map((k) => k.replace(/~1/g, "/").replace(/~0/g, "~"));
  const last = keys.pop();
  if (last === undefined) throw new Error(`Empty pointer`);
  let node = doc;
  for (const key of keys) {
    node = (node as Record<string, unknown>)[key];
    if (node === undefined) throw new Error(`Pointer ${pointer} does not resolve at "${key}"`);
  }
  return { parent: node as Container, key: last };
}

export function applyOps(root: string, ops: BadCase["ops"]): void {
  for (const op of ops) {
    const [file = "", pointer = ""] = op.at.split("#");
    const path = join(root, file);
    if (op.op === "delete") rmSync(path, { recursive: true });
    else if (op.op === "rename") renameSync(path, join(root, op.to));
    else if (op.op === "writeText") writeFileSync(path, op.text);
    else {
      const doc = JSON.parse(readFileSync(path, "utf8")) as unknown;
      const { parent, key } = walk(doc, pointer);
      if (Array.isArray(parent)) {
        const index = Number(key);
        if (op.op === "set") parent[index] = op.value;
        else parent.splice(index, 1);
      } else if (op.op === "set") parent[key] = op.value;
      else delete parent[key];
      writeFileSync(path, JSON.stringify(doc, null, 2));
    }
  }
}

/** Copies the reference project to a temp folder and returns its design/ path. */
export function copyReference(): string {
  const dir = join(mkdtempSync(join(tmpdir(), "cogitato-")), "design");
  cpSync(referenceDir, dir, { recursive: true });
  return dir;
}
