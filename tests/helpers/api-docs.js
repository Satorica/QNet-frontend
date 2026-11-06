import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

export function loadApiDocs() {
  const source = readFileSync(new URL('../../src/content/api-docs.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const docs = {};
  runInNewContext(code, {
    exports: docs,
    require: name => ({ default: readFileSync(new URL(`../../src/content/${name.replace('?raw', '')}`, import.meta.url), 'utf8') }),
  });
  return docs;
}
