import type { ComponentType } from "react";

/**
 * One state of a screen: mock data plus an optional title for the canvas.
 * The title defaults to the humanized key ("card-declined" -> "Card declined").
 */
export interface Fixture<T = unknown> {
  title?: string;
  data: T;
}

/**
 * A screen registration. `kit export-flows` reads these statically, so `id`, `route`,
 * `title`, the fixture keys and fixture titles must be written as plain text.
 */
export interface ScreenDefinition<T = unknown> {
  /** Dot-separated, lowercase: "checkout.payment". */
  id: string;
  /** Starts with "/": "/checkout/payment". */
  route: string;
  title: string;
  /** Named states. Every screen needs a "default" one. */
  fixtures: { default: Fixture<T> } & Record<string, Fixture<T>>;
  component: ComponentType;
}

export function defineScreen<T>(screen: ScreenDefinition<T>): ScreenDefinition<T> {
  return screen;
}

export interface FlowEdgeDefinition {
  /** "{screenId}.{stateId}", e.g. "checkout.payment.default". */
  from: string;
  to: string;
  label?: string;
}

export interface FlowDefinition {
  id: string;
  title: string;
  edges: FlowEdgeDefinition[];
  /** Steps in display order. Defaults to the edge endpoints in order of appearance. */
  nodes?: string[];
}

/** Declares the prototype's flows (src/flows.ts). Read statically by `kit export-flows`. */
export function defineFlows(flows: FlowDefinition[]): FlowDefinition[] {
  return flows;
}

/** "card-declined" -> "Card declined" */
export function humanize(key: string): string {
  const words = key.replace(/[-_.]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function fixtureTitle(key: string, fixture: Fixture): string {
  return fixture.title ?? humanize(key);
}
