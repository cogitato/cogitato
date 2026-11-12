import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  AnnotationExport,
  ComponentManifest,
  DecisionLog,
  DesignTokens,
  FlowManifest,
  GapLog,
  HandoffSpec,
} from "./generated/types.js";
import { fromAjvErrors, pointer, result, type Issue, type ValidationResult } from "./issues.js";
import {
  SCHEMA_BASE,
  SCHEMA_VERSIONS,
  formatSchemas,
  getValidator,
  type FormatName,
  type VersionedFormat,
} from "./schemas.js";
import { checkTokens } from "./tokens.js";

const error = (code: string, file: string, path: string, message: string): Issue => ({
  code,
  severity: "error",
  file,
  path,
  message,
});

const warning = (code: string, file: string, path: string, message: string): Issue => ({
  code,
  severity: "warning",
  file,
  path,
  message,
});

const isVersioned = (format: FormatName): format is VersionedFormat => format in SCHEMA_VERSIONS;

/**
 * Checks schemaVersion before the schema runs, so a file from a newer Cogitato gets
 * "update Cogitato" instead of a pile of schema errors.
 * Returns an issue when the file can't be validated by this version.
 */
function checkVersion(format: VersionedFormat, data: unknown, file: string): Issue | undefined {
  const version = (data as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof version !== "number") return undefined; // the schema reports it
  const supported = SCHEMA_VERSIONS[format];
  if (version > supported) {
    return error(
      "schema-version-too-new",
      file,
      "/schemaVersion",
      `${file} was made with a newer version of Cogitato (format version ${version}). This version understands up to format version ${supported}. Update Cogitato, then try again.`,
    );
  }
  if (version < supported) {
    return error(
      "schema-version-migration-needed",
      file,
      "/schemaVersion",
      `${file} uses an older format (version ${version}). It needs to be upgraded to version ${supported} before it can be used.`,
    );
  }
  return undefined;
}

/** Schema check for one document, including the schemaVersion guard. */
export function validateFormat(format: FormatName, data: unknown, file: string = format): ValidationResult {
  if (isVersioned(format)) {
    const versionIssue = checkVersion(format, data, file);
    if (versionIssue) return result([versionIssue]);
  }
  const validate = getValidator(format);
  if (validate(data)) return result([]);
  return result(fromAjvErrors(validate.errors ?? [], file, SCHEMA_BASE + formatSchemas[format]));
}

type Read<T> = { ok: true; data: T } | { ok: false; issue: Issue };

function readJson<T>(absPath: string, file: string): Read<T> {
  if (!existsSync(absPath)) {
    return { ok: false, issue: error("file-missing", file, "", `Can't find ${file}. It needs to be there.`) };
  }
  try {
    return { ok: true, data: JSON.parse(readFileSync(absPath, "utf8")) as T };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      issue: error("file-invalid-json", file, "", `${file} can't be read because it has a typo in its JSON (${detail}).`),
    };
  }
}

/** "TextField" -> "text-field" */
export function kebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z])([A-Z][a-z])/g, "$1-$2").toLowerCase();
}

function checkComponents(entries: { file: string; data: ComponentManifest }[]): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, string>();
  for (const { file, data } of entries) {
    const expected = `${kebabCase(data.name)}.json`;
    const actual = file.split("/").at(-1);
    if (actual !== expected) {
      issues.push(
        error(
          "component-file-name-mismatch",
          file,
          "/name",
          `${actual} describes the "${data.name}" component, so it should be named ${expected}. Rename the file, or fix the name inside it.`,
        ),
      );
    }
    const other = seen.get(data.name);
    if (other) {
      issues.push(
        error("component-duplicate-name", file, "/name", `"${data.name}" is described twice, in ${other} and ${file}. Keep one.`),
      );
    }
    seen.set(data.name, file);

    for (const [prop, def] of Object.entries(data.props)) {
      if (!def || !("default" in def) || def.default === undefined) continue;
      const at = pointer("props", prop, "default");
      if (def.type === "enum" && !def.values.includes(def.default)) {
        issues.push(
          error(
            "component-invalid-default",
            file,
            at,
            `The default for "${prop}" is "${def.default}", which isn't one of its options (${def.values.map((v) => `"${v}"`).join(", ")}).`,
          ),
        );
      }
      if (def.type === "number" && ((def.min !== undefined && def.default < def.min) || (def.max !== undefined && def.default > def.max))) {
        issues.push(error("component-invalid-default", file, at, `The default for "${prop}" (${def.default}) is outside its allowed range.`));
      }
    }
  }
  return issues;
}

