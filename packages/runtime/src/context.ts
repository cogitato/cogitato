import { createContext, useCallback, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Fixture, ScreenDefinition } from "./define.js";
import { FRAME_PARAM, isFrameMode } from "./frame.js";

export interface AppContextValue {
  screens: ScreenDefinition[];
}

export const AppContext = createContext<AppContextValue>({ screens: [] });

export interface ScreenContextValue {
  screen: ScreenDefinition;
  fixtureKey: string;
  fixture: Fixture;
}

export const ScreenContext = createContext<ScreenContextValue | null>(null);

function useScreenContext(hook: string): ScreenContextValue {
  const value = useContext(ScreenContext);
  if (!value) throw new Error(`${hook}() only works inside a screen registered with defineScreen.`);
  return value;
}

/** The current state's mock data (the `data` of the fixture picked by ?fixture=). */
export function useFixture<T>(): T {
  return useScreenContext("useFixture").fixture.data as T;
}

/** The screen being shown and the id of its current state. */
export function useScreen(): { id: string; title: string; state: string } {
  const { screen, fixtureKey } = useScreenContext("useScreen");
  return { id: screen.id, title: screen.title, state: fixtureKey };
}

/**
 * True when the prototype is shown as a canvas frame (?kit-frame=1). Frames should hold still:
 * skip timers and auto-advancing behavior when this is true.
 */
export function useFrameMode(): boolean {
  return isFrameMode(useLocation().search);
}

/** URL for a "{screenId}.{stateId}" node, or undefined if no such screen state exists. */
export function stateUrl(screens: ScreenDefinition[], node: string, search = ""): string | undefined {
  const dot = node.lastIndexOf(".");
  const screenId = node.slice(0, dot);
  const state = node.slice(dot + 1);
  const screen = screens.find((s) => s.id === screenId);
  if (!screen || !(state in screen.fixtures)) return undefined;
  const params = new URLSearchParams();
  if (state !== "default") params.set("fixture", state);
  if (new URLSearchParams(search).get(FRAME_PARAM) === "1") params.set(FRAME_PARAM, "1");
  const query = params.toString();
  return query ? `${screen.route}?${query}` : screen.route;
}

/**
 * Returns a function that moves the prototype to another state, following a flow edge:
 * `goTo("checkout.payment.card-declined")`. Frame mode is kept.
 */
export function useGoToState(): (node: string) => void {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { screens } = useContext(AppContext);
  return useCallback(
    (node: string) => {
      const url = stateUrl(screens, node, search);
      if (url) navigate(url);
      else console.warn(`[cogitato] There's no screen state called "${node}".`);
    },
    [navigate, screens, search],
  );
}
