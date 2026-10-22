import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/content/api-docs.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const docs = {};
runInNewContext(code, {
  exports: docs,
  require: name => ({ default: readFileSync(new URL(`../src/content/${name.replace('?raw', '')}`, import.meta.url), 'utf8') }),
});
const python = promisify(execFile);

test('default task name examples match the selected problem', () => {
  const prefixes = { maxcut: 'MaxCut', coloring: 'Coloring', number_partition: 'NumberPartition', tsp: 'TSP', general: 'General' };
  for (const [problem, prefix] of Object.entries(prefixes)) {
    const payload = docs.buildTaskPayload(problem);
    const response = JSON.parse(docs.buildResponseExample('result', payload)).data;
    assert.equal(response.taskName, `${prefix}_1791763200000`);
    assert.equal(response.taskInfo.taskName, response.taskName);
  }
});

test('batch docs expose complete per-item payloads and per-item outcome envelopes', () => {
  const submit = docs.apiEndpoints.find(endpoint => endpoint.id === 'batch-submit');
  assert.equal(docs.apiEndpoints[0].id, 'batch-submit');
  assert.match(submit.description, /1–50 个任务/);
  for (const problem of docs.problemExamples) {
    const payload = docs.buildTaskPayload(problem.value, 'quantum');
    const rows = docs.flattenDocFields(docs.requestDocFields(submit, payload));
    assert.match(rows.find(row => row.path === 'tasks').field.description, /1–50 项/);
    assert.equal(rows.find(row => row.path === 'tasks[].payload.modelType').field.example, 'quantum');
    assert.equal(rows.find(row => row.path === 'tasks[].payload.problemType').field.example, problem.value);
    assert.equal(rows.find(row => row.path === 'tasks[].idempotencyKey').field.required, true);
    const response = JSON.parse(docs.buildResponseExample('batch-results', payload));
    assert.equal(response.data.tasks[0].state, 'completed');
    assert.ok(!('input' in response.data.tasks[0]));
    const script = docs.buildCompleteBatchExample('https://example.test/api/v1', payload);
    assert.ok(script.includes('"modelType":"quantum"'));
    assert.ok(script.includes('JOB_FILE'));
  }
});

test('result examples use valid problem encodings, dimensions and matching objective values', () => {
  const examples = [
    { problem: 'maxcut', matrix: [[0, 1], [1, 0]], solution: [-1, 1], value: 1 },
    { problem: 'number_partition', matrix: [1, 2, 3, 4], solution: [1, -1, -1, 1], value: 0 },
    { problem: 'coloring', matrix: [[0, 1], [1, 0]], solution: [0, 1], value: 0, usedColors: 2 },
    { problem: 'tsp', matrix: [[0, 1], [1, 0]], solution: [0, 1], value: 2 },
    { problem: 'general', matrix: [[1, -2], [0, 1]], solution: [0, 1], value: 1 },
    { problem: 'maxcut', matrix: [[0, 2, 4], [2, 0, 3], [4, 3, 0]], solution: [-1, 1, -1], value: 5 },
    { problem: 'number_partition', matrix: [2, 5, 3], solution: [1, -1, -1], value: 6 },
    { problem: 'coloring', matrix: [[0, 1, 1], [1, 0, 1], [1, 1, 0]], solution: [0, 1, 2], value: 0, usedColors: 3 },
    { problem: 'tsp', matrix: [[0, 2, 3], [2, 0, 4], [3, 4, 0]], solution: [0, 1, 2], value: 9 },
    { problem: 'general', matrix: [[2, -4, 1], [0, 3, -2], [1, 0, 2]], solution: [0, 1, 0], value: 3 },
  ];
  for (const example of examples) {
    const payload = { ...docs.buildTaskPayload(example.problem), matrixSize: example.matrix.length, adjacencyMatrix: example.matrix };
    const result = JSON.parse(docs.buildResponseExample('result', payload)).data;
    const candidate = result.results.candidates[0];
    assert.deepEqual(candidate.solution, example.solution);
    assert.equal(candidate.solution.length, result.taskInfo.matrixSize);
    assert.equal(candidate.value, example.value);
    assert.equal(result.resultSummary.bestValue, example.value);
    assert.equal(result.resultSummary.usedColors, example.usedColors ?? null);
  }
});