function checkDecisions(log: DecisionLog, file: string): Issue[] {
  const issues: Issue[] = [];
  const ids = new Set<string>();
  log.decisions.forEach((d, i) => {
    if (ids.has(d.id)) issues.push(error("decision-duplicate-id", file, pointer("decisions", i, "id"), `Two decisions share the id "${d.id}". Each needs its own.`));
    ids.add(d.id);
    const options = d.options.map((o) => o.id);
    for (const key of ["recommendation", "choice"] as const) {
      const value = d[key];
      if (value !== undefined && !options.includes(value)) {
        issues.push(
          error(
            "decision-unknown-option",
            file,
            pointer("decisions", i, key),
            `Decision "${d.id}" has its ${key} set to "${value}", which isn't one of its options (${options.map((o) => `"${o}"`).join(", ")}).`,
          ),
        );
      }
    }
  });
  return issues;
}

function checkGaps(log: GapLog, file: string): Issue[] {
  const ids = new Set<string>();
  return log.gaps.flatMap((g, i) => {
    const dupe = ids.has(g.id);
    ids.add(g.id);
    return dupe ? [error("gap-duplicate-id", file, pointer("gaps", i, "id"), `Two gaps share the id "${g.id}". Each needs its own.`)] : [];
  });
}

/**
 * Validates a contract folder (design/contract/): every file against its schema,
 * then the checks a schema can't express (token aliases and types, file names, references).
 * `prefix` is prepended to file names in issues, e.g. "contract/".
 */
export function validateContractDir(dir: string, prefix = ""): ValidationResult {
  const issues: Issue[] = [];
  const label = (name: string) => prefix + name;

  // contract.json carries the schemaVersion for the whole folder, so it gates everything else.
  const meta = readJson<unknown>(join(dir, "contract.json"), label("contract.json"));
  if (!meta.ok) return result([meta.issue]);
  const metaResult = validateFormat("contract", meta.data, label("contract.json"));
  if (metaResult.issues.some((i) => i.code.startsWith("schema-version-"))) return metaResult;
  issues.push(...metaResult.issues);

  const tokens = readJson<DesignTokens>(join(dir, "tokens.json"), label("tokens.json"));
  if (!tokens.ok) issues.push(tokens.issue);
  else {
    const r = validateFormat("tokens", tokens.data, label("tokens.json"));
    issues.push(...r.issues);
    if (r.ok) issues.push(...checkTokens(tokens.data, label("tokens.json")));
  }

  const componentsDir = join(dir, "components");
  const componentFiles = existsSync(componentsDir) && statSync(componentsDir).isDirectory()
    ? readdirSync(componentsDir).filter((f) => f.endsWith(".json")).sort()
    : [];
  if (componentFiles.length === 0) {
    issues.push(error("contract-no-components", label("components/"), "", "The contract has no components yet. Add at least one file to the components folder."));
  }
  const components: { file: string; data: ComponentManifest }[] = [];
  for (const name of componentFiles) {
    const file = label(`components/${name}`);
    const read = readJson<ComponentManifest>(join(componentsDir, name), file);
    if (!read.ok) {
      issues.push(read.issue);
      continue;
    }
    const r = validateFormat("component", read.data, file);
    issues.push(...r.issues);
    if (r.ok) components.push({ file, data: read.data });
  }
  issues.push(...checkComponents(components));

  const decisions = readJson<DecisionLog>(join(dir, "decisions.json"), label("decisions.json"));
  if (!decisions.ok) issues.push(decisions.issue);
  else {
    const r = validateFormat("decisions", decisions.data, label("decisions.json"));
    issues.push(...r.issues);
    if (r.ok) issues.push(...checkDecisions(decisions.data, label("decisions.json")));
  }

  const gaps = readJson<GapLog>(join(dir, "gaps.json"), label("gaps.json"));
  if (!gaps.ok) issues.push(gaps.issue);
  else {
    const r = validateFormat("gaps", gaps.data, label("gaps.json"));
    issues.push(...r.issues);
    if (r.ok) issues.push(...checkGaps(gaps.data, label("gaps.json")));
  }

  const rulesPath = join(dir, "rules.md");
  if (!existsSync(rulesPath)) {
    issues.push(error("file-missing", label("rules.md"), "", "Can't find rules.md. It holds the design system's do's and don'ts and needs to be there."));
  } else if (readFileSync(rulesPath, "utf8").trim() === "") {
    issues.push(error("rules-empty", label("rules.md"), "", "rules.md is empty. Add at least a few do's and don'ts."));
  }

  return result(issues);
}

/** Splits "checkout.payment.card-declined" into screen "checkout.payment" and state "card-declined". */
export function parseNodeRef(node: string): { screen: string; state: string } {
  const dot = node.lastIndexOf(".");
  return { screen: node.slice(0, dot), state: node.slice(dot + 1) };
}

