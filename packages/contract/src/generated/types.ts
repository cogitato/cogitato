/* eslint-disable */
/**
 * GENERATED FILE. Do not edit by hand.
 * Source: packages/contract/schema/*.schema.json
 * Regenerate with: pnpm --filter @cogitato/contract gen
 */

/**
 * Version of the file format. Bumped on breaking changes.
 */
export type SchemaVersion = number;
/**
 * ISO 8601 date-time, e.g. "2026-11-01T00:00:00Z".
 */
export type Timestamp = string;
export type TokenType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "duration"
  | "number"
  | "typography"
  | "shadow";
export type PropDefinition =
  (EnumProp | BooleanProp | StringProp | NumberProp | NodeProp | EventProp) | undefined;
/**
 * Lowercase words joined by dashes, e.g. "card-declined".
 */
export type Slug = string;
/**
 * Dot-separated lowercase id of a screen, e.g. "checkout.payment".
 */
export type ScreenId = string;
/**
 * Git commit sha, short or full.
 */
export type CommitSha = string;
/**
 * Reference to one state of one screen: {screenId}.{stateId}, e.g. "checkout.payment.card-declined".
 */
export type NodeRef = string;
/**
 * Review status of a frame on the canvas.
 */
export type FrameStatus = ("exploring" | "in-review" | "approved" | "handed-off") | undefined;
/**
 * Annotation anchor: {screenId}.{elementName}, e.g. "checkout.payment.submit".
 */
export type KitId = string;
export type SpecComponentName = string;
/**
 * Screens that use the component.
 */
export type SpecUsedIn = ScreenId[];
export type Severity = "error" | "warning";

/**
 * Index of every Cogitato format. Not a file format itself.
 */
export interface KitSchemas {
  contract: ContractMetadata;
  tokens: DesignTokens;
  component: ComponentManifest;
  decisions: DecisionLog;
  gaps: GapLog;
  flows: FlowManifest;
  annotations: AnnotationExport;
  spec: HandoffSpec;
  report: ValidationReport;
  snapshots: SnapshotManifest;
}
/**
 * design/contract/contract.json: metadata for a design contract. Its schemaVersion covers every file in the contract folder.
 */
export interface ContractMetadata {
  $schema?: string;
  schemaVersion: SchemaVersion;
  /**
   * Product the contract describes.
   */
  name: string;
  /**
   * Version of this contract (semver).
   */
  version: string;
  description?: string;
  /**
   * Where the contract's content came from.
   */
  sources: ContractSource[];
}
export interface ContractSource {
  kind: "code" | "figma" | "docs" | "manual";
  /**
   * Repo path, Figma file, document name, or a note for hand-written contracts.
   */
  ref: string;
  importedAt?: Timestamp;
}
/**
 * design/contract/tokens.json: design tokens in a subset of the W3C Design Tokens Community Group (DTCG) format. Structure is checked here; token types, values and aliases are checked by the validator because DTCG types are inherited from parent groups.
 */
export interface DesignTokens {
  $schema?: string;
  $type?: TokenType;
  $description?: string;
  $extensions?: {};
  /**
   * This interface was referenced by `DesignTokens`'s JSON-Schema definition
   * via the `patternProperty` "^[^$.{}]+$".
   */
  [k: string]: unknown;
}
/**
 * design/contract/components/{kebab-name}.json: one component a prototype may use.
 */
export interface ComponentManifest {
  $schema?: string;
  /**
   * Component name in PascalCase. The file name is its kebab-case form (TextField → text-field.json).
   */
  name: string;
  /**
   * One-line usage note, shown in component lists.
   */
  description?: string;
  /**
   * Where the component comes from. Shown as a badge.
   */
  source: "production" | "figma" | "generated";
  /**
   * How sure intake is that this matches the real design system. Shown as a badge.
   */
  confidence: "high" | "medium" | "low";
  /**
   * Import path used in prototype code.
   */
  import: string;
  props: {
    [k: string]: PropDefinition | undefined;
  };
  /**
   * Visual states the component supports. Must include "default".
   */
  states: Slug[];
  /**
   * Usage rules in plain language.
   */
  rules?: string[];
  mapping?: ComponentMapping;
}
export interface EnumProp {
  type: "enum";
  /**
   * @minItems 1
   */
  values: [string, ...string[]];
  default?: string;
  required?: boolean;
  description?: string;
}
export interface BooleanProp {
  type: "boolean";
  default?: boolean;
  required?: boolean;
  description?: string;
}
export interface StringProp {
  type: "string";
  default?: string;
  required?: boolean;
  description?: string;
}
export interface NumberProp {
  type: "number";
  min?: number;
  max?: number;
  default?: number;
  required?: boolean;
  description?: string;
}
/**
 * Content slot, such as children. v1 models composition as node props only.
 */
