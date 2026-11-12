import { posix } from "node:path";
import ts from "typescript";
import { issueAt, literalText, propertyName, type Issue } from "../issue.js";
import { WORKSPACE_LAYOUT, type ContractView } from "../project.js";
import { ID_PATTERNS, type ScreenEntry } from "../registry.js";
import { FINDING_CODES, SUBSTITUTION, checkCssNumber, checkCssValue } from "./css-values.js";

/** A literal data-kit-id found in code, for duplicate detection across a screen's files. */
export interface KitIdUse {
  id: string;
  owner?: ScreenEntry;
  file: string;
  line: number;
  column: number;
}

export interface TsxContext {
  contract: ContractView;
  /** The screen whose folder contains this file, if any. */
  owner?: ScreenEntry;
  /** True for a file in the shared kit: screen-only rules (kit imports, data-kit-id on elements) don't apply. */
  inKit?: boolean;
}

const NATIVE_INTERACTIVE = new Set(["button", "a", "input", "select", "textarea"]);

/** Kit component name for an import specifier, or undefined if it doesn't point into the shared kit. */
function kitImportName(file: string, specifier: string): string | undefined {
  let rest: string | undefined;
  if (specifier.startsWith("@/kit/")) rest = specifier.slice("@/kit/".length);
  else if (specifier.startsWith(".")) {
    const target = posix.normalize(posix.join(posix.dirname(file), specifier));
    const kit = `../../${WORKSPACE_LAYOUT.kit}/`;
    if (target.startsWith(kit)) rest = target.slice(kit.length);
  }
  const name = rest?.split("/")[0]?.replace(/\.(tsx?|jsx?)$/, "");
  // Lowercase files and stylesheets in the kit folder are helpers, not components.
  return name && /^[A-Z][A-Za-z0-9]*$/.test(name) ? name : undefined;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");

// A readable element name for a suggested id: from its label, aria-label, name or text.
function suggestElementName(el: ts.JsxOpeningLikeElement, sf: ts.SourceFile): string {
  for (const attr of el.attributes.properties) {
    if (!ts.isJsxAttribute(attr) || !attr.initializer) continue;
    const name = attr.name.getText(sf);
    if (!["label", "aria-label", "name", "placeholder", "title"].includes(name)) continue;
    const text = ts.isStringLiteral(attr.initializer) ? attr.initializer.text : undefined;
    if (text && slugify(text)) return slugify(text);
  }
  const parent = el.parent;
  if (ts.isJsxElement(parent)) {
    const text = parent.children
      .filter(ts.isJsxText)
      .map((c) => c.text)
      .join(" ")
      .trim();
    if (text && slugify(text)) return slugify(text);
  }
  return slugify(el.tagName.getText(sf)) || "element";
}

/** Token, component and data-kit-id rules for one .ts/.tsx file. */
export function checkTsxFile(sf: ts.SourceFile, ctx: TsxContext): { issues: Issue[]; kitIds: KitIdUse[] } {
  const issues: Issue[] = [];
  const kitIds: KitIdUse[] = [];
  const file = sf.fileName;
  const { contract, owner } = ctx;
  const inKit = ctx.inKit === true;
  // Local identifier -> kit component name, from this file's imports.
  const kitLocals = new Map<string, string>();

  const styleFindings = (prop: string, node: ts.Expression) => {
    const findings = ts.isNumericLiteral(node)
      ? checkCssNumber(contract, prop, Number(node.text))
      : ts.isTemplateExpression(node)
        ? checkCssValue(contract, prop, [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(SUBSTITUTION))
        : literalText(node) !== undefined
          ? checkCssValue(contract, prop, literalText(node)!)
          : [];
    for (const f of findings) {
      issues.push(issueAt(FINDING_CODES[f.kind], sf, node, f.message, f.suggestion ? { suggestion: f.suggestion } : {}));
    }
  };

  const checkKitId = (el: ts.JsxOpeningLikeElement, what: string) => {
    let idAttr: ts.JsxAttribute | undefined;
    let hasSpread = false;
    for (const a of el.attributes.properties) {
      if (ts.isJsxSpreadAttribute(a)) hasSpread = true;
      else if (a.name.getText(sf) === "data-kit-id") idAttr = a;
    }
    const prefix = owner?.id;
    const example = `${prefix ?? "screen.id"}.${suggestElementName(el, sf)}`;
    if (!idAttr) {
      // A spread may be passing the id through; that's the kit-wrapper pattern.
      if (hasSpread) return;
      issues.push(
        issueAt("code-missing-kit-id", sf, el, `This ${what} needs a data-kit-id so comments can be pinned to it. Add data-kit-id="${example}".`, {
          suggestion: example,
        }),
      );
      return;
    }
    const init = idAttr.initializer;
    const expr = init && ts.isJsxExpression(init) ? init.expression : init;
    const id = literalText(expr);
    if (id === undefined) {
      if (expr && ts.isTemplateExpression(expr) && prefix && !expr.head.text.startsWith(`${prefix}.`)) {
        issues.push(issueAt("code-invalid-kit-id", sf, expr, `This element id doesn't start with "${prefix}.", the ${owner!.title} screen's id. Element ids start with their screen's id.`));
      } else if (!expr || !ts.isTemplateExpression(expr)) {
        issues.push(
          issueAt("code-kit-id-unchecked", sf, idAttr, `This data-kit-id is computed, so Cogitato can't check it. Prefer plain text, like data-kit-id="${example}".`, {
            severity: "warning",
          }),
        );
      }
      return;
    }
    if (!ID_PATTERNS.kitId.test(id)) {
      issues.push(
        issueAt("code-invalid-kit-id", sf, idAttr, `"${id}" isn't a valid element id. Element ids are the screen id plus an element name, lowercase and dot-separated, like "${example}".`, {
          suggestion: example,
        }),
      );
      return;
    }
    if (prefix && !id.startsWith(`${prefix}.`)) {
      const fixed = `${prefix}.${id.slice(id.lastIndexOf(".") + 1)}`;
      issues.push(
        issueAt("code-invalid-kit-id", sf, idAttr, `"${id}" doesn't start with this screen's id. Elements on the ${owner!.title} screen need ids starting with "${prefix}.", like "${fixed}".`, {
          suggestion: fixed,
        }),
      );
      return;
    }
    const { line, character } = sf.getLineAndCharacterOfPosition(idAttr.getStart(sf));
    kitIds.push({ id, owner, file, line: line + 1, column: character + 1 });
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = kitImportName(file, node.moduleSpecifier.text);
      if (name && !inKit) {
        if (!contract.manifests.has(name)) {
          issues.push(
            issueAt("code-unknown-component", sf, node, `${name} isn't in the design system yet, so it can't be used here. Use an existing component from the kit, or record it as a gap so the team can add it.`),
          );
        }
        const clause = node.importClause;
        if (clause?.name) kitLocals.set(clause.name.text, name);
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) {
            kitLocals.set(el.name.text, (el.propertyName ?? el.name).text);
          }
        }
      }
    }

    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && !inKit) {
      const tag = node.tagName.getText(sf);
      const handlers = node.attributes.properties.some(
        (a) => ts.isJsxAttribute(a) && /^on[A-Z]/.test(a.name.getText(sf)),
      );
      const kitName = kitLocals.get(tag);
      const manifest = kitName ? contract.manifests.get(kitName) : undefined;
      const kitInteractive = manifest ? Object.values(manifest.props).some((p) => p?.type === "event") : false;
      if (NATIVE_INTERACTIVE.has(tag) || handlers || kitInteractive) {
        checkKitId(node, kitName ? `${kitName}` : /^[a-z]/.test(tag) ? `<${tag}>` : `${tag}`);
      }
    }

    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "style" && node.initializer && ts.isJsxExpression(node.initializer)) {
      const obj = node.initializer.expression;
      if (obj && ts.isObjectLiteralExpression(obj)) {
        for (const p of obj.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          const prop = propertyName(p.name);
          if (prop) styleFindings(prop, p.initializer);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { issues, kitIds };
}

/** Duplicate data-kit-ids within one screen. Reported where the later use is. */
export function duplicateKitIds(uses: KitIdUse[]): Issue[] {
  const first = new Map<string, KitIdUse>();
  const issues: Issue[] = [];
  for (const u of uses) {
    const key = `${u.owner?.id ?? ""}|${u.id}`;
    const prev = first.get(key);
    if (!prev) {
      first.set(key, u);
      continue;
    }
    issues.push({
      code: "code-duplicate-kit-id",
      severity: "error",
      file: u.file,
      path: "",
      line: u.line,
      column: u.column,
      message: `"${u.id}" is used twice${u.owner ? ` on the ${u.owner.title} screen` : ""} (also at ${prev.file}, line ${prev.line}). Each element needs its own id so comments land on the right one.`,
    });
  }
  return issues;
}
