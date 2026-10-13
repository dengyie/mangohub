import { readFile, access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath, extname } from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../src/", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  const alias = specifier.startsWith("@/");
  const relative = specifier.startsWith(".") && context.parentURL?.startsWith("file:");
  if (!alias && !relative) return nextResolve(specifier, context);
  const base = alias ? resolvePath(root, specifier.slice(2)) : fileURLToPath(new URL(specifier, context.parentURL));
  const candidates = extname(base) ? [base] : [base + ".ts", base + ".tsx", base + ".js", base + ".json", resolvePath(base, "index.ts")];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return nextResolve(pathToFileURL(candidate).href, context);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || !/\.(?:tsx?|json)$/.test(url)) return nextLoad(url, context);
  const source = await readFile(new URL(url), "utf8");
  if (url.endsWith(".json")) return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(JSON.parse(source))};` };
  const result = ts.transpileModule(source, {
    fileName: fileURLToPath(url),
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  return { format: "module", shortCircuit: true, source: result.outputText };
}
