// Checks what each published package would ship: built code, bins, schemas and the template are
// in; sources, tests and fixtures are out. Run after `pnpm build`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const expect = {
  "packages/contract": ["dist/index.js", "dist/browser.js", "schema/flows.schema.json", "schema/snapshots.schema.json"],
  "packages/runtime": ["dist/index.js", "dist/vite.js", "client.d.ts"],
  "packages/canvas": ["dist/index.js"],
  "packages/kit-cli": ["bin/kit.js", "dist/cli.js", "dist/index.js", "dist/hosting.js", "dist/hosting.d.ts"],
  "packages/kit-mcp": ["bin/kit-mcp.js", "dist/index.js"],
  "packages/create-cogitato": ["bin/create-cogitato.js", "dist/create.js", "template/package.json", "template/_gitignore", "template/_pnpm-workspace.yaml", "template/design/contract/tokens.json",
    "template/kit/Button.tsx", "template/prototypes/checkout/package.json", "template/prototypes/checkout/design/flows.json"],
};
const forbidden = [/^src\//, /^test\//, /^fixtures\//, /\.test\./, /^template\/node_modules\//, /^template\/dist\//, /^tsconfig/];

let failed = false;
for (const [dir, required] of Object.entries(expect)) {
  const cwd = join(root, dir);
  const { name } = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
  const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd, encoding: "utf8", shell: process.platform === "win32" });
  const files = JSON.parse(out)[0].files.map((f) => f.path.replace(/\\/g, "/"));
  const missing = [...required, "LICENSE", "package.json", "README.md"].filter((f) => !files.includes(f));
  const extra = files.filter((f) => forbidden.some((re) => re.test(f)));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${name}: missing ${JSON.stringify(missing)}, shouldn't ship ${JSON.stringify(extra)}`);
  } else {
    console.log(`${name}: ${files.length} files ok`);
  }
}
process.exit(failed ? 1 : 0);