export interface NodeProp {
  type: "node";
  required?: boolean;
  description?: string;
}
/**
 * Callback, such as onPress. Wired to mock behavior in prototypes.
 */
export interface EventProp {
  type: "event";
  required?: boolean;
  description?: string;
}
/**
 * Where this component lives in production code and Figma. Used by implement-handoff.
 */
export interface ComponentMapping {
  production?: {
    path: string;
    export: string;
  };
  figma?: {
    componentKey: string;
    nodeId?: string;
  };
}
/**
 * design/contract/decisions.json: conflicts found during intake and how they were settled. Re-runs reuse decided answers.
 */
export interface DecisionLog {
  $schema?: string;
  decisions: Decision[];
}
export interface Decision {
  id: string;
  /**
   * What the decision is about, e.g. "tokens.color.brand.600" or "components.Button".
   */
  topic: string;
  question: string;
  /**
   * @minItems 2
   */
  options: [DecisionOption, DecisionOption, ...DecisionOption[]];
  /**
   * Id of the recommended option.
   */
  recommendation: string;
  status: "open" | "decided";
  /**
   * Id of the chosen option. Required once decided.
   */
  choice?: string;
  decidedBy?: string;
  decidedAt?: Timestamp;
  note?: string;
}
export interface DecisionOption {
  id: Slug;
  label: string;
  /**
   * The concrete value this option would put in the contract, if any.
   */
  value?: string | number | boolean | {} | unknown[];
  evidence?: {
    source: "code" | "figma" | "docs";
    detail: string;
  }[];
}
/**
 * design/contract/gaps.json: things designers needed that the contract doesn't cover yet. Appended by `kit gap add` and the log_gap MCP tool.
 */
export interface GapLog {
  $schema?: string;
  gaps: Gap[];
}
export interface Gap {
  id: string;
  kind: "component" | "token" | "pattern";
  /**
   * What's missing, e.g. "Stepper" or "color.feedback.warning-subtle".
   */
  name: string;
  /**
   * What the designer was trying to do when they hit the gap.
   */
  context: string;
  screen?: ScreenId;
  /**
   * What was used instead in the meantime.
   */
  workaround?: string;
  requestedBy?: string;
  status: "open" | "resolved" | "wont-fix";
  createdAt: Timestamp;
}
/**
 * design/flows.json: every screen, state and flow in a prototype. Generated by `kit export-flows`; the canvas reads only this file. Frame URL: {baseUrl}{route}?fixture={fixture}&kit-frame=1
 */
export interface FlowManifest {
  $schema?: string;
  schemaVersion: SchemaVersion;
  commit?: CommitSha;
  screens: Screen[];
  flows: Flow[];
  /**
   * Review status per node ({screenId}.{stateId}). Nodes not listed are "exploring".
   */
  status?: {
    [k: string]: FrameStatus | undefined;
  };
}
export interface Screen {
  id: ScreenId;
  route: string;
  title: string;
  /**
   * @minItems 1
   */
  states: [ScreenState, ...ScreenState[]];
}
export interface ScreenState {
  id: Slug;
  fixture: Slug;
  title: string;
}
export interface Flow {
  id: Slug;
  title: string;
  nodes: NodeRef[];
  edges: FlowEdge[];
}
export interface FlowEdge {
  from: NodeRef;
  to: NodeRef;
  label?: string;
}
/**
 * design/annotations/{name}.json: annotations exported from the comment service. Live comments stay in the service; this is the file form used at handoff.
 */
export interface AnnotationExport {
  $schema?: string;
  schemaVersion: SchemaVersion;
  exportedAt: Timestamp;
  annotations: Annotation[];
}
export interface Annotation {
  id: string;
  anchor: AnnotationAnchor;
  type: "intent" | "spec" | "question" | "feedback";
  status: "open" | "resolved" | "archived";
  author: string;
  body: string;
  replies: AnnotationReply[];
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
}
/**
 * Where a comment is pinned: screen + state + element + commit. fallbackRect keeps it placeable if the element disappears (shown as "detached").
 */
