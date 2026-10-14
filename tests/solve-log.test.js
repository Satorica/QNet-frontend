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

test('active status updates collapse into one processing entry without hiding failures', () => {
 const exports={}; runInNewContext(code,{exports});
 const logs={value:[]}; const ctl=exports.createSolveLogController(logs);
 const messages = [
  ['received','后端已接收任务'], ['queued','任务已加入队列，等待处理'],
  ['processing','任务开始调度，准备提交计算节点'], ['processing','正在轮询计算节点状态'],
  ['queued','无法连接到计算节点'], ['processing','正在等待计算节点状态同步'],
  ['processing','已发送取消请求，等待计算节点确认'], ['cancelled','任务已取消'],
 ];
 const events=Object.freeze(messages.map(([state,message],i)=>Object.freeze({
  sequence:i+1,state,message,timestamp:`original-${i}`,timestampNs:String(i),elapsedSeconds:i,
 })));
 ctl.syncTaskLogs(events);
 assert.deepEqual(Array.from(logs.value,e=>e.message),[
  '任务已取消','已发送取消请求，等待计算节点确认','任务处理中','无法连接到计算节点','任务处理中','后端已接收任务',
 ]);
 assert.equal(logs.value[4].timestamp,events[1].timestamp);
 assert.equal(events[1].message,'任务已加入队列，等待处理');
 ctl.syncTaskLogs(events);
 assert.equal(logs.value.length,6);
});
