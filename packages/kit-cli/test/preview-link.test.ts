import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { previewLink, projectAt } from "../src/index.js";
import { copyTemplate } from "./helpers.js";

let proto: string | undefined;
afterEach(() => proto && rmSync(dirname(dirname(proto)), { recursive: true, force: true }));

const setKit = (ws: string, kit: object) => {
  const path = join(ws, "package.json");
  writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), kit }, null, 2));
};

it("builds the hosted canvas link from the workspace's previewUrl and org", () => {
  proto = copyTemplate();
  setKit(dirname(dirname(proto)), { previewUrl: "https://{host}.cogitato-preview.app", org: "acme-shop-demo" });
  expect(previewLink(projectAt(proto), "design/sam-0102")).toBe(
    "https://design-sam-0102--checkout--acme-shop-demo.cogitato-preview.app/__canvas",
  );
  expect(previewLink(projectAt(proto), "design/sam-0102", "cart.empty")).toMatch(/\/__canvas\?focus=cart.empty$/);
});

it("has no link without hosting set up", () => {
  proto = copyTemplate();
  expect(previewLink(projectAt(proto), "main")).toBeUndefined();
  setKit(dirname(dirname(proto)), { previewUrl: "https://{branch}--x.netlify.app" });
  expect(previewLink(projectAt(proto), "main")).toBeUndefined();
});
