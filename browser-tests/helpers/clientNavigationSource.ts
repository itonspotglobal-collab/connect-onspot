import { readFileSync } from "node:fs";
import ts from "typescript";

// Read production definitions rather than maintaining a second navigation list.
// No app/server modules are imported or executed by this helper.
export const appSource = readFileSync("client/src/App.tsx", "utf8");
export const layoutSource = readFileSync("client/src/components/ClientLayout.tsx", "utf8");
const app = ts.createSourceFile("App.tsx", appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const layout = ts.createSourceFile("ClientLayout.tsx", layoutSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function visit(node: ts.Node, callback: (node: ts.Node) => void) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

export function functionNode(name: string) {
  const node = app.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  if (!node) throw new Error(`Missing production router function: ${name}`);
  return node;
}

export function functionSource(name: string) {
  return functionNode(name).getText(app);
}

export function routesInFunction(name: string) {
  const routes = new Map<string, { markup: string; component: string }>();
  visit(functionNode(name), (node) => {
    if (!ts.isJsxSelfClosingElement(node) || node.tagName.getText(app) !== "Route") return;
    const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
    const path = attributes.find((attribute) => attribute.name.getText(app) === "path")?.initializer;
    const component = attributes.find((attribute) => attribute.name.getText(app) === "component")?.initializer;
    if (!path || !ts.isStringLiteral(path)) return;
    routes.set(path.text, {
      markup: node.getText(app),
      component: component && ts.isJsxExpression(component) ? component.expression?.getText(app) ?? "" : "",
    });
  });
  return routes;
}

export const navigationItems: { title: string; url: string }[] = [];
visit(layout, (node) => {
  if (!ts.isVariableDeclaration(node) ||
      !["coreModules", "managementItems", "systemItems"].includes(node.name.getText(layout))) return;
  if (!node.initializer || !ts.isArrayLiteralExpression(node.initializer)) {
    throw new Error("Client navigation structure changed; update this source reader.");
  }
  for (const element of node.initializer.elements) {
    if (!ts.isObjectLiteralExpression(element)) throw new Error("Unsupported Client navigation entry");
    const properties = element.properties.filter(ts.isPropertyAssignment);
    const value = (key: string) => {
      const initializer = properties.find((property) => property.name.getText(layout) === key)?.initializer;
      if (!initializer || !ts.isStringLiteral(initializer)) throw new Error(`Missing navigation ${key}`);
      return initializer.text;
    };
    navigationItems.push({ title: value("title"), url: value("url") });
  }
});