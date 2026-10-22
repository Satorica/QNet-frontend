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
  '任务已取消','已发送取消请求，等待计算节点确认','计算节点暂时无法连接，系统正在重试','任务处理中','后端已接收任务',
 ]);
 assert.equal(logs.value[3].timestamp,events[1].timestamp);
 assert.equal(events[1].message,'任务已加入队列，等待处理');
 ctl.syncTaskLogs(events);
 assert.equal(logs.value.length,5);
});

function present(messages) {
 const exports={}; runInNewContext(code,{exports});
 const logs={value:[]}; const ctl=exports.createSolveLogController(logs);
 const events=Object.freeze(messages.map(([state,message],i)=>Object.freeze({
  sequence:i+1,state,message,timestamp:`original-${i}`,timestampNs:String(i),elapsedSeconds:i,
 })));
 ctl.syncTaskLogs(events);
 return { ctl, logs, events };
}

test('repeated dispatch failures display one waiting notice across polling snapshots', () => {
 const messages=[['received','后端已接收任务']];
 const failures=['无法连接到计算节点','提交计算任务到校内节点超时','计算节点暂不可用，等待重试'];
 for(let i=0;i<80;i++) {
  messages.push(['processing','任务开始调度，准备提交计算节点'],['queued',failures[i%failures.length]]);
 }
 const { ctl, logs, events }=present(messages);
 assert.deepEqual(Array.from(logs.value,e=>e.message),[
  '计算节点暂时无法连接，系统正在重试','任务处理中','后端已接收任务',
 ]);
 assert.equal(logs.value[0].timestamp,events[2].timestamp);
 ctl.syncTaskLogs(events);
 assert.equal(logs.value.length,3);
 assert.equal(events[2].message,'无法连接到计算节点');
});

test('confirmed node progress resumes display and a later outage gets its own notice', () => {
 const { logs }=present([
  ['queued','无法连接到计算节点'],
  ['processing','任务开始调度，准备提交计算节点'],
  ['processing','校内计算节点处理中'],
  ['queued','无法连接到计算节点'],
  ['processing','任务开始调度，准备提交计算节点'],
  ['queued','无法连接到计算节点'],
  ['completed','计算完成'],
 ]);
 assert.deepEqual(Array.from(logs.value,e=>e.message),[
  '计算完成','计算节点暂时无法连接，系统正在重试','任务处理中','计算节点暂时无法连接，系统正在重试',
 ]);
 assert.equal(logs.value[1].timestamp,'original-3');
});

test('retry notices never hide terminal failures or unrelated diagnostics', () => {
 const { logs }=present([
  ['queued','无法连接到计算节点'],
  ['processing','输入数据异常'],
  ['queued','无法连接到计算节点查询状态'],
  ['failed','无法连接到计算节点'],
 ]);
 assert.deepEqual(Array.from(logs.value,e=>e.message),[
  '无法连接到计算节点','输入数据异常','计算节点暂时无法连接，系统正在重试',
 ]);
 const timeout=present([
  ['queued','无法连接到计算节点'],
  ['failed','计算节点持续不可用，任务等待超时'],
 ]);
 assert.equal(timeout.logs.value[0].message,'计算节点持续不可用，任务等待超时');
});

test('busy retries are combined and cancellation remains visible', () => {
 const { logs }=present([
  ['queued','计算节点繁忙，等待重试'],
  ['processing','任务开始调度，准备提交计算节点'],
  ['queued','校内计算节点繁忙，任务已重新排队'],
  ['processing','已发送取消请求，等待计算节点确认'],
  ['cancelled','任务已取消'],
 ]);
 assert.deepEqual(Array.from(logs.value,e=>e.message),[
  '任务已取消','已发送取消请求，等待计算节点确认','计算节点繁忙，任务正在等待',
 ]);
});