/** Every "{screenId}.{stateId}" in a flow manifest. */
export function nodeRefs(flows: FlowManifest): Set<string> {
  return new Set(flows.screens.flatMap((s) => s.states.map((st) => `${s.id}.${st.id}`)));
}

function checkFlows(flows: FlowManifest, file: string): Issue[] {
  const issues: Issue[] = [];
  const screenIds = new Set<string>();
  const routes = new Map<string, string>();
  flows.screens.forEach((screen, i) => {
    if (screenIds.has(screen.id)) {
      issues.push(error("flows-duplicate-screen", file, pointer("screens", i, "id"), `There are two screens with the id "${screen.id}". Each screen needs its own id.`));
    }
    screenIds.add(screen.id);
    const sameRoute = routes.get(screen.route);
    if (sameRoute) {
      issues.push(error("flows-duplicate-route", file, pointer("screens", i, "route"), `"${screen.title}" and "${sameRoute}" both use the address ${screen.route}. Each screen needs its own.`));
    }
    routes.set(screen.route, screen.title);
    const stateIds = new Set<string>();
    screen.states.forEach((state, j) => {
      if (stateIds.has(state.id)) {
        issues.push(error("flows-duplicate-state", file, pointer("screens", i, "states", j, "id"), `"${screen.title}" has two states called "${state.id}". Each state needs its own name.`));
      }
      stateIds.add(state.id);
    });
    if (!stateIds.has("default")) {
      issues.push(error("flows-missing-default-state", file, pointer("screens", i, "states"), `"${screen.title}" (${screen.id}) has no "default" state. Every screen needs one; it's what the screen shows when it first opens.`));
    }
  });

  const known = nodeRefs(flows);
  const unknownNode = (node: string, at: string, where: string) => {
    const { screen } = parseNodeRef(node);
    const reason = screenIds.has(screen)
      ? `the "${screen}" screen has no state called "${parseNodeRef(node).state}"`
      : `there's no screen with the id "${screen}"`;
    issues.push(error("flows-unknown-node", file, at, `${where} refers to "${node}", but ${reason}.`));
  };

  const flowIds = new Set<string>();
  flows.flows.forEach((flow, i) => {
    if (flowIds.has(flow.id)) issues.push(error("flows-duplicate-flow", file, pointer("flows", i, "id"), `There are two flows with the id "${flow.id}". Each needs its own.`));
    flowIds.add(flow.id);
    const inFlow = new Set(flow.nodes);
    flow.nodes.forEach((node, j) => {
      if (!known.has(node)) unknownNode(node, pointer("flows", i, "nodes", j), `The "${flow.title}" flow`);
    });
    flow.edges.forEach((edge, j) => {
      for (const end of ["from", "to"] as const) {
        if (!inFlow.has(edge[end])) {
          issues.push(
            error(
              "flows-edge-outside-flow",
              file,
              pointer("flows", i, "edges", j, end),
              `An arrow in the "${flow.title}" flow ${end === "from" ? "starts at" : "points to"} "${edge[end]}", which isn't one of that flow's steps. Add it to the flow's nodes, or fix the arrow.`,
            ),
          );
        }
      }
    });
  });

  for (const node of Object.keys(flows.status ?? {})) {
    if (!known.has(node)) unknownNode(node, pointer("status", node), "A review status");
  }
  return issues;
}

/** Validates design/flows.json: schema plus screen, state, flow and edge references. */
export function validateFlows(data: unknown, file = "flows.json"): ValidationResult {
  const r = validateFormat("flows", data, file);
  if (!r.ok) return r;
  return result(checkFlows(data as FlowManifest, file));
}

/**
 * Validates an annotation export. With `flows`, also warns about comments whose screen or
 * state no longer exists (they still load as detached, so this isn't an error).
 */
export function validateAnnotations(data: unknown, file = "annotations.json", flows?: FlowManifest): ValidationResult {
  const r = validateFormat("annotations", data, file);
  if (!r.ok) return r;
  const exported = data as AnnotationExport;
  const issues: Issue[] = [];
  const ids = new Set<string>();
  const known = flows ? nodeRefs(flows) : undefined;
  exported.annotations.forEach((a, i) => {
    if (ids.has(a.id)) issues.push(error("annotation-duplicate-id", file, pointer("annotations", i, "id"), `Two comments share the id "${a.id}".`));
    ids.add(a.id);
    const { screen, state, kitId } = a.anchor;
    if (kitId && !kitId.startsWith(`${screen}.`)) {
      issues.push(
        error(
          "annotation-kit-id-mismatch",
          file,
          pointer("annotations", i, "anchor", "kitId"),
          `Comment ${a.id} is on the "${screen}" screen, but it's pinned to "${kitId}", which belongs to a different screen. Element ids start with their screen's id.`,
        ),
      );
    }
    if (known && !known.has(`${screen}.${state}`)) {
      issues.push(
        warning(
          "annotation-unknown-state",
          file,
          pointer("annotations", i, "anchor"),
          `Comment ${a.id} is on "${screen}.${state}", which isn't in the prototype anymore. It will show as detached.`,
        ),
      );
    }
  });
  return result(issues);
}

