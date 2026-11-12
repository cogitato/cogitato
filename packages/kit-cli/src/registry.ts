import { existsSync, readFileSync } from "node:fs";
import { readSchema } from "@cogitato/contract";
import ts from "typescript";
import { findCalls, getProperty, issueAt, literalText, parseSource, propertyName, type Issue } from "./issue.js";
import { LAYOUT, isScreenFile, type Project } from "./project.js";

// Id formats come from the shared schema so the reader and the validators can't disagree.
const common = readSchema("common.schema.json") as { $defs: Record<string, { pattern: string }> };
const pattern = (name: string) => new RegExp(common.$defs[name]!.pattern);
export const ID_PATTERNS = {
  screenId: pattern("screenId"),
  slug: pattern("slug"),
  kitId: pattern("kitId"),
  nodeRef: pattern("nodeRef"),
};

interface Located {
  file: string;
  line: number;
  column: number;
}

export interface FixtureEntry extends Located {
  key: string;
  title: string;
}

export interface ScreenEntry extends Located {
  id: string;
  route: string;
  title: string;
  fixtures: FixtureEntry[];
  /** Folder of the screen (project-relative). Files inside it belong to this screen. */
  dir: string;
}

export interface EdgeEntry extends Located {
  from: string;
  to: string;
  label?: string;
}

export interface FlowEntry extends Located {
  id: string;
  title: string;
  nodes?: { ref: string; at: Located }[];
  edges: EdgeEntry[];
}

export interface Registry {
  screens: ScreenEntry[];
  flows: FlowEntry[];
  issues: Issue[];
  /**
   * False when a screen file couldn't be read as a screen. Flow checks are skipped then:
   * they'd report that screen's states as missing, which only repeats the real problem.
   */
  complete: boolean;
}

