// @vitest-environment node
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { pathsFor } from "../src/vite.js";

const ws = fileURLToPath(new URL("../../../templates/workspace-react", import.meta.url));
const proto = join(ws, "prototypes", "checkout");

it("takes the contract and kit from the workspace, and flows from the prototype", () => {
  const p = pathsFor(proto);
  expect(p.workspace).toBe(ws);
  expect(p.contract).toBe(join(ws, "design", "contract"));
  expect(p.kit).toBe(join(ws, "kit"));
  expect(p.flowsJson).toBe(join(proto, "design", "flows.json"));
});
