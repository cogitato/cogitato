import { createHash } from "node:crypto";

// Shared with the hosted platform (@cogitato/kit-cli/hosting): the plugin prints preview links
// and the platform serves previews, so both must name hosts and pick prototypes the same way.

/** Paths that every prototype in a workspace depends on: a change here rebuilds them all. */
export const SHARED_INPUTS = ["design/", "kit/", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"] as const;

const MAX_LABEL = 63;
const HASH = 6;

/** One part of a host name: lowercase letters, digits and single dashes. */
export function slugPart(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, HASH);
const cut = (s: string, n: number) => s.slice(0, Math.max(0, n)).replace(/-+$/, "");

/**
 * The DNS label of a branch preview: "<branch>--<prototype>--<org>". A label longer than 63
 * characters keeps the prototype and org, and shortens the branch with a hash of the full label.
 * If even that doesn't fit, the whole label is shortened.
 */
export function previewHost(parts: { branch: string; prototype: string; org: string }): string {
  const branch = slugPart(parts.branch);
  const tail = `--${slugPart(parts.prototype)}--${slugPart(parts.org)}`;
  const full = `${branch}${tail}`;
  if (full.length <= MAX_LABEL) return full;
  const h = hash(full);
  const room = MAX_LABEL - tail.length - HASH - 1;
  if (room >= 1 && cut(branch, room)) return `${cut(branch, room)}-${h}${tail}`;
  return `${cut(full, MAX_LABEL - HASH - 1)}-${h}`;
}

/** Which prototypes a set of changed (workspace-relative) paths affects, sorted. */
export function affectedPrototypes(changedPaths: string[], prototypes: string[]): string[] {
  const known = new Set(prototypes);
  const out = new Set<string>();
  for (const path of changedPaths) {
    if (SHARED_INPUTS.some((s) => (s.endsWith("/") ? path.startsWith(s) : path === s))) return [...known].sort();
    const name = /^prototypes\/([^/]+)\//.exec(path)?.[1];
    if (name && known.has(name)) out.add(name);
  }
  return [...out].sort();
}