/** "card-declined" -> "Card declined". Same rule as the runtime's fixture titles. */
export function humanize(key: string): string {
  const words = key.replace(/[-_.]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function locate(sf: ts.SourceFile, node: ts.Node): Located {
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return { file: sf.fileName, line: line + 1, column: character + 1 };
}

const notStatic = (sf: ts.SourceFile, node: ts.Node, what: string, example: string) =>
  issueAt(
    "code-screen-not-static",
    sf,
    node,
    `Write ${what} as plain text, like ${example}, so Cogitato can find it without running the code.`,
  );

/** Reads the defineScreen({...}) registration in one screen.tsx. */
export function readScreen(sf: ts.SourceFile): { screen?: ScreenEntry; issues: Issue[] } {
  const issues: Issue[] = [];
  const calls = findCalls(sf, "defineScreen");
  if (calls.length === 0) {
    const first = sf.statements[0] ?? sf;
    issues.push(
      issueAt(
        "code-screen-missing",
        sf,
        first,
        `${sf.fileName} doesn't register a screen. Export one with \`export default defineScreen({ ... })\`.`,
      ),
    );
    return { issues };
  }
  const call = calls[0]!;
  const arg = call.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    issues.push(notStatic(sf, arg ?? call, "the screen's settings", "`defineScreen({ id: \"cart\", ... })`"));
    return { issues };
  }

  const text = (key: string, example: string): string | undefined => {
    const prop = getProperty(arg, key);
    const shorthand = arg.properties.find((p) => ts.isShorthandPropertyAssignment(p) && p.name.text === key);
    if (!prop && shorthand) {
      issues.push(notStatic(sf, shorthand, `the screen's ${key}`, `\`${key}: ${example}\``));
      return undefined;
    }
    if (!prop) {
      issues.push(issueAt("code-screen-incomplete", sf, arg, `This screen is missing its \`${key}\`. Add it, like \`${key}: ${example}\`.`));
      return undefined;
    }
    const value = literalText(prop.initializer);
    if (value === undefined) issues.push(notStatic(sf, prop.initializer, `the screen's ${key}`, `\`${example}\``));
    return value;
  };
  const id = text("id", '"checkout.payment"');
  const route = text("route", '"/checkout/payment"');
  const title = text("title", '"Payment"');

  if (id !== undefined && !ID_PATTERNS.screenId.test(id)) {
    issues.push(
      issueAt("code-invalid-screen-id", sf, getProperty(arg, "id")!.initializer,
        `"${id}" isn't a valid screen id. Screen ids are lowercase words separated by dots, like "checkout.payment".`),
    );
  }
  if (route === "/") {
    issues.push(issueAt("code-invalid-route", sf, getProperty(arg, "route")!.initializer, `The address "/" is the prototype's list of screens, so a screen can't use it. Pick another one, like "/home".`));
  }
  if (route !== undefined && !route.startsWith("/")) {
    issues.push(
      issueAt("code-invalid-route", sf, getProperty(arg, "route")!.initializer, `The address "${route}" needs to start with "/", like "/checkout/payment".`),
    );
  }

  const fixtures: FixtureEntry[] = [];
  const fixturesProp = getProperty(arg, "fixtures");
  if (!fixturesProp) {
    issues.push(issueAt("code-missing-default-fixture", sf, arg, `This screen has no states. Add \`fixtures: { default: { data: {} } }\`; every screen needs a "default" state.`));
  } else if (!ts.isObjectLiteralExpression(fixturesProp.initializer)) {
    issues.push(notStatic(sf, fixturesProp.initializer, "the screen's states (fixtures)", "`fixtures: { default: { data: {...} } }`"));
  } else {
    for (const p of fixturesProp.initializer.properties) {
      const key = ts.isPropertyAssignment(p) ? propertyName(p.name) : undefined;
      if (!ts.isPropertyAssignment(p) || key === undefined) {
        issues.push(notStatic(sf, p, "each state's name", '`"card-declined": { data: {...} }`'));
        continue;
      }
      if (!ID_PATTERNS.slug.test(key)) {
        issues.push(issueAt("code-invalid-fixture-name", sf, p.name, `The state name "${key}" isn't valid. Use lowercase words joined by dashes, like "card-declined".`));
      }
      let fixtureTitle = humanize(key);
      if (ts.isObjectLiteralExpression(p.initializer)) {
        const titleProp = getProperty(p.initializer, "title");
        if (titleProp) {
          const t = literalText(titleProp.initializer);
          if (t === undefined) issues.push(notStatic(sf, titleProp.initializer, "the state's title", '`title: "Card declined"`'));
          else fixtureTitle = t;
        }
      } else {
        issues.push(notStatic(sf, p.initializer, `the "${key}" state`, '`{ title: "Card declined", data: {...} }`'));
      }
      fixtures.push({ key, title: fixtureTitle, ...locate(sf, p.name) });
    }
    if (!fixtures.some((f) => f.key === "default")) {
      issues.push(
        issueAt("code-missing-default-fixture", sf, fixturesProp.name,
          `${title ?? "This screen"} has no "default" state. Every screen needs one; it's what the screen shows when it first opens.`),
      );
    }
  }

  if (id === undefined || route === undefined || title === undefined) return { issues };
  const dir = sf.fileName.slice(0, sf.fileName.lastIndexOf("/"));
  return { screen: { id, route, title, fixtures, dir, ...locate(sf, call) }, issues };
}

/** Reads defineFlows([...]) from src/flows.ts. */
export function readFlows(sf: ts.SourceFile): { flows: FlowEntry[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const flows: FlowEntry[] = [];
  const flowsNotStatic = (node: ts.Node, what: string, example: string) =>
    issueAt("code-flows-not-static", sf, node, `Write ${what} as plain text, like ${example}, so Cogitato can read it without running the code.`);

  const call = findCalls(sf, "defineFlows")[0];
  if (!call) return { flows, issues };
  const list = call.arguments[0];
  if (!list || !ts.isArrayLiteralExpression(list)) {
    issues.push(flowsNotStatic(list ?? call, "the list of flows", "`defineFlows([{ id: \"checkout\", ... }])`"));
    return { flows, issues };
  }
  for (const el of list.elements) {
    if (!ts.isObjectLiteralExpression(el)) {
      issues.push(flowsNotStatic(el, "each flow", '`{ id: "checkout", title: "Checkout", edges: [...] }`'));
      continue;
    }
    const idProp = getProperty(el, "id");
    const titleProp = getProperty(el, "title");
    const id = literalText(idProp?.initializer);
    const title = literalText(titleProp?.initializer);
    if (id === undefined) issues.push(flowsNotStatic(idProp?.initializer ?? el, "the flow's id", '`id: "checkout"`'));
    if (title === undefined) issues.push(flowsNotStatic(titleProp?.initializer ?? el, "the flow's title", '`title: "Checkout"`'));

    const edges: EdgeEntry[] = [];
    const edgesProp = getProperty(el, "edges");
    if (!edgesProp || !ts.isArrayLiteralExpression(edgesProp.initializer)) {
      issues.push(flowsNotStatic(edgesProp?.initializer ?? el, "the flow's arrows (edges)", '`edges: [{ from: "cart.default", to: "checkout.shipping.default" }]`'));
    } else {
      for (const e of edgesProp.initializer.elements) {
        const from = ts.isObjectLiteralExpression(e) ? literalText(getProperty(e, "from")?.initializer) : undefined;
        const to = ts.isObjectLiteralExpression(e) ? literalText(getProperty(e, "to")?.initializer) : undefined;
        if (!ts.isObjectLiteralExpression(e) || from === undefined || to === undefined) {
          issues.push(flowsNotStatic(e, "each arrow", '`{ from: "cart.default", to: "checkout.shipping.default" }`'));
          continue;
        }
        const labelProp = getProperty(e, "label");
        const label = literalText(labelProp?.initializer);
        if (labelProp && label === undefined) issues.push(flowsNotStatic(labelProp.initializer, "the arrow's label", '`label: "Pay now"`'));
        edges.push({ from, to, ...(label !== undefined ? { label } : {}), ...locate(sf, e) });
      }
    }

    let nodes: FlowEntry["nodes"];
    const nodesProp = getProperty(el, "nodes");
    if (nodesProp) {
      if (!ts.isArrayLiteralExpression(nodesProp.initializer)) {
        issues.push(flowsNotStatic(nodesProp.initializer, "the flow's steps (nodes)", '`nodes: ["cart.default"]`'));
      } else {
        nodes = [];
        for (const n of nodesProp.initializer.elements) {
          const ref = literalText(n);
          if (ref === undefined) issues.push(flowsNotStatic(n, "each step", '`"cart.default"`'));
          else nodes.push({ ref, at: locate(sf, n) });
        }
      }
    }
    if (id !== undefined && title !== undefined) flows.push({ id, title, edges, nodes, ...locate(sf, el) });
  }
  return { flows, issues };
}

const cache = new Map<string, { text: string; sf: ts.SourceFile }>();

/** Parses a project file, reusing the parse while its text is unchanged (keeps repeat runs fast). */
export function parseProjectFile(project: Project, rel: string): ts.SourceFile {
  const text = readFileSync(project.abs(rel), "utf8");
  const hit = cache.get(project.abs(rel));
  if (hit && hit.text === text) return hit.sf;
  const sf = parseSource(rel, text);
  cache.set(project.abs(rel), { text, sf });
  return sf;
}

/** Reads every screen registration and src/flows.ts. Never runs prototype code. */
export function readRegistry(project: Project, files: string[]): Registry {
  const issues: Issue[] = [];
  const screens: ScreenEntry[] = [];
  const seen = new Map<string, ScreenEntry>();
  let complete = true;
  for (const rel of files.filter(isScreenFile)) {
    const r = readScreen(parseProjectFile(project, rel));
    issues.push(...r.issues);
    if (!r.screen) {
      complete = false;
      continue;
    }
    const other = seen.get(r.screen.id);
    if (other) {
      issues.push({
        code: "code-duplicate-screen",
        severity: "error",
        file: r.screen.file,
        path: "",
        line: r.screen.line,
        column: r.screen.column,
        message: `The screen id "${r.screen.id}" is already used by ${other.file}. Each screen needs its own id.`,
      });
      continue;
    }
    seen.set(r.screen.id, r.screen);
    screens.push(r.screen);
  }

  let flows: FlowEntry[] = [];
  if (existsSync(project.abs(LAYOUT.flowsTs))) {
    const r = readFlows(parseProjectFile(project, LAYOUT.flowsTs));
    issues.push(...r.issues);
    flows = r.flows;
  }
  return { screens, flows, issues, complete };
}
