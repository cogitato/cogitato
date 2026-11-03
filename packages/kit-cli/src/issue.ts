import type { Issue } from "@cogitato/contract";
import ts from "typescript";

export type { Issue };

/** Issue at a position in a TypeScript source file. */
export function issueAt(
  code: string,
  sf: ts.SourceFile,
  node: ts.Node,
  message: string,
  extra: { severity?: Issue["severity"]; suggestion?: string } = {},
): Issue {
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return {
    code,
    severity: extra.severity ?? "error",
    file: sf.fileName,
    path: "",
    line: line + 1,
    column: character + 1,
    message,
    ...(extra.suggestion !== undefined ? { suggestion: extra.suggestion } : {}),
  };
}

export function parseSource(file: string, text: string): ts.SourceFile {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

/** Text of a string literal or a template without substitutions; undefined for anything computed. */
export function literalText(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return literalText(node.expression);
  }
  return undefined;
}

/** Name of an object literal property when it's written as plain text. */
export function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  return undefined;
}

/** The value expression of property `key` in an object literal, if it's a plain `key: value` assignment. */
export function getProperty(obj: ts.ObjectLiteralExpression, key: string): ts.PropertyAssignment | undefined {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && propertyName(p.name) === key) return p;
  }
  return undefined;
}

/** Calls to `name(...)` (or `x.name(...)`) anywhere in the file. */
export function findCalls(sf: ts.SourceFile, name: string): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : undefined;
      if (calleeName === name) out.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
