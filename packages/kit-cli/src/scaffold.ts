import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ValidationResult } from "@cogitato/contract";
import ts from "typescript";
import { KitError } from "./errors.js";
import { exportFlows } from "./export-flows.js";
import { findCalls, getProperty, literalText, parseSource } from "./issue.js";
import { canvasLink, stateLink } from "./links.js";
import { LAYOUT, sourceFiles, type Project } from "./project.js";
import { ID_PATTERNS, humanize, readRegistry, type Registry, type ScreenEntry } from "./registry.js";
import { validate } from "./validate.js";

// Scaffolding edits source files in place: it finds the right spot with the TypeScript parser
// and inserts text there, so the rest of the file (comments, formatting) is left as it was.

export interface ScaffoldResult extends ValidationResult {
  /** Project-relative files that were created or changed. */
  files: string[];
  /** The new screen or state, as "{screen id}.{state}". */
  node: string;
  /** Where to see it in the running prototype. */
  link: string;
  /** Its frame on the local canvas, among the rest of the flow. */
  canvas: string;
}

export interface CreateScreenOptions {
  id: string;
  title?: string;
  route?: string;
  /** Add an arrow to the new screen from this state ("{screen id}.{state}"). */
  from?: string;
  label?: string;
  /** Flow to add the arrow to. Defaults to the flow that already has `from`. */
  flow?: string;
}

export interface AddStateOptions {
  screen: string;
  state: string;
  title?: string;
  from?: string;
  label?: string;
  flow?: string;
}

export interface AddEdgeOptions {
  from: string;
  to: string;
  label?: string;
  flow?: string;
}

const q = (s: string) => JSON.stringify(s);

/** Indentation of the line that `pos` is on. */
function indentAt(text: string, pos: number): string {
  const start = text.lastIndexOf("\n", pos - 1) + 1;
  return /^[ \t]*/.exec(text.slice(start))![0];
}

/**
 * Adds `item` as the last element of an array or object literal, matching how the existing
 * elements are laid out (one per line, or all on one line).
 */
function appendToLiteral(
  sf: ts.SourceFile,
  text: string,
  node: ts.ArrayLiteralExpression | ts.ObjectLiteralExpression,
  item: (indent: string) => string,
): string {
  const elements = ts.isArrayLiteralExpression(node) ? node.elements : node.properties;
  const start = node.getStart(sf);
  const close = node.getEnd() - 1;
  const last = elements[elements.length - 1];
  if (!last) {
    const indent = indentAt(text, start);
    const open = text[start]!;
    return `${text.slice(0, start)}${open}\n${indent}  ${item(`${indent}  `)},\n${indent}${text[close]}${text.slice(node.getEnd())}`;
  }
  const lastEnd = last.getEnd();
  if (!text.slice(start, last.getStart(sf)).includes("\n")) {
    return `${text.slice(0, lastEnd)}, ${item(indentAt(text, start))}${text.slice(lastEnd)}`;
  }
  const indent = indentAt(text, last.getStart(sf));
  const comma = text.indexOf(",", lastEnd);
  const at = elements.hasTrailingComma && comma >= 0 && comma < close ? comma + 1 : lastEnd;
  return `${text.slice(0, at)}${elements.hasTrailingComma ? "" : ","}\n${indent}${item(indent)},${text.slice(at)}`;
}

const registryOf = (project: Project) => readRegistry(project, sourceFiles(project));

function splitNode(node: string): { screen: string; state: string } {
  const dot = node.lastIndexOf(".");
  if (dot < 0) throw new KitError(`"${node}" isn't a step. Steps are written as "{screen id}.{state}", like "checkout.payment.default".`);
  return { screen: node.slice(0, dot), state: node.slice(dot + 1) };
}

function requireStep(reg: Registry, node: string): void {
  const { screen, state } = splitNode(node);
  const s = reg.screens.find((x) => x.id === screen);
  if (!s) throw new KitError(`There's no screen with the id "${screen}".`);
  if (!s.fixtures.some((f) => f.key === state)) {
    throw new KitError(`The ${s.title} screen has no state called "${state}" (it has: ${s.fixtures.map((f) => `"${f.key}"`).join(", ")}).`);
  }
}

