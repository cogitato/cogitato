import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { main } from "../src/cli.js";
import { createPrototype, findWorkspace, listPrototypes, validateWorkspace } from "../src/index.js";
import { applyOps, copyTemplate } from "./helpers.js";

let proto: string | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  if (proto) rmSync(dirname(dirname(proto)), { recursive: true, force: true });
  proto = undefined;
});

const run = async (cwd: string, ...argv: string[]) => {
  const out: string[] = [];
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  vi.spyOn(process.stdout, "write").mockImplementation((s) => (out.push(String(s)), true));
  const code = await main(argv);
  vi.restoreAllMocks();
  return { code, out: out.join("") };
};

it("lists prototypes", async () => {
  proto = copyTemplate({ second: true });
  const r = await run(dirname(dirname(proto)), "prototypes");
  expect(r.out.trim().split("\n")).toEqual(["checkout", "onboarding"]);
});

it("asks which prototype for a per-prototype command at the root, and takes --prototype", async () => {
  proto = copyTemplate({ second: true });
  const root = dirname(dirname(proto));
  const asked = await run(root, "link", "cart");
  expect(asked.code).toBe(1);
  expect(asked.out).toMatch(/several prototypes \(checkout, onboarding\)/);
  const r = await run(root, "link", "cart", "--prototype", "onboarding");
  expect(r.code).toBe(0);
  expect(r.out).toMatch(/\/cart\?fixture=default/);
});

it("validates every prototype from the root", async () => {
  proto = copyTemplate({ second: true });
  const r = await run(dirname(dirname(proto)), "validate", "--json");
  expect(r.code).toBe(0);
});

it("checks only the shared contract at the root with --contract", async () => {
  proto = copyTemplate({ second: true });
  applyOps(proto, [{ op: "replace", file: "src/screens/cart/screen.tsx", find: 'id: "cart"', with: 'id: "Cart!"' }]);
  const root = dirname(dirname(proto));
  const all = await run(root, "validate", "--json");
  expect(all.code).toBe(1);
  const r = await run(root, "validate", "--contract", "--json");
  expect(r.code).toBe(0);
  const report = JSON.parse(r.out);
  expect(report.issues.filter((i: { file: string }) => i.file.startsWith("prototypes/"))).toEqual([]);
});

it("still checks the shared kit when validating from inside a prototype", async () => {
  proto = copyTemplate();
  applyOps(proto, [{ op: "write", file: "../../kit/Button.module.css", text: ".x { color: #ff0000; }\n" }]);
  const r = await run(proto, "validate");
  expect(r.code).toBe(1);
  expect(r.out).toMatch(/kit\/Button\.module\.css/);
});

it("creates a new prototype that validates", () => {
  proto = copyTemplate();
  const ws = findWorkspace(proto)!;
  const r = createPrototype(ws, "onboarding");
  expect(listPrototypes(ws)).toEqual(["checkout", "onboarding"]);
  const pkg = JSON.parse(readFileSync(ws.abs("prototypes/onboarding/package.json"), "utf8"));
  expect(pkg.name).toBe("onboarding");
  expect(pkg.dependencies["@cogitato/runtime"]).toBe(JSON.parse(readFileSync(ws.abs("prototypes/checkout/package.json"), "utf8")).dependencies["@cogitato/runtime"]);
  expect(existsSync(ws.abs("prototypes/onboarding/src/screens/home/screen.tsx"))).toBe(true);
  expect(r.files).toContain("prototypes/onboarding/src/flows.ts");
  expect(validateWorkspace(ws).issues.filter((i) => i.file.startsWith("prototypes/onboarding"))).toEqual([]);
});

it("refuses bad or taken names in plain words", () => {
  proto = copyTemplate();
  const ws = findWorkspace(proto)!;
  expect(() => createPrototype(ws, "checkout")).toThrow(/already a prototype called "checkout"/);
  expect(() => createPrototype(ws, "My Flow")).toThrow(/lowercase words with dashes/);
});
