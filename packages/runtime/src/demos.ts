import type { ComponentManifest } from "@cogitato/contract/browser";
import { humanize } from "./define.js";

export interface Demo {
  label: string;
  props: Record<string, unknown>;
}

export interface DemoGroup {
  /** What varies in this group, e.g. "variant" or "states". */
  title: string;
  demos: Demo[];
}

const noop = () => {};

/** Props every demo starts from: placeholders for required content, no-ops for events. */
export function baseProps(manifest: ComponentManifest): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(manifest.props)) {
    if (!def) continue;
    if (def.type === "node") props[name] = name === "children" ? manifest.name : humanize(name);
    else if (def.type === "event") props[name] = noop;
    else if (def.type === "string" && def.required) props[name] = humanize(name);
  }
  return props;
}

/**
 * Demos generated from a manifest: one per value of each enum prop, plus one per state that a
 * prop can switch on (a boolean prop named like the state, or a string prop such as `error`).
 */
export function generateDemos(manifest: ComponentManifest): DemoGroup[] {
  const base = baseProps(manifest);
  const groups: DemoGroup[] = [];
  for (const [name, def] of Object.entries(manifest.props)) {
    if (def?.type !== "enum") continue;
    groups.push({
      title: name,
      demos: def.values.map((value) => ({ label: `${name}="${value}"`, props: { ...base, [name]: value } })),
    });
  }
  const stateDemos: Demo[] = [];
  for (const state of manifest.states) {
    const def = manifest.props[state];
    if (def?.type === "boolean") stateDemos.push({ label: state, props: { ...base, [state]: true } });
    if (def?.type === "string") stateDemos.push({ label: state, props: { ...base, [state]: `Example ${state} text` } });
  }
  if (stateDemos.length) groups.push({ title: "states", demos: stateDemos });
  if (!groups.length) groups.push({ title: "default", demos: [{ label: "default", props: base }] });
  return groups;
}
