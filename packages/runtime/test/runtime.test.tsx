import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render, screen as view, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentManifest, DesignTokens } from "@cogitato/contract/browser";
import {
  PrototypeRoutes,
  ROUTER_FUTURE,
  defineScreen,
  generateDemos,
  stateUrl,
  useFixture,
  useGoToState,
  type KitData,
} from "../src/index.js";

// import.meta.url isn't a file: URL under jsdom; vitest runs from the package folder.
const contractDir = join(process.cwd(), "../contract/fixtures/reference/design/contract");
const readJson = <T,>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
const manifests = readdirSync(join(contractDir, "components")).map((f) =>
  readJson<ComponentManifest>(join(contractDir, "components", f)),
);
const manifest = (name: string) => manifests.find((m) => m.name === name)!;

function Payment() {
  const data = useFixture<{ message: string }>();
  const goTo = useGoToState();
  return (
    <div>
      <p>{data.message}</p>
      <button data-kit-id="checkout.payment.submit" onClick={() => goTo("checkout.payment.card-declined")}>
        Pay now
      </button>
    </div>
  );
}

const payment = defineScreen({
  id: "checkout.payment",
  route: "/checkout/payment",
  title: "Payment",
  fixtures: {
    default: { title: "Empty form", data: { message: "Enter your card" } },
    "card-declined": { data: { message: "Your card was declined" } },
  },
  component: Payment,
});

const renderAt = (url: string, kit?: KitData) =>
  render(
    <MemoryRouter initialEntries={[url]} future={ROUTER_FUTURE}>
      <PrototypeRoutes screens={[payment]} kit={kit} />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("screens and fixtures", () => {
  it("shows the default fixture", () => {
    renderAt("/checkout/payment");
    expect(view.getByText("Enter your card")).toBeTruthy();
  });

  it("picks the fixture from ?fixture=", () => {
    renderAt("/checkout/payment?fixture=card-declined");
    expect(view.getByText("Your card was declined")).toBeTruthy();
  });

  it("explains an unknown fixture and lists the real ones", () => {
    renderAt("/checkout/payment?fixture=expired");
    expect(view.getByRole("alert").textContent).toContain(`doesn't have a state called "expired"`);
    expect(view.getByRole("link", { name: "Card declined" })).toBeTruthy();
  });

  it("moves between states with useGoToState", () => {
    renderAt("/checkout/payment");
    fireEvent.click(view.getByText("Pay now"));
    expect(view.getByText("Your card was declined")).toBeTruthy();
  });

  it("builds state URLs, keeping frame mode", () => {
    expect(stateUrl([payment], "checkout.payment.default")).toBe("/checkout/payment");
    expect(stateUrl([payment], "checkout.payment.card-declined", "?kit-frame=1")).toBe(
      "/checkout/payment?fixture=card-declined&kit-frame=1",
    );
    expect(stateUrl([payment], "checkout.payment.expired")).toBeUndefined();
  });
});

describe("frame mode", () => {
  it("shows dev chrome normally", () => {
    const { container } = renderAt("/checkout/payment");
    expect(container.querySelector("[data-kit-chrome]")).not.toBeNull();
  });

  it("hides dev chrome and posts element rects to the parent", async () => {
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    const { container } = renderAt("/checkout/payment?kit-frame=1");
    expect(container.querySelector("[data-kit-chrome]")).toBeNull();
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "kit:rects",
          rects: [expect.objectContaining({ kitId: "checkout.payment.submit" })],
        }),
        "*",
      ),
    );
    act(() => {
      fireEvent.click(view.getByText("Pay now"));
    });
    expect(post).toHaveBeenCalledWith({ type: "kit:select", kitId: "checkout.payment.submit" }, "*");
  });

  it("tells the canvas which state it shows, on load and after moving", () => {
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    renderAt("/checkout/payment?kit-frame=1");
    expect(post).toHaveBeenCalledWith({ type: "kit:state", node: "checkout.payment.default" }, "*");
    act(() => {
      fireEvent.click(view.getByText("Pay now"));
    });
    expect(post).toHaveBeenCalledWith({ type: "kit:state", node: "checkout.payment.card-declined" }, "*");
    expect(document.documentElement.dataset.kitReady).toBe("");
  });

  it("doesn't post its state outside frame mode", () => {
    const post = vi.spyOn(window, "postMessage").mockImplementation(() => {});
    renderAt("/checkout/payment");
    expect(post).not.toHaveBeenCalledWith(expect.objectContaining({ type: "kit:state" }), "*");
  });

  it("links each state to its frame on the canvas", () => {
    renderAt("/checkout/payment?fixture=card-declined");
    expect(view.getByRole("link", { name: "Canvas" }).getAttribute("href")).toBe("/__canvas?focus=checkout.payment.card-declined");
  });
});

describe("kit preview", () => {
  it("generates a demo per enum value and per switchable state", () => {
    const groups = generateDemos(manifest("Button"));
    expect(groups.map((g) => [g.title, g.demos.length])).toEqual([
      ["variant", 4],
      ["size", 3],
      ["states", 2],
    ]);
    expect(groups[0]?.demos[0]?.props).toMatchObject({ variant: "primary", children: "Button" });
    const inputStates = generateDemos(manifest("Input")).find((g) => g.title === "states");
    expect(inputStates?.demos.map((d) => d.label)).toEqual(["error", "disabled"]);
  });

  it("renders a card per manifest, live demos, and missing components", () => {
    const kit: KitData = {
      tokens: readJson<DesignTokens>(join(contractDir, "tokens.json")),
      manifests,
      components: { Button: ({ children }) => <button>{String(children)}</button> },
      demos: {},
    };
    const { container } = renderAt("/__kit", kit);
    expect(container.querySelectorAll(".kit-ui-card")).toHaveLength(manifests.length);
    expect(view.getAllByText("Button", { selector: "button" }).length).toBe(9);
    expect(view.getByText(/no src\/kit\/Stack\.tsx/)).toBeTruthy();
    expect(view.getByText("color.brand.600")).toBeTruthy();
  });
});