/** Validates a handoff spec.json. With `flows`, also checks that flow and state references exist. */
export function validateSpec(data: unknown, file = "spec.json", flows?: FlowManifest): ValidationResult {
  const r = validateFormat("spec", data, file);
  if (!r.ok) return r;
  const spec = data as HandoffSpec;
  const issues: Issue[] = [];

  const listed = new Map<string, string>();
  for (const group of ["reused", "modified", "new"] as const) {
    spec.componentUsage[group].forEach((c, i) => {
      const other = listed.get(c.name);
      if (other) {
        issues.push(error("spec-component-listed-twice", file, pointer("componentUsage", group, i), `${c.name} is listed as both "${other}" and "${group}". Pick one.`));
      }
      listed.set(c.name, group);
    });
  }

  if (flows) {
    const known = nodeRefs(flows);
    const flowIds = new Set(flows.flows.map((f) => f.id));
    spec.flowMap.flows.forEach((id, i) => {
      if (!flowIds.has(id)) issues.push(error("spec-unknown-flow", file, pointer("flowMap", "flows", i), `The spec mentions a flow called "${id}", but the prototype has no flow with that id.`));
    });
    const checkNode = (node: string, at: string) => {
      if (!known.has(node)) issues.push(error("spec-unknown-node", file, at, `The spec refers to "${node}", but the prototype has no screen state with that id.`));
    };
    spec.flowMap.states.forEach((s, i) => checkNode(s.node, pointer("flowMap", "states", i, "node")));
    spec.resolvedAnnotations.forEach((a, i) => checkNode(a.node, pointer("resolvedAnnotations", i, "node")));
  }
  return result(issues);
}

/**
 * Validates a prototype's design folder. `contractDir` is the design contract; in a workspace
 * it's shared by every prototype (design/contract at the workspace root).
 * Validates the contract (required), and flows.json, annotations/*.json and
 * handoff/{initiative}/spec.json when present. File names in issues are relative to the design/ folder.
 */
export function validateProject(designDir: string, contractDir: string = join(designDir, "contract")): ValidationResult {
  const issues: Issue[] = [];

  if (!existsSync(contractDir)) {
    issues.push(error("file-missing", "contract/", "", "Can't find the contract folder (design/contract). The prototype needs a design contract."));
  } else {
    issues.push(...validateContractDir(contractDir, "contract/").issues);
  }

  let flows: FlowManifest | undefined;
  const flowsPath = join(designDir, "flows.json");
  if (existsSync(flowsPath)) {
    const read = readJson<FlowManifest>(flowsPath, "flows.json");
    if (!read.ok) issues.push(read.issue);
    else {
      const r = validateFlows(read.data, "flows.json");
      issues.push(...r.issues);
      if (r.ok) flows = read.data;
    }
  }

  const annotationsDir = join(designDir, "annotations");
  if (existsSync(annotationsDir)) {
    for (const name of readdirSync(annotationsDir).filter((f) => f.endsWith(".json")).sort()) {
      const file = `annotations/${name}`;
      const read = readJson<unknown>(join(annotationsDir, name), file);
      issues.push(...(read.ok ? validateAnnotations(read.data, file, flows).issues : [read.issue]));
    }
  }

  const handoffDir = join(designDir, "handoff");
  if (existsSync(handoffDir)) {
    for (const initiative of readdirSync(handoffDir).sort()) {
      const specPath = join(handoffDir, initiative, "spec.json");
      if (!existsSync(specPath)) continue;
      const file = `handoff/${initiative}/spec.json`;
      const read = readJson<HandoffSpec>(specPath, file);
      if (!read.ok) {
        issues.push(read.issue);
        continue;
      }
      const r = validateSpec(read.data, file, flows);
      issues.push(...r.issues);
      if (r.ok && read.data.initiative !== initiative) {
        issues.push(
          error(
            "spec-initiative-mismatch",
            file,
            "/initiative",
            `This spec is in the "${initiative}" folder but says its initiative is "${read.data.initiative}". They need to match.`,
          ),
        );
      }
    }
  }

  return result(issues);
}
