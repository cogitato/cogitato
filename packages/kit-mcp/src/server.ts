import { existsSync, readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tokenCssVar } from "@cogitato/contract";
import {
  KitError,
  WORKSPACE_LAYOUT,
  addGap,
  addState,
  createScreen,
  formatResult,
  readContract,
  saveVersion,
  canvasLink,
  setStatus,
  stateLink,
  statusLabel,
  listPrototypes,
  resolvePrototype,
  validate,
  validateWorkspace,
  type Workspace,
  type ScaffoldResult,
} from "@cogitato/kit-cli";
import { z } from "zod";

// The kit MCP server: a thin layer over @cogitato/kit-cli. Every tool here calls a kit-cli
// function; nothing about the contract or the rules is decided in this package.

export const SERVER_NAME = "cogitato-kit";

const INSTRUCTIONS = `Tools for this Cogitato workspace's design contract (its design system) and its prototypes' screens.
Use them instead of reading files in design/contract: list_components and get_component before using a kit component,
get_tokens before choosing a color, size, space, radius or shadow. Create screens and states with create_screen and add_state,
then fill in the UI. If the design needs something the kit doesn't have, use log_gap rather than improvising.
Finish building work with validate and give the person the canvas_link (the canvas shows the new state among the rest of the flow). This is a design workspace: several prototypes share one design kit. Pass \`prototype\` when there's more than one; list_prototypes names them.
The person is usually a designer: plain language.`;

const text = (t: string, isError = false): CallToolResult => ({ content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) });
const json = (label: string, data: unknown): CallToolResult => text(`${label}\n\n${JSON.stringify(data, null, 2)}`);

