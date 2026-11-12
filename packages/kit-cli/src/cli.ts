import { spawnSync } from "node:child_process";
import mri from "mri";
import { toReport } from "@cogitato/contract";
import { doctor, formatDoctor } from "./doctor.js";
import { exportFlows } from "./export-flows.js";
import { KitError } from "./errors.js";
import { formatResult } from "./format.js";
import { addGap } from "./gaps.js";
import { runHook, type HookEvent } from "./hook.js";
import { canvasLink, stateLink } from "./links.js";
import { preview } from "./preview.js";
import { findWorkspace, listPrototypes, resolvePrototype, type Project, type Workspace } from "./project.js";
import { saveVersion } from "./save.js";
import { addEdge, addState, createScreen, type ScaffoldResult } from "./scaffold.js";
import { takeSnapshots } from "./snapshots.js";
import { FRAME_STATUSES, setStatus, statusLabel } from "./status.js";
import { sortIssues, validate } from "./validate.js";
import { createPrototype, validateKit, validateWorkspace } from "./workspace.js";

const HELP = `kit: Cogitato's prototype tools

  kit validate [--contract] [--files <file>...] [--json]
      Check the prototype against its design contract.
  kit export-flows [--check] [--json]
      Write design/flows.json from the screens and src/flows.ts.
  kit preview [--port <n>] [--no-open]
      Start the prototype if needed and open the design kit page.
  kit doctor [--json] [--quiet] [--port <n>]
      Check this machine is ready to run the prototype.
  kit prototypes
      List the prototypes in this workspace.
  kit new-prototype <name>
      Start a new prototype in prototypes/<name>, with the same setup as the others.
  kit dev [name]
      Run a prototype (the one you're in, or the only one) with its canvas.

Commands that work on one prototype take --prototype <name> when you're at the workspace root.

  kit new-screen <screen id> [--title <t>] [--route </path>] [--from <step>] [--label <l>] [--flow <id>]
      Create a screen with a default state; --from adds an arrow to it.
  kit add-state <screen id> <state> [--title <t>] [--from <step>] [--label <l>] [--flow <id>]
      Add a state to a screen.
  kit add-edge <from step> <to step> [--label <l>] [--flow <id>]
      Connect two states in src/flows.ts.
  kit gap add --kind <component|token|pattern> --name <n> --context <why> [--screen <id>] [--workaround <w>]
      Record something the design needs that the kit doesn't have.
  kit link <step> [--canvas] [--port <n>]
      Print the local address of a screen state, or of its frame on the canvas.
  kit status <step> <status>
      Set a state's review status on the canvas.
  kit snapshots [--dist <folder>] [--port <n>]
      Screenshot every state of the built prototype for the canvas (needs Playwright).
  kit save [--message <m>]
      Save a version: commit on a design branch, and share it if there's a remote.
  kit hook <post-edit|session-start>
      Claude Code hook (reads the hook's JSON on stdin). Used by the Cogitato plugin.

Steps are "{screen id}.{state}", like "checkout.payment.card-declined". Every command takes --json.

Exit codes: 0 all good, 1 problems found, 2 couldn't run.`;

const out = (text: string) => {
  if (text) process.stdout.write(text + "\n");
};

function workspace(): Workspace {
  const ws = findWorkspace();
  if (!ws) throw new UsageError("This folder isn't a Cogitato workspace: there's no design/contract folder here or above it.");
  return ws;
}

function project(name?: string): Project {
  return resolvePrototype(workspace(), name, process.cwd());
}

/** True when the working directory is inside one of the workspace's prototypes. */
const findProjectHere = (ws: Workspace) => ws.rel(process.cwd()).startsWith("prototypes/");

class UsageError extends Error {}

