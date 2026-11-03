import { Suspense, lazy, useContext, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppContext, ScreenContext, stateUrl } from "./context.js";
import { fixtureTitle, type ScreenDefinition } from "./define.js";
import { isFrameMode, postFrameState, startFrameBridge } from "./frame.js";
import { KitPreview, type KitData } from "./kit-preview.js";
import { UI_CSS } from "./styles.js";

export const KIT_ROUTE = "/__kit";
export const CANVAS_ROUTE = "/__canvas";

// Loaded only when the canvas is opened, so screens don't pay for it.
const Canvas = lazy(() => import("@cogitato/canvas").then((m) => ({ default: m.Canvas })));

/** React Router v7 behaviors, opted into now so prototypes don't log upgrade warnings. */
export const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

export interface PrototypeConfig {
  // Screens use different fixture data types; the app only reads their shared shape.
  screens: ScreenDefinition<any>[];
  /** Contract and kit components for the /__kit page. Supplied by `virtual:kit/kit`. */
  kit?: KitData;
}

function ScreenHost({ screen }: { screen: ScreenDefinition }) {
  const { search } = useLocation();
  const fixtureKey = new URLSearchParams(search).get("fixture") ?? "default";
  const frame = isFrameMode(search);
  const fixture = screen.fixtures[fixtureKey];

  useEffect(() => (frame ? startFrameBridge() : undefined), [frame]);
  useEffect(() => {
    if (frame) postFrameState(`${screen.id}.${fixtureKey}`);
  }, [frame, screen.id, fixtureKey]);
  // Lets the snapshotter know the screen has rendered.
  useEffect(() => {
    document.documentElement.dataset.kitReady = "";
  }, []);

  const Component = screen.component;
  return (
    <>
      {fixture ? (
        <ScreenContext.Provider value={{ screen, fixtureKey, fixture }}>
          {/* Remount on state change so local UI state starts fresh in every state. */}
          <Component key={fixtureKey} />
        </ScreenContext.Provider>
      ) : (
        <MissingState screen={screen} fixtureKey={fixtureKey} />
      )}
      {!frame && <DevChrome screen={screen} fixtureKey={fixtureKey} />}
    </>
  );
}

function MissingState({ screen, fixtureKey }: { screen: ScreenDefinition; fixtureKey: string }) {
  return (
    <div className="kit-ui kit-ui-notice" role="alert">
      <h3>
        {screen.title} doesn't have a state called "{fixtureKey}".
      </h3>
      <p className="kit-ui-muted">Pick one of the states it has:</p>
      <ul>
        {Object.entries(screen.fixtures).map(([key, f]) => (
          <li key={key}>
            <Link to={stateUrl([screen], `${screen.id}.${key}`) ?? screen.route}>{fixtureTitle(key, f)}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DevChrome({ screen, fixtureKey }: { screen: ScreenDefinition; fixtureKey: string }) {
  const navigate = useNavigate();
  const screens = useScreens();
  return (
    <div className="kit-ui kit-ui-chrome" data-kit-chrome="">
      <span className="kit-ui-chrome-label">Cogitato</span>
      <select
        aria-label="Screen"
        value={screen.id}
        onChange={(e) => navigate(stateUrl(screens, `${e.target.value}.default`) ?? "/")}
      >
        {screens.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      <select
        aria-label="State"
        value={fixtureKey}
        onChange={(e) => navigate(stateUrl(screens, `${screen.id}.${e.target.value}`) ?? screen.route)}
      >
        {!(fixtureKey in screen.fixtures) && <option value={fixtureKey}>{fixtureKey} (missing)</option>}
        {Object.entries(screen.fixtures).map(([key, f]) => (
          <option key={key} value={key}>
            {fixtureTitle(key, f)}
          </option>
        ))}
      </select>
      <Link to={KIT_ROUTE}>Kit</Link>
      <a href={`${CANVAS_ROUTE}?focus=${encodeURIComponent(`${screen.id}.${fixtureKey}`)}`}>Canvas</a>
    </div>
  );
}

function useScreens(): ScreenDefinition[] {
  return useContext(AppContext).screens;
}

function Home() {
  const screens = useScreens();
  return (
    <div className="kit-ui kit-ui-page">
      <h1>Prototype screens</h1>
      <p className="kit-ui-muted">
        Every screen and state in this prototype. The <a href={CANVAS_ROUTE}>canvas</a> shows them all side by side as flows, and
        the <Link to={KIT_ROUTE}>kit page</Link> shows the design system.
      </p>
      {screens.length === 0 && <p>No screens yet. Add one in src/screens.</p>}
      {screens.map((s) => (
        <section key={s.id}>
          <h2>
            {s.title} <span className="kit-ui-muted kit-ui-code">{s.route}</span>
          </h2>
          <ul>
            {Object.entries(s.fixtures).map(([key, f]) => (
              <li key={key}>
                <Link to={stateUrl([s], `${s.id}.${key}`) ?? s.route}>{fixtureTitle(key, f)}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="kit-ui kit-ui-notice" role="alert">
      <h3>There's no screen at {pathname}.</h3>
      <p>
        <Link to="/">See all screens</Link>
      </p>
    </div>
  );
}

/** All prototype routes. Render inside a router; `mountPrototype` does this for you. */
export function PrototypeRoutes({ screens, kit }: PrototypeConfig) {
  return (
    <AppContext.Provider value={{ screens }}>
      <style>{UI_CSS}</style>
      <Routes>
        <Route path="/" element={<Home />} />
        {screens.map((s) => (
          <Route key={s.id} path={s.route} element={<ScreenHost screen={s} />} />
        ))}
        <Route path={KIT_ROUTE} element={<KitPreview kit={kit} />} />
        <Route
          path={CANVAS_ROUTE}
          element={
            <Suspense fallback={<div className="kit-ui kit-ui-notice">Loading the canvas…</div>}>
              <Canvas title={document.title || "Prototype"} kitHref={KIT_ROUTE} />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppContext.Provider>
  );
}

/** Renders the prototype into `element` with browser routing. Called from the prototype's main.tsx. */
export function mountPrototype(element: HTMLElement | null, config: PrototypeConfig): void {
  if (!element) throw new Error("mountPrototype: the root element wasn't found.");
  createRoot(element).render(
    <BrowserRouter future={ROUTER_FUTURE}>
      <PrototypeRoutes {...config} />
    </BrowserRouter>,
  );
}