/** Runs a tool body, turning KitErrors into tool errors Claude can explain to the designer. */
async function run(body: () => CallToolResult | Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await body();
  } catch (e) {
    if (e instanceof KitError) return text(e.message, true);
    return text(`Something went wrong in the Cogitato tools: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

function scaffolded(r: ScaffoldResult): CallToolResult {
  return text(
    [
      `Created ${r.node}. Files: ${r.files.join(", ")}.`,
      `On the canvas: ${r.canvas}`,
      `On its own: ${r.link}`,
      "",
      formatResult(r, "It validates: no problems."),
    ].join("\n"),
  );
}

/**
 * Bullet points in rules.md that mention `name`, each prefixed with its section heading
 * ("Don't: Nest a `Card` inside another `Card`.") so a "Don't" rule can't read as an instruction.
 */
export function rulesMentioning(markdown: string, name: string): string[] {
  const mentions = new RegExp(`\\b${name}\\b`);
  let section = "";
  const out: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{2,6}\s+(.+?)\s*$/.exec(line);
    if (heading) section = heading[1]!;
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet && mentions.test(bullet[1]!)) out.push(`- ${section ? `${section}: ` : ""}${bullet[1]}`);
  }
  return out;
}

const step = z.string().describe('A screen state, written "{screen id}.{state}", like "checkout.payment.default".');

const prototypeArg = z.string().optional().describe("Which prototype (a folder in prototypes/). Leave out when there's only one.");

export function createServer(ws: Workspace): McpServer {
  const at = (name?: string) => resolvePrototype(ws, name, process.env.KIT_PROJECT);
  const server = new McpServer({ name: SERVER_NAME, version: "0.1.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "list_components",
    {
      title: "List kit components",
      description: "Lists the components in the design kit with their one-line usage and source badges. Only these components may be used in screens.",
      annotations: { readOnlyHint: true },
    },
    () =>
      run(() => {
        const { manifests } = readContract(ws);
        const lines = [...manifests.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => `- ${m.name} (import from "${m.import}"; source: ${m.source}, confidence: ${m.confidence})${m.description ? `: ${m.description}` : ""}`);
        return text(lines.length ? `Kit components:\n${lines.join("\n")}` : "The kit has no components yet.");
      }),
  );

  server.registerTool(
    "get_component",
    {
      title: "Get a kit component",
      description: "Full details of one kit component: props and their allowed values, visual states, usage rules, and the design rules that mention it.",
      inputSchema: { name: z.string().describe('Component name, like "Button".') },
      annotations: { readOnlyHint: true },
    },
    ({ name }) =>
      run(() => {
        const { manifests } = readContract(ws);
        const m = manifests.get(name) ?? [...manifests.values()].find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (!m) {
          throw new KitError(`"${name}" isn't in the design kit. It has: ${[...manifests.keys()].sort().join(", ")}. If the design needs it, log a gap.`);
        }
        const rulesPath = ws.abs(`${WORKSPACE_LAYOUT.contract}/rules.md`);
        const designRules = existsSync(rulesPath) ? rulesMentioning(readFileSync(rulesPath, "utf8"), m.name) : [];
        const { $schema: _s, mapping: _m, ...manifest } = m;
        return json(`${m.name}${designRules.length ? `\n\nDesign rules that mention it:\n${designRules.join("\n")}` : ""}`, manifest);
      }),
  );

  server.registerTool(
    "get_tokens",
    {
      title: "Get design tokens",
      description:
        "Design tokens with the CSS variable to use for each (var(--kit-...)). Use these for every color, font size, space, radius and shadow; never hardcode values.",
      inputSchema: { group: z.string().optional().describe('Only tokens under this group, like "color", "space" or "color.feedback".') },
      annotations: { readOnlyHint: true },
    },
    ({ group }) =>
      run(() => {
        const { tokens } = readContract(ws);
        const picked = tokens.filter((t) => !group || t.path === group || t.path.startsWith(`${group}.`));
        if (!picked.length) {
          const groups = [...new Set(tokens.map((t) => t.path.split(".")[0]))].join(", ");
          throw new KitError(`No tokens under "${group}". Groups: ${groups}.`);
        }
        const lines = picked.map((t) => {
          const value = typeof t.resolved === "string" || typeof t.resolved === "number" ? String(t.resolved) : JSON.stringify(t.resolved);
          const notes = [t.description, t.deprecated ? `deprecated${typeof t.deprecated === "string" ? `: ${t.deprecated}` : ""}` : undefined].filter(Boolean).join("; ");
          return `- ${t.path} = ${value} → var(${tokenCssVar(t.path)})${notes ? ` (${notes})` : ""}`;
        });
        return text(`${picked.length} token${picked.length === 1 ? "" : "s"}:\n${lines.join("\n")}`);
      }),
  );

  server.registerTool(
    "create_screen",
    {
      title: "Create a screen",
      description:
        "Creates a new screen file with its default state, registered so it appears in the flow. Optionally connects an existing state to it. Then fill in the screen's UI with kit components.",
      inputSchema: {
        id: z.string().describe('Screen id: lowercase words separated by dots, like "checkout.review".'),
        title: z.string().describe('Name people see, like "Review order".'),
        route: z.string().optional().describe('Address in the prototype; defaults to the id with slashes, like "/checkout/review".'),
        from: step.optional().describe("An existing state that leads to this screen (adds an arrow in the flow)."),
        label: z.string().optional().describe('What the person does to get here, like "Continue".'),
        flow: z.string().optional().describe("Flow to add the arrow to; defaults to the flow that already has `from`."),
        prototype: prototypeArg,
      },
    },
    (args) => run(() => scaffolded(createScreen(at(args.prototype), args))),
  );

  server.registerTool(
    "add_state",
    {
      title: "Add a state to a screen",
      description:
        "Adds a state (fixture) to an existing screen, like \"card-expired\" on the payment screen, and optionally the arrow that leads to it. Then fill in the state's data and how the screen looks in it.",
      inputSchema: {
        screen: z.string().describe('Screen id, like "checkout.payment".'),
        state: z.string().describe('State name: lowercase words joined by dashes, like "card-expired".'),
        title: z.string().optional().describe('Name people see, like "Card expired".'),
        from: step.optional().describe("An existing state that leads to this one."),
        label: z.string().optional().describe('What happens to get here, like "Card expired".'),
        flow: z.string().optional(),
        prototype: prototypeArg,
      },
    },
    (args) => run(() => scaffolded(addState(at(args.prototype), args))),
  );

  server.registerTool(
    "log_gap",
    {
      title: "Log a design-system gap",
      description:
        "Records something the design needs that the kit doesn't have (a component, token or pattern), so developers can add it. Use it instead of improvising or hardcoding.",
      inputSchema: {
        kind: z.enum(["component", "token", "pattern"]),
        name: z.string().describe('What\'s missing, like "Stepper" or "color.feedback.warning-subtle".'),
        context: z.string().describe("What the designer was trying to do."),
        screen: z.string().optional().describe("Screen id where it came up."),
        workaround: z.string().optional().describe("What was used instead in the meantime."),
      },
    },
    (args) =>
      run(() => {
        const r = addGap(at(listPrototypes(ws)[0]), args);
        return text(r.created ? `Logged gap ${r.gap.id}: ${r.gap.name}.` : `This is already logged as ${r.gap.id}; nothing new was added.`);
      }),
  );

  server.registerTool(
    "validate",
    {
      title: "Check the prototype",
      description: "Checks a prototype against its design contract (with several prototypes and none named, checks the whole workspace) and returns plain-language problems with suggested fixes. Run it before finishing any building work.",
      inputSchema: {
        files: z.array(z.string()).optional().describe("Only check these files (relative to the prototype). Leave out to check everything."),
        prototype: prototypeArg,
      },
      annotations: { readOnlyHint: true },
    },
    ({ files, prototype }) =>
      run(() => {
        if (!files?.length && !prototype && listPrototypes(ws).length > 1) return text(formatResult(validateWorkspace(ws)));
        return text(formatResult(validate(at(prototype), files?.length ? { files } : {})));
      }),
  );

  server.registerTool(
    "canvas_link",
    {
      title: "Link to a screen state",
      description:
        "Where the person can see a screen state: its frame on the canvas, among the rest of the flow, and the state on its own. Give them the canvas link after building something.",
      inputSchema: { step: z.string().describe('"{screen id}.{state}", or just a screen id for its default state.'), prototype: prototypeArg },
      annotations: { readOnlyHint: true },
    },
    ({ step: node, prototype }) =>
      run(() => {
        const project = at(prototype);
        return text(`On the canvas: ${canvasLink(project, node)}\nOn its own: ${stateLink(project, node)}`);
      }),
  );

  server.registerTool(
    "set_status",
    {
      title: "Set a review status",
      description:
        "Sets a screen state's review status on the canvas: exploring (the default), in-review, approved or handed-off. Use when the person says a state is ready for review, approved, and so on.",
      inputSchema: {
        step: z.string().describe('"{screen id}.{state}", like "checkout.payment.card-declined".'),
        status: z.enum(["exploring", "in-review", "approved", "handed-off"]),
        prototype: prototypeArg,
      },
    },
    ({ step: node, status, prototype }) =>
      run(() => {
        const r = setStatus(at(prototype), node, status);
        return text(`${r.node} is now "${statusLabel(r.status)}" on the canvas (it was "${statusLabel(r.previous)}").`);
      }),
  );

  server.registerTool(
    "save_version",
    {
      title: "Save a version",
      description:
        "Saves the designer's work as a version: commits everything on their design branch and shares it if the prototype has a shared copy. Only use when the person asks to save.",
      inputSchema: { message: z.string().optional().describe("Short description of the version; generated from the changes if left out.") },
    },
    ({ message }) =>
      run(() => {
        const r = saveVersion(ws, message ? { message } : {});
        const problems = r.issues.length ? `\n\nOpen problems:\n${formatResult({ ok: false, issues: r.issues })}` : "";
        return text(`${r.message}${problems}`);
      }),
  );

  server.registerTool(
    "list_prototypes",
    {
      title: "List prototypes",
      description: "The prototypes in this design workspace (folders in prototypes/). They all share one design kit.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => run(() => text(listPrototypes(ws).join("\n") || "No prototypes yet.")),
  );

  return server;
}