/** Runs the CLI and returns the exit code. */
export async function main(argv: string[]): Promise<number> {
  const args = mri(argv, {
    boolean: ["json", "contract", "check", "quiet", "help", "open", "canvas"],
    string: ["files", "port", "title", "route", "from", "to", "label", "flow", "kind", "name", "context", "screen", "workaround", "message", "dist", "prototype"],
    alias: { p: "prototype" },
    default: { open: true },
  });
  const [command, ...rest] = args._;
  const proto = () => project(opt("prototype"));
  const port = args.port ? Number(args.port) : undefined;
  const opt = (key: string): string | undefined => (typeof args[key] === "string" && args[key] ? (args[key] as string) : undefined);
  const need = (value: unknown, what: string): string => {
    if (typeof value !== "string" || !value) throw new UsageError(`Missing ${what}.

${HELP}`);
    return value;
  };
  const scaffolded = (r: ScaffoldResult) => {
    if (args.json) out(JSON.stringify({ ...toReport(r), files: r.files, node: r.node, link: r.link, canvas: r.canvas }, null, 2));
    else out(`Done: ${r.node} (${r.files.join(", ")})\nSee it at ${r.link}\nOn the canvas: ${r.canvas}\n\n${formatResult(r)}`);
    return r.ok ? 0 : 1;
  };

  try {
    switch (command) {
      case "validate": {
        // --files takes the following arguments too: `kit validate --files a.tsx b.css`.
        const files = args.files === undefined ? undefined : [args.files, ...rest].flat().map(String).filter(Boolean);
        const ws = workspace();
        const single = opt("prototype") || files || listPrototypes(ws).length === 1 || findProjectHere(ws);
        let r = single ? validate(proto(), { contractOnly: args.contract, ...(files ? { files } : {}) }) : validateWorkspace(ws);
        if (single && !files && !args.contract) {
          // A prototype's build runs this from inside it: keep the shared kit checked too.
          const issues = sortIssues([...r.issues, ...validateKit(ws)]);
          r = { ok: !issues.some((i) => i.severity === "error"), issues };
        }
        out(args.json ? JSON.stringify(toReport(r), null, 2) : formatResult(r));
        return r.ok ? 0 : 1;
      }
      case "prototypes":
        out(args.json ? JSON.stringify(listPrototypes(workspace())) : listPrototypes(workspace()).join("\n"));
        return 0;
      case "new-prototype": {
        const r = createPrototype(workspace(), need(rest[0], "the prototype name"));
        out(args.json ? JSON.stringify(r, null, 2) : `Started prototypes/${r.name} with a Home screen. Install its parts with pnpm install, then run it with pnpm dev ${r.name}.`);
        return 0;
      }
      case "dev": {
        const p = project(rest[0] === undefined ? opt("prototype") : String(rest[0]));
        const r = spawnSync("pnpm", ["--filter", `./prototypes/${p.name}`, "dev"], { cwd: p.workspace.root, stdio: "inherit", shell: process.platform === "win32" });
        return r.status ?? 2;
      }
      case "export-flows": {
        const r = exportFlows(proto(), { check: args.check });
        const result = { ok: !r.issues.some((i) => i.severity === "error"), issues: r.issues };
        if (args.json) out(JSON.stringify(toReport(result), null, 2));
        else if (!result.ok) out(formatResult(result) + "\n\nflows.json wasn't updated.");
        else if (args.check) out(r.changed ? "flows.json is out of date. Run kit export-flows." : "flows.json is up to date.");
        else out(r.written ? "Updated design/flows.json." : "flows.json is already up to date.");
        return !result.ok || (args.check && r.changed) ? 1 : 0;
      }
      case "preview": {
        const r = await preview(proto(), { ...(port ? { port } : {}), open: args.open, log: out });
        if (r.server) {
          await new Promise<void>((resolve) => r.server!.on("exit", () => resolve()));
        }
        return 0;
      }
      case "doctor": {
        const checks = await doctor(proto(), port ? { port } : {});
        out(args.json ? JSON.stringify(checks, null, 2) : formatDoctor(checks, args.quiet));
        return checks.some((c) => c.status === "problem") ? 1 : 0;
      }
      case "new-screen":
        return scaffolded(
          createScreen(proto(), {
            id: need(rest[0], "the screen id"),
            title: opt("title"), route: opt("route"), from: opt("from"), label: opt("label"), flow: opt("flow"),
          }),
        );
      case "add-state":
        return scaffolded(
          addState(proto(), {
            screen: need(rest[0], "the screen id"),
            state: need(rest[1], "the state name"),
            title: opt("title"), from: opt("from"), label: opt("label"), flow: opt("flow"),
          }),
        );
      case "add-edge":
        return scaffolded(
          addEdge(proto(), { from: need(rest[0] ?? opt("from"), "the step to start from"), to: need(rest[1] ?? opt("to"), "the step to go to"), label: opt("label"), flow: opt("flow") }),
        );
      case "gap": {
        if (rest[0] !== "add") throw new UsageError(`Use "kit gap add".

${HELP}`);
        const kind = need(opt("kind"), "--kind");
        if (kind !== "component" && kind !== "token" && kind !== "pattern") throw new UsageError("--kind is component, token or pattern.");
        const r = addGap(proto(), {
          kind, name: need(opt("name"), "--name"), context: need(opt("context"), "--context"),
          screen: opt("screen"), workaround: opt("workaround"),
        });
        out(args.json ? JSON.stringify(r, null, 2) : r.created ? `Logged ${r.gap.id}: ${r.gap.name}.` : `Already logged as ${r.gap.id}.`);
        return 0;
      }
      case "link": {
        const link = (args.canvas ? canvasLink : stateLink)(proto(), need(rest[0], "the step"), port);
        out(args.json ? JSON.stringify({ link }) : link);
        return 0;
      }
      case "status": {
        const r = setStatus(proto(), need(rest[0], "the step"), need(rest[1], `the status (${FRAME_STATUSES.join(", ")})`));
        out(args.json ? JSON.stringify(r) : `${r.node} is now "${statusLabel(r.status)}" (was "${statusLabel(r.previous)}").`);
        return 0;
      }
      case "snapshots": {
        const r = await takeSnapshots(proto(), { ...(opt("dist") ? { dist: opt("dist") } : {}), ...(port ? { port } : {}), log: out });
        if (args.json) out(JSON.stringify(r, null, 2));
        else if (r.skipped) out(r.skipped);
        // Snapshots are a nice-to-have: never fail a build over them.
        return 0;
      }
      case "save": {
        const r = saveVersion(proto(), { message: opt("message") });
        out(args.json ? JSON.stringify(r, null, 2) : r.message);
        return 0;
      }
      case "hook": {
        const event = rest[0];
        if (event !== "post-edit" && event !== "session-start") throw new UsageError(`Use "kit hook post-edit" or "kit hook session-start".`);
        const input = await readStdin();
        const r = await runHook(event as HookEvent, input ? JSON.parse(input) : {});
        if (r) out(JSON.stringify(r));
        return 0;
      }
      case undefined:
      case "help":
        out(HELP);
        return command ? 0 : args.help ? 0 : 2;
      default:
        out(`"${command}" isn't a kit command.\n\n${HELP}`);
        return 2;
    }
  } catch (e) {
    out(e instanceof Error ? e.message : String(e));
    return e instanceof KitError ? 1 : 2;
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
}