export interface AnnotationAnchor {
  screen: ScreenId;
  state: Slug;
  kitId?: KitId;
  commit: CommitSha;
  fallbackRect: RelativeRect;
}
/**
 * Rectangle in coordinates relative to the frame (0 to 1).
 */
export interface RelativeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface AnnotationReply {
  id: string;
  author: string;
  body: string;
  createdAt: Timestamp;
}
/**
 * design/handoff/{initiative}/spec.json: the machine-readable handoff spec read by implement-handoff. spec.md is its human-readable twin.
 */
export interface HandoffSpec {
  $schema?: string;
  schemaVersion: SchemaVersion;
  initiative: Slug;
  title: string;
  commit: CommitSha;
  createdAt: Timestamp;
  /**
   * Canvas URL the state links are relative to.
   */
  canvasBaseUrl?: string;
  /**
   * §1 Intent: what this initiative is for.
   */
  intent: {
    summary: string;
    goals?: string[];
  };
  /**
   * §2 Flow map and state inventory.
   */
  flowMap: {
    flows: Slug[];
    states: SpecState[];
  };
  /**
   * §3 Component usage, from the contract plus a code scan.
   */
  componentUsage: {
    reused: ComponentUsage[];
    modified: ModifiedComponentUsage[];
    new: NewComponentUsage[];
  };
  /**
   * §4 Data and behavior the prototype mocks.
   */
  dataAndBehavior: BehaviorNote[];
  /**
   * §5 Intent and spec annotations, plus resolved questions.
   */
  resolvedAnnotations: ResolvedAnnotation[];
  /**
   * §6 Questions still open at handoff.
   */
  openQuestions: OpenQuestion[];
  /**
   * §7 Acceptance criteria.
   *
   * @minItems 1
   */
  acceptanceCriteria: [string, ...string[]];
  /**
   * §8 What developers can and can't take from the prototype.
   */
  trustBoundary: {
    trustworthy: string[];
    notTrustworthy: string[];
  };
}
export interface SpecState {
  node: NodeRef;
  title: string;
  canvasUrl?: string;
}
export interface ComponentUsage {
  name: SpecComponentName;
  usedIn: SpecUsedIn;
}
export interface ModifiedComponentUsage {
  name: SpecComponentName;
  usedIn: SpecUsedIn;
  /**
   * @minItems 1
   */
  changes: [string, ...string[]];
}
export interface NewComponentUsage {
  name: SpecComponentName;
  usedIn: SpecUsedIn;
  reason: string;
}
export interface BehaviorNote {
  screen?: ScreenId;
  description: string;
}
export interface ResolvedAnnotation {
  annotationId: string;
  type: "intent" | "spec" | "question";
  node: NodeRef;
  kitId?: KitId;
  body: string;
  resolution?: string;
}
export interface OpenQuestion {
  question: string;
  annotationId?: string;
  owner?: string;
}
/**
 * Output of `kit validate --json` (and every Cogitato validator). Read by hooks and the kit MCP server.
 */
export interface ValidationReport {
  schemaVersion: SchemaVersion;
  /**
   * True when there are no error-severity issues. Warnings don't fail validation.
   */
  ok: boolean;
  issues: Issue[];
}
/**
 * One problem found by a validator.
 */
export interface Issue {
  /**
   * Stable machine-readable code, e.g. "schema-required" or "code-hardcoded-color".
   */
  code: string;
  severity: Severity;
  /**
   * File the issue is in, relative to the folder being validated, with "/" separators.
   */
  file: string;
  /**
   * JSON pointer to the value inside a JSON file; "" for the whole file or for source files.
   */
  path: string;
  /**
   * 1-based line in a source file.
   */
  line?: number;
  /**
   * 1-based column in a source file.
   */
  column?: number;
  /**
   * Plain-language explanation a non-technical designer can act on.
   */
  message: string;
  /**
   * Machine-applicable replacement, e.g. "var(--kit-color-brand-600)".
   */
  suggestion?: string;
}
/**
 * __kit-data/snapshots.json in a built prototype: one screenshot per screen state, written by `kit snapshots` and read by the canvas so zoomed-out frames load instantly.
 */
export interface SnapshotManifest {
  $schema?: string;
  schemaVersion: SchemaVersion;
  commit?: CommitSha;
  /**
   * Size of the browser window each snapshot was taken at, in CSS pixels.
   */
  viewport: {
    width: number;
    height: number;
  };
  /**
   * Image path per state, relative to __kit-data/.
   */
  frames: {
    [k: string]: string | undefined;
  };
}