function finish(project: Project, files: string[], node: string): ScaffoldResult {
  exportFlows(project);
  const r = validate(project, { files });
  return { ...r, files, node, link: stateLink(project, node), canvas: canvasLink(project, node) };
}

function componentName(id: string): string {
  const last = id.slice(id.lastIndexOf(".") + 1);
  return last.replace(/(^|[-_])([a-z0-9])/g, (_m, _s, c: string) => c.toUpperCase()) + "Screen";
}

function screenSource(id: string, route: string, title: string): string {
  const name = componentName(id);
  return `import { defineScreen } from "@cogitato/runtime";

// Build this screen with components from the design kit (@/kit/...) and token variables only.
function ${name}() {
  return (
    <main>
      <h1>${title.replace(/[{}<>]/g, "")}</h1>
    </main>
  );
}

export default defineScreen({
  id: ${q(id)},
  route: ${q(route)},
  title: ${q(title)},
  fixtures: {
    default: { title: "Default", data: {} },
  },
  component: ${name},
});
`;
}

/** Creates src/screens/<id as folders>/screen.tsx with a default state, and optionally an arrow to it. */
export function createScreen(project: Project, opts: CreateScreenOptions): ScaffoldResult {
  const { id } = opts;
  if (!ID_PATTERNS.screenId.test(id)) {
    throw new KitError(`"${id}" isn't a valid screen id. Use lowercase words separated by dots, like "checkout.review".`);
  }
  const reg = registryOf(project);
  if (reg.screens.some((s) => s.id === id)) throw new KitError(`There's already a screen called "${id}".`);
  const route = opts.route ?? `/${id.split(".").join("/")}`;
  if (!route.startsWith("/")) throw new KitError(`The address "${route}" needs to start with "/", like "/checkout/review".`);
  const clash = reg.screens.find((s) => s.route === route);
  if (clash) throw new KitError(`The address "${route}" is already used by the ${clash.title} screen. Pick another one.`);
  if (opts.from) requireStep(reg, opts.from);

  const file = `${LAYOUT.screens}/${id.split(".").join("/")}/${LAYOUT.screenFile}`;
  if (existsSync(project.abs(file))) throw new KitError(`${file} already exists. Pick another screen id.`);
  const title = opts.title?.trim() || humanize(id.slice(id.lastIndexOf(".") + 1));
  mkdirSync(dirname(project.abs(file)), { recursive: true });
  writeFileSync(project.abs(file), screenSource(id, route, title));

  const node = `${id}.default`;
  const files = [file];
  if (opts.from) files.push(insertEdge(project, { from: opts.from, to: node, label: opts.label, flow: opts.flow }));
  return finish(project, files, node);
}

function fixturesLiteral(sf: ts.SourceFile): ts.ObjectLiteralExpression | undefined {
  const arg = findCalls(sf, "defineScreen")[0]?.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
  const init = getProperty(arg, "fixtures")?.initializer;
  return init && ts.isObjectLiteralExpression(init) ? init : undefined;
}

/** Adds a state (fixture) to an existing screen, and optionally an arrow to it. */
export function addState(project: Project, opts: AddStateOptions): ScaffoldResult {
  const { state } = opts;
  if (!ID_PATTERNS.slug.test(state)) {
    throw new KitError(`"${state}" isn't a valid state name. Use lowercase words joined by dashes, like "card-expired".`);
  }
  const reg = registryOf(project);
  const screen: ScreenEntry | undefined = reg.screens.find((s) => s.id === opts.screen);
  if (!screen) throw new KitError(`There's no screen with the id "${opts.screen}".`);
  if (screen.fixtures.some((f) => f.key === state)) throw new KitError(`The ${screen.title} screen already has a "${state}" state.`);
  if (opts.from) requireStep(reg, opts.from);

  const text = readFileSync(project.abs(screen.file), "utf8");
  const sf = parseSource(screen.file, text);
  const fixtures = fixturesLiteral(sf);
  if (!fixtures) throw new KitError(`Couldn't find the list of states in ${screen.file}.`);
  const title = opts.title?.trim() || humanize(state);
  const key = /^[a-z_$][a-z0-9_$]*$/i.test(state) ? state : q(state);
  writeFileSync(project.abs(screen.file), appendToLiteral(sf, text, fixtures, () => `${key}: { title: ${q(title)}, data: {} }`));

  const node = `${screen.id}.${state}`;
  const files = [screen.file];
  if (opts.from) files.push(insertEdge(project, { from: opts.from, to: node, label: opts.label, flow: opts.flow }));
  return finish(project, files, node);
}

