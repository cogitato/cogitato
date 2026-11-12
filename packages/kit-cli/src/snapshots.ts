import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { SCHEMA_VERSIONS, validateFormat, type FlowManifest, type SnapshotManifest } from "@cogitato/contract";
import { isServerUp } from "./doctor.js";
import { readFlowsJson } from "./flows.js";
import type { Project } from "./project.js";

// Screenshots of every state in a built prototype, so the canvas can show zoomed-out frames
// instantly (07-canvas). Best effort: without Playwright or a browser it explains and skips, and
// the canvas shows placeholders instead. A deploy never fails because of snapshots (ADR 013).

export const SNAPSHOT_VIEWPORT = { width: 1280, height: 800 } as const;

/** A port the operating system says is free right now, so parallel builds and dev servers never collide. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error("No free port could be found."))));
    });
  });
}

export interface SnapshotOptions {
  /** Built prototype folder, project-relative. */
  dist?: string;
  /** Serve the build on this port. By default a free one is picked, so parallel builds don't collide. */
  port?: number;
  /** For tests: replace the browser and the preview server. */
  deps?: {
    launchBrowser?: (project: Project) => Promise<Browser | string>;
    startPreview?: (project: Project, vite: string, dist: string, port: number) => Promise<ChildProcess>;
  };
  log?: (message: string) => void;
}

export interface SnapshotResult {
  written: number;
  /** Why no snapshots were taken, in plain words. */
  skipped?: string;
  manifest?: SnapshotManifest;
}

/** Image file for a state, relative to __kit-data/. */
export const snapshotFile = (node: string) => `snapshots/${node}.jpg`;

export function snapshotManifest(nodes: string[], commit?: string): SnapshotManifest {
  return {
    schemaVersion: SCHEMA_VERSIONS.snapshots,
    ...(commit ? { commit } : {}),
    viewport: { ...SNAPSHOT_VIEWPORT },
    frames: Object.fromEntries(nodes.map((n) => [n, snapshotFile(n)])),
  };
}

const states = (m: FlowManifest) =>
  m.screens.flatMap((s) => s.states.map((st) => ({ node: `${s.id}.${st.id}`, url: `${s.route}?fixture=${encodeURIComponent(st.fixture)}&kit-frame=1` })));

export interface Page {
  goto(url: string, opts?: object): Promise<unknown>;
  waitForSelector(selector: string, opts?: object): Promise<unknown>;
  waitForLoadState(state: string, opts?: object): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(opts: object): Promise<unknown>;
}
export interface Browser {
  newPage(opts: object): Promise<Page>;
  close(): Promise<void>;
}

/**
 * A package the prototype itself has installed. Only its own node_modules counts, not whatever
 * Node could find elsewhere (NODE_PATH, parent folders), so snapshots use the prototype's versions.
 */
function ownPackage(project: Project, name: string): string | undefined {
  const pkg = project.abs(join("node_modules", name, "package.json"));
  return existsSync(pkg) ? pkg : undefined;
}

async function launchBrowser(project: Project): Promise<Browser | string> {
  let playwright: { chromium: { launch(): Promise<Browser> } };
  try {
    const pkg = ownPackage(project, "playwright");
    if (!pkg) throw new Error("not installed");
    const entry = createRequire(pkg).resolve("playwright");
    const mod = (await import(pathToFileURL(entry).href)) as typeof playwright & { default?: typeof playwright };
    // Playwright is CommonJS: depending on how Node reads it, its API is on the module or on `default`.
    playwright = mod.chromium ? mod : mod.default!;
  } catch {
    return "Playwright isn't installed in this prototype, so no snapshots were taken. The canvas will show placeholders instead.";
  }
  try {
    return await playwright.chromium.launch();
  } catch {
    return "The snapshot browser couldn't start, so no snapshots were taken (run `npx playwright install chromium` to fix it). The canvas will show placeholders instead.";
  }
}

/** The prototype's own Vite, which serves the build. Undefined when it isn't installed. */
function viteBin(project: Project): string | undefined {
  const pkg = ownPackage(project, "vite");
  return pkg ? join(pkg, "..", "bin", "vite.js") : undefined;
}

async function startPreview(project: Project, vite: string, dist: string, port: number): Promise<ChildProcess> {
  const server = spawn(process.execPath, [vite, "preview", "--outDir", dist, "--port", String(port), "--strictPort"], {
    cwd: project.root,
    stdio: "ignore",
  });
  const deadline = Date.now() + 20_000;
  while (!(await isServerUp(port))) {
    if (server.exitCode !== null || Date.now() > deadline) {
      server.kill();
      throw new Error("The built prototype couldn't be served for snapshots.");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return server;
}

/** Takes a screenshot of every state in the built prototype and writes __kit-data/snapshots.json. */
export async function takeSnapshots(project: Project, opts: SnapshotOptions = {}): Promise<SnapshotResult> {
  const log = opts.log ?? (() => {});
  const dist = opts.dist ?? "dist";
  const out = project.abs(join(dist, "__kit-data"));
  const flows = readFlowsJson(project);
  if (!existsSync(project.abs(dist))) return { written: 0, skipped: "There's no built prototype to take snapshots of yet. Build it first." };
  if (!flows) return { written: 0, skipped: "There's no flow map (design/flows.json) yet, so there's nothing to take snapshots of." };

  const vite = opts.deps?.startPreview ? "" : viteBin(project);
  if (vite === undefined) return { written: 0, skipped: "The prototype's parts aren't installed, so no snapshots were taken. The canvas will show placeholders instead." };
  const browser = await (opts.deps?.launchBrowser ?? launchBrowser)(project);
  if (typeof browser === "string") return { written: 0, skipped: browser };

  let server: ChildProcess | undefined;
  const done: string[] = [];
  let port = opts.port ?? 0;
  try {
    if (!opts.port) port = await freePort();
    server = await (opts.deps?.startPreview ?? startPreview)(project, vite, dist, port);
    const page = await browser.newPage({ viewport: { ...SNAPSHOT_VIEWPORT } });
    mkdirSync(join(out, "snapshots"), { recursive: true });
    for (const { node, url } of states(flows)) {
      try {
        await page.goto(`http://localhost:${port}${url}`, { waitUntil: "load" });
        await page.waitForSelector("html[data-kit-ready]", { timeout: 10_000 });
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(150);
        await page.screenshot({ path: join(out, snapshotFile(node)), type: "jpeg", quality: 70 });
        done.push(node);
      } catch {
        log(`Couldn't take a snapshot of ${node}; the canvas will show a placeholder for it.`);
      }
    }
  } catch (e) {
    return { written: 0, skipped: `No snapshots were taken: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    await browser.close().catch(() => {});
    server?.kill();
  }

  const manifest = snapshotManifest(done, flows.commit);
  const check = validateFormat("snapshots", manifest, "__kit-data/snapshots.json");
  if (!check.ok) return { written: 0, skipped: `The snapshot list came out wrong: ${check.issues[0]!.message}` };
  writeFileSync(join(out, "snapshots.json"), JSON.stringify(manifest, null, 2) + "\n");
  log(`Took ${done.length} snapshot${done.length === 1 ? "" : "s"} for the canvas.`);
  return { written: done.length, manifest };
}
