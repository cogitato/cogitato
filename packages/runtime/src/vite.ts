import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Connect, Plugin, ViteDevServer } from "vite";
import { tokensToCss, type DesignTokens } from "@cogitato/contract/browser";

const TOKENS_CSS = "virtual:kit/tokens.css";
const KIT = "virtual:kit/kit";
// The kit id gets the usual "\0" virtual prefix. Vite's CSS pipeline skips "\0" ids, so the
// tokens stylesheet resolves to a root-style path ending in .css instead.
const RESOLVED_TOKENS_CSS = "/__kit_tokens.css";
const RESOLVED_KIT = "\0" + KIT;

const slash = (p: string) => p.replace(/\\/g, "/");

interface Paths {
  root: string;
  contract: string;
  flowsJson: string;
  tokens: string;
  components: string;
  kit: string;
}

function pathsFor(root: string): Paths {
  const contract = join(root, "design", "contract");
  return {
    root,
    contract,
    flowsJson: join(root, "design", "flows.json"),
    tokens: join(contract, "tokens.json"),
    components: join(contract, "components"),
    kit: join(root, "src", "kit"),
  };
}

const list = (dir: string, test: (f: string) => boolean) =>
  existsSync(dir) ? readdirSync(dir).filter(test).sort() : [];

// The kit module imports every manifest and kit file explicitly, so it works with any Vite setup.
function kitModule(p: Paths): string {
  const imports: string[] = [`import tokens from ${JSON.stringify(slash(p.tokens))};`];
  const manifests = list(p.components, (f) => f.endsWith(".json")).map((f, i) => {
    imports.push(`import m${i} from ${JSON.stringify(slash(join(p.components, f)))};`);
    return `m${i}`;
  });
  const components: string[] = [];
  const demos: string[] = [];
  list(p.kit, (f) => /^[A-Z][A-Za-z0-9]*(\.demo)?\.tsx$/.test(f)).forEach((f, i) => {
    const file = JSON.stringify(slash(join(p.kit, f)));
    if (f.endsWith(".demo.tsx")) {
      const name = basename(f, ".demo.tsx");
      imports.push(`import d${i} from ${file};`);
      demos.push(`${JSON.stringify(name)}: d${i}`);
    } else {
      const name = basename(f, ".tsx");
      imports.push(`import * as c${i} from ${file};`);
      components.push(`${JSON.stringify(name)}: c${i}[${JSON.stringify(name)}] ?? c${i}.default`);
    }
  });
  return `${imports.join("\n")}
export default {
  tokens,
  manifests: [${manifests.join(", ")}],
  components: { ${components.join(", ")} },
  demos: { ${demos.join(", ")} },
};
`;
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
    req.on("end", () => done(body));
    req.on("error", fail);
  });
}

type KitCli = {
  findProject(from: string): unknown;
  setStatus(project: unknown, node: string, status: string): unknown;
  KitError: new (...args: never[]) => Error;
};

/** The prototype's own @cogitato/kit-cli. Status changes go through it so the rules live in one place. */
async function loadKitCli(root: string): Promise<KitCli | undefined> {
  try {
    const entry = createRequire(join(root, "package.json")).resolve("@cogitato/kit-cli");
    return (await import(pathToFileURL(entry).href)) as KitCli;
  } catch {
    return undefined;
  }
}

/** Dev-only endpoints the canvas uses: the flow map, and setting a frame's review status. */
function canvasMiddleware(p: Paths): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = (req.url ?? "").split("?")[0];
    if (url === "/__kit-data/flows.json" && req.method === "GET") {
      if (!existsSync(p.flowsJson)) return json(res, 404, { message: "design/flows.json doesn't exist yet." });
      return json(res, 200, JSON.parse(readFileSync(p.flowsJson, "utf8")));
    }
    if (url !== "/__kit-data/status") return next();
    void (async () => {
      const kit = await loadKitCli(p.root);
      if (req.method === "GET") return json(res, 200, { editable: Boolean(kit) });
      if (req.method !== "POST") return json(res, 405, { message: "Use GET or POST." });
      if (!kit) return json(res, 501, { message: "Cogitato's tools aren't installed in this prototype, so statuses can't be changed here." });
      try {
        const { node, status } = JSON.parse(await readBody(req)) as { node?: string; status?: string };
        kit.setStatus(kit.findProject(p.root), String(node), String(status));
        return json(res, 200, { ok: true });
      } catch (e) {
        return json(res, e instanceof kit.KitError ? 400 : 500, { message: e instanceof Error ? e.message : String(e) });
      }
    })();
  };
}

/**
 * Cogitato's Vite plugin. Adds the `@` → `src` alias, `virtual:kit/tokens.css` (token CSS
 * built from design/contract/tokens.json) and `virtual:kit/kit` (data for /__kit). For the
 * canvas it serves /__kit-data/flows.json and /__kit-data/status in dev, and writes
 * __kit-data/flows.json into the build.
 */
export function kit(): Plugin {
  let p = pathsFor(process.cwd());
  let server: ViteDevServer | undefined;

  const reloadKit = (file: string) => {
    const f = slash(file);
    if (!server || !(f.startsWith(slash(p.kit)) || f.startsWith(slash(p.components)))) return;
    const mod = server.moduleGraph.getModuleById(RESOLVED_KIT);
    if (mod) server.moduleGraph.invalidateModule(mod);
    server.ws.send({ type: "full-reload" });
  };

  return {
    name: "kit",
    config(config) {
      p = pathsFor(config.root ? resolve(config.root) : process.cwd());
      return { resolve: { alias: { "@": join(p.root, "src") } } };
    },
    configureServer(s) {
      server = s;
      s.watcher.add(p.contract);
      // Adding or removing a kit file or manifest changes the kit module's import list.
      s.watcher.on("add", reloadKit);
      s.watcher.on("unlink", reloadKit);
      s.middlewares.use(canvasMiddleware(p));
    },
    generateBundle() {
      // The canvas in a built prototype reads the flow map from here.
      if (existsSync(p.flowsJson)) {
        this.emitFile({ type: "asset", fileName: "__kit-data/flows.json", source: readFileSync(p.flowsJson, "utf8") });
      }
    },
    resolveId(id) {
      if (id === TOKENS_CSS) return RESOLVED_TOKENS_CSS;
      if (id === KIT) return RESOLVED_KIT;
      return undefined;
    },
    load(id) {
      if (id === RESOLVED_TOKENS_CSS) {
        this.addWatchFile(p.tokens);
        return tokensToCss(JSON.parse(readFileSync(p.tokens, "utf8")) as DesignTokens);
      }
      if (id === RESOLVED_KIT) return kitModule(p);
      return undefined;
    },
  };
}

export default kit;