/** Adds an arrow between two existing states in src/flows.ts. */
export function addEdge(project: Project, opts: AddEdgeOptions): ScaffoldResult {
  const reg = registryOf(project);
  requireStep(reg, opts.from);
  requireStep(reg, opts.to);
  return finish(project, [insertEdge(project, opts)], opts.to);
}

function edgeText(e: AddEdgeOptions): string {
  return `{ from: ${q(e.from)}, to: ${q(e.to)}${e.label ? `, label: ${q(e.label)}` : ""} }`;
}

/** Writes the arrow into src/flows.ts (creating the file or the flow if needed). Returns the file. */
function insertEdge(project: Project, e: AddEdgeOptions): string {
  const file = LAYOUT.flowsTs;
  const path = project.abs(file);
  const flowId = (flows: { id: string; edges: { from: string; to: string }[] }[]) =>
    e.flow ??
    flows.find((f) => f.edges.some((x) => x.from === e.from || x.to === e.from))?.id ??
    flows[0]?.id ??
    splitNode(e.from).screen.split(".")[0]!;

  if (!existsSync(path)) {
    const id = e.flow ?? splitNode(e.from).screen.split(".")[0]!;
    writeFileSync(
      path,
      `import { defineFlows } from "@cogitato/runtime";

// How screens connect. Each step is "{screen id}.{state}".
export default defineFlows([
  {
    id: ${q(id)},
    title: ${q(humanize(id))},
    edges: [
      ${edgeText(e)},
    ],
  },
]);
`,
    );
    return file;
  }

  const text = readFileSync(path, "utf8");
  const sf = parseSource(file, text);
  const list = findCalls(sf, "defineFlows")[0]?.arguments[0];
  if (!list || !ts.isArrayLiteralExpression(list)) throw new KitError(`Couldn't find the list of flows in ${file}.`);
  const flows = list.elements.filter(ts.isObjectLiteralExpression).map((el) => {
    const edges = getProperty(el, "edges")?.initializer;
    const edgeList = edges && ts.isArrayLiteralExpression(edges) ? edges : undefined;
    return {
      el,
      id: literalText(getProperty(el, "id")?.initializer) ?? "",
      edgeList,
      edges: [...(edgeList?.elements ?? [])].filter(ts.isObjectLiteralExpression).map((x) => ({
        from: literalText(getProperty(x, "from")?.initializer) ?? "",
        to: literalText(getProperty(x, "to")?.initializer) ?? "",
      })),
    };
  });
  const target = flowId(flows);
  const flow = flows.find((f) => f.id === target);
  if (flow?.edges.some((x) => x.from === e.from && x.to === e.to)) return file;

  let next: string;
  if (flow) {
    if (!flow.edgeList) throw new KitError(`Couldn't find the arrows (edges) of the "${target}" flow in ${file}.`);
    next = appendToLiteral(sf, text, flow.edgeList, () => edgeText(e));
  } else {
    next = appendToLiteral(sf, text, list, (indent) =>
      [
        "{",
        `${indent}  id: ${q(target)},`,
        `${indent}  title: ${q(humanize(target))},`,
        `${indent}  edges: [`,
        `${indent}    ${edgeText(e)},`,
        `${indent}  ],`,
        `${indent}}`,
      ].join("\n"),
    );
  }
  writeFileSync(path, next);
  return file;
}
