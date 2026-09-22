import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../src/utils/solveLog.ts', import.meta.url), 'utf8'), {
 compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
}).outputText;
test('only backend records are displayed with original timestamps, without a client clock or fallback', () => {
 const exports={}; runInNewContext(code,{exports, Date: class { constructor(){throw Error('No local clock');} }});
 const logs={value:[]}; const ctl=exports.createSolveLogController(logs);
 const events=Object.freeze([Object.freeze({sequence:1,message:'后端已接收任务',timestamp:'2026-09-22T16:00:00.123456789+08:00'}),Object.freeze({sequence:2,message:'计算完成',timestamp:'2026-09-22T16:00:01.123456789+08:00'})]);
 ctl.syncTaskLogs(events);
 assert.deepEqual(Array.from(logs.value),[events[1],events[0]]);
 ctl.syncTaskLogs(events);
 assert.equal(logs.value.length,2);
 assert.equal(ctl.addLog,undefined);
 assert.equal(ctl.addTaskProgressLog,undefined);
 ctl.syncTaskLogs(undefined);
 assert.equal(logs.value.length,0);
 ctl.syncTaskLogs(events); ctl.resetSolveLogs();
 assert.equal(logs.value.length,0);
});