test('all Python request snippets send the documented method, path and API key without environment setup', async () => {
  const requests = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      requests.push({ method: request.method, path: request.url, key: request.headers.authorization, idem: request.headers['idempotency-key'], body });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ data: { taskId: 't_abcdefghijklmnop' }, requestId: 'example' }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    for (const endpoint of docs.apiEndpoints) {
      const snippet = docs.buildRequestExample(endpoint, base, 'python');
      assert.ok(!snippet.includes('os.environ'));
      const result = await python('python', ['-c', snippet], { timeout: 10000, encoding: 'utf8' });
      assert.equal(JSON.parse(result.stdout).data.taskId, 't_abcdefghijklmnop');
      const request = requests.at(-1);
      assert.equal(request.method, endpoint.method);
      assert.equal(request.key, 'Bearer YOUR_API_KEY');
      assert.equal(request.path.split('?')[0], '/api/v1' + endpoint.path.replace('{taskId}', 't_abcdefghijklmnop'));
      if (endpoint.id === 'submit') {
        assert.ok(request.idem);
        assert.deepEqual(JSON.parse(request.body), JSON.parse(JSON.stringify(docs.buildTaskPayload('maxcut'))));
      } else if (endpoint.id.startsWith('batch-')) {
        assert.equal(request.idem, undefined);
        const sent = JSON.parse(request.body);
        if (endpoint.id === 'batch-submit') {
          assert.equal(sent.tasks[0].idempotencyKey, 'YOUR_UNIQUE_REQUEST_ID_1');
          assert.deepEqual(sent.tasks[0].payload, JSON.parse(JSON.stringify(docs.buildTaskPayload('maxcut'))));
        } else assert.deepEqual(sent.taskIds, ['t_abcdefghijklmnop']);
      } else assert.equal(request.body, '');
    }
    const submit = docs.apiEndpoints.find(endpoint => endpoint.id === 'submit');
    for (const problem of docs.problemExamples) {
      const payload = docs.buildTaskPayload(problem.value, 'quantum');
      await python('python', ['-c', docs.buildRequestExample(submit, base, 'python', payload)], { timeout: 10000 });
      const sent = JSON.parse(requests.at(-1).body);
      assert.equal(sent.problemType, problem.value);
      assert.equal(sent.modelType, 'quantum');
      assert.equal(Object.hasOwn(sent, 'methodType'), false);
      assert.equal(sent.matrixSize, sent.adjacencyMatrix.length);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('curl and response examples use v1 paths, placeholders and the data envelope', () => {
  for (const endpoint of docs.apiEndpoints) {
    const snippet = docs.buildRequestExample(endpoint, 'https://api.trisp.com.cn/api/v1', 'curl');
    assert.ok(snippet.includes(`--request ${endpoint.method}`));
    assert.ok(snippet.includes('https://api.trisp.com.cn/api/v1'));
    assert.ok(snippet.includes('Bearer YOUR_API_KEY'));
    assert.ok(!snippet.includes('$env:') && !snippet.includes('QNET_'));
    const response = JSON.parse(docs.buildResponseExample(endpoint.id));
    assert.ok(response.data);
    assert.equal(typeof response.requestId, 'string');
    assert.ok(endpoint.responseFields.length > 0);
  }
});

test('Python and curl snippets replay the same submission after a lost response', async () => {
  const tasks = new Map();
  const requests = [];
  let loseResponse = true;
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const key = request.headers['idempotency-key'];
      requests.push({ key, payload: JSON.parse(body) });
      if (!tasks.has(key)) tasks.set(key, { taskId: `task-${tasks.size + 1}` });
      if (loseResponse) {
        loseResponse = false;
        // The task was accepted, but the caller never received its response.
        response.destroy();
        return;
      }
      response.writeHead(202, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ data: tasks.get(key), requestId: 'test' }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const submit = docs.apiEndpoints.find(endpoint => endpoint.id === 'submit');
  const snippet = language => docs.buildRequestExample(submit, base, language)
    .replaceAll('YOUR_UNIQUE_REQUEST_ID', 'original-submission');
  const runPython = script => python('python', ['-c', script], { timeout: 10000, encoding: 'utf8' });
  const runCurl = script => python('python', ['-c',
    'import shlex,subprocess,sys\nresult=subprocess.run(shlex.split(sys.argv[1]),capture_output=True,text=True,check=True)\nprint(result.stdout)', script.replaceAll(String.fromCharCode(92, 10), ''),
  ], { timeout: 10000, encoding: 'utf8' });
  try {
    await assert.rejects(runPython(snippet('python')));
    const replayPython = await runPython(snippet('python'));
    const replayCurl = await runCurl(snippet('curl'));
    assert.equal(JSON.parse(replayPython.stdout).data.taskId, 'task-1');
    assert.equal(JSON.parse(replayCurl.stdout).data.taskId, 'task-1');
    assert.equal(tasks.size, 1);
    assert.deepEqual(requests.map(request => request.key), Array(3).fill('original-submission'));
    assert.deepEqual(requests[0].payload, requests[2].payload);
    const next = await runPython(snippet('python').replaceAll('original-submission', 'new-submission'));
    assert.equal(JSON.parse(next.stdout).data.taskId, 'task-2');
    assert.equal(tasks.size, 2);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('nested parameter rows keep full paths and collapse only their descendants', () => {
  const quota = docs.apiEndpoints.find(endpoint => endpoint.id === 'quota');
  const fields = docs.responseDocFields(quota);
  const all = docs.flattenDocFields(fields);
  const paths = all.map(row => row.path);
  assert.equal(new Set(paths).size, paths.length);
  const available = all.find(row => row.path === 'data.quotaSummary.models.classic.available');
  assert.equal(available.depth, 4);
  assert.equal(available.field.example, 198);
  const closed = docs.flattenDocFields(fields, new Set());
  assert.deepEqual(Array.from(closed, row => row.path), ['data', 'requestId']);
  const partial = docs.flattenDocFields(fields, new Set(['data', 'data.quotaSummary', 'data.quotaSummary.models', 'data.quotaSummary.models.classic']));
  assert.ok(partial.some(row => row.path.endsWith('classic.available')));
  assert.ok(!partial.some(row => row.path.endsWith('quantum.available')));
  const list = docs.responseDocFields(docs.apiEndpoints.find(endpoint => endpoint.id === 'list'));
  assert.equal(docs.flattenDocFields(list).find(row => row.path === 'data.tasks[].taskId').field.example, 't_abcdefghijklmnop');
});

test('five problem shapes agree between parameter trees and response examples', () => {
  const submit = docs.apiEndpoints.find(endpoint => endpoint.id === 'submit');
  const result = docs.apiEndpoints.find(endpoint => endpoint.id === 'result');
  for (const problem of docs.problemExamples) {
    const payload = docs.buildTaskPayload(problem.value);
    const request = docs.flattenDocFields(docs.requestDocFields(submit, payload));
    const element = request.find(row => row.path === 'adjacencyMatrix[]');
    assert.equal(element.field.type, problem.value === 'number_partition' ? 'integer' : 'array<number>');
    const response = JSON.parse(docs.buildResponseExample('result', payload));
    const rows = docs.flattenDocFields(docs.responseDocFields(result, payload));
    for (const key of Object.keys(response.data.input)) assert.ok(rows.some(row => row.path === 'data.input.' + key));
  }
  const general = docs.flattenDocFields(docs.requestDocFields(submit));
  assert.equal(general.find(row => row.path === 'generalInput.matrixObjective.kind').field.example, 'quadratic');
  assert.ok(general.some(row => row.path === 'generalInput.constraints[].penalty'));
});

test('basic arrays display in one row while object arrays keep their fields and element constraints survive', () => {
  const submit = docs.apiEndpoints.find(endpoint => endpoint.id === 'submit');
  for (const problem of docs.problemExamples) {
    const fields = docs.requestDocFields(submit, docs.buildTaskPayload(problem.value));
    const before = JSON.stringify(fields);
    const rows = docs.flattenDocFields(docs.compactDocFields(fields));
    const matrix = rows.find(row => row.path === 'adjacencyMatrix').field;
    assert.equal(matrix.type, problem.value === 'number_partition' ? 'array<integer>' : 'array<array<number>>');
    assert.ok(!matrix.children);
    assert.ok(!rows.some(row => row.path.startsWith('adjacencyMatrix[]')));
    assert.equal(JSON.stringify(matrix.example), JSON.stringify(docs.buildTaskPayload(problem.value).adjacencyMatrix));
    if (problem.value !== 'number_partition') assert.ok(matrix.description.includes('长度等于 matrixSize'));
    const variables = rows.find(row => row.path === 'generalInput.variables').field;
    assert.ok(variables.description.includes('以字母或下划线开头'));
    assert.ok(!variables.children);
    assert.ok(rows.some(row => row.path === 'generalInput.constraints[].penalty'));
    assert.equal(JSON.stringify(fields), before);
  }
  const result = docs.apiEndpoints.find(endpoint => endpoint.id === 'result');
  const rows = docs.flattenDocFields(docs.compactDocFields(docs.responseDocFields(result)));
  assert.equal(rows.find(row => row.path === 'data.taskInfo.adjacencyMatrix').field.type, 'array<array<number>>');
  assert.equal(rows.find(row => row.path === 'data.results.candidates[].solution').field.type, 'array<number>');
  assert.ok(rows.some(row => row.path === 'data.results.candidates[].rank'));
});

test('inline workflow scripts use the selected problem, model and API base', async () => {
  const examples = [];
  for (const problem of docs.problemExamples) {
    for (const model of ['classic', 'quantum']) {
      const payload = docs.buildTaskPayload(problem.value, model);
      const script = docs.buildCompleteTaskExample('https://example.test/api/v1', payload);
      assert.ok(script.includes('def wait_for_result('));
      assert.ok(!script.includes('os.environ'));
      examples.push({ script, payload });
    }
  }
  for (const example of examples) {
    const result = await python('python', ['-c', `import ast,json,sys
assignments={}
for node in ast.parse(sys.argv[1]).body:
    if isinstance(node,ast.Assign):
        for target in node.targets:
            if isinstance(target,ast.Name) and target.id in ('PAYLOAD','BASE_URL'):
                assignments[target.id]=ast.literal_eval(node.value)
print(json.dumps(assignments))`, example.script], { timeout: 10000, encoding: 'utf8' });
    const assignments = JSON.parse(result.stdout);
    assert.equal(assignments.BASE_URL, 'https://example.test/api/v1');
    assert.deepEqual(assignments.PAYLOAD, JSON.parse(JSON.stringify(example.payload)));
  }
});
