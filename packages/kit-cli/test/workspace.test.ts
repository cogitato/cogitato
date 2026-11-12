import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KitError, findProject, findWorkspace, listPrototypes, readContract, resolvePrototype, validateWorkspace } from "../src/index.js";
import { applyOps, copyTemplate, templateDir, workspaceDir } from "./helpers.js";

let proto: string | undefined;
afterEach(() => {
  if (proto) rmSync(dirname(dirname(proto)), { recursive: true, force: true });
  proto = undefined;
});

describe("finding the workspace and prototypes", () => {
  it("finds the workspace from its root, a prototype, and deep inside one", () => {
    for (const from of [workspaceDir, templateDir, join(templateDir, "src", "screens")]) {
      expect(findWorkspace(from)?.root).toBe(workspaceDir);
    }
  });

  it("lists prototypes that have a package.json", () => {
    proto = copyTemplate({ second: true });
    expect(listPrototypes(findWorkspace(proto)!)).toEqual(["checkout", "onboarding"]);
  });

  it("picks the prototype you're in, or the only one", () => {
    expect(findProject(join(templateDir, "src"))?.name).toBe("checkout");
    expect(findProject(workspaceDir)?.name).toBe("checkout");
  });

  it("asks which prototype when there are several and you're at the root", () => {
    proto = copyTemplate({ second: true });
    const ws = findWorkspace(proto)!;
    expect(findProject(ws.root)).toBeUndefined();
    expect(() => resolvePrototype(ws, undefined, ws.root)).toThrow(KitError);
    expect(() => resolvePrototype(ws, undefined, ws.root)).toThrow(/checkout, onboarding/);
    expect(resolvePrototype(ws, "onboarding").name).toBe("onboarding");
    expect(() => resolvePrototype(ws, "nope")).toThrow(/There's no prototype called "nope"/);
  });

  it("reads the shared contract for every prototype", () => {
    expect(readContract(findProject(templateDir)!).manifests.has("Button")).toBe(true);
  });

  it("is not a workspace outside one", () => {
    expect(findWorkspace(dirname(workspaceDir))).toBeUndefined();
  });
});

describe("validateWorkspace", () => {
  it("validates the template workspace with no issues", () => {
    expect(validateWorkspace(findWorkspace(workspaceDir)!)).toEqual({ ok: true, issues: [] });
  });

  it("reports each prototype's problems with workspace paths, and the contract's once", () => {
    proto = copyTemplate({ second: true });
    const onboarding = join(dirname(proto), "onboarding");
    applyOps(onboarding, [{ op: "replace", file: "src/screens/cart/screen.tsx", find: 'id: "cart"', with: 'id: "Cart!"' }]);
    applyOps(proto, [{ op: "replace", file: "../../design/contract/tokens.json", find: '"$schema"', with: '"$schemaX"' }]);
    const r = validateWorkspace(findWorkspace(proto)!);
    const files = [...new Set(r.issues.map((i) => i.file.split("/").slice(0, 2).join("/")))];
    expect(files).toContain("prototypes/onboarding");
    expect(files.filter((f) => f.startsWith("design/")).length).toBe(1);
    expect(files).not.toContain("prototypes/checkout");
  });
});
