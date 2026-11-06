// Explicit cross-repository contract checks; excluded from the ordinary npm test suite.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { loadApiDocs } from '../helpers/api-docs.js';

const docs = loadApiDocs();
const python = promisify(execFile);
const pythonCommand = process.env.QNET_PYTHON || 'python';
const backend = resolve(process.env.QNET_BACKEND_DIR || fileURLToPath(new URL('../../../backend', import.meta.url)));
const documentPaths = [
  resolve(process.env.QNET_API_DOC_FILE || fileURLToPath(new URL('../../../docs/API文档.md', import.meta.url))),
  resolve(backend, 'docs/public-api.md'),
];
assert.ok(existsSync(resolve(backend, 'services/problem_data_service.py')), 'Set QNET_BACKEND_DIR to the backend checkout for integration tests.');
for (const path of documentPaths) assert.ok(existsSync(path), `Missing contract document: ${path}; set QNET_API_DOC_FILE or QNET_BACKEND_DIR.`);

test('quantum documentation payloads and Markdown examples pass the real backend validator', async () => {
  const payloads = docs.problemExamples.flatMap(problem => docs.quantumDeviceExamples.map(choice => docs.buildTaskPayload(problem.value, 'quantum', choice.value)));
  for (const relative of documentPaths) {
    const markdown = readFileSync(relative, 'utf8');
    const examples = [...markdown.matchAll(/```json\s*\n([\s\S]*?)```/g)].flatMap(match => {
      let value;
      try { value = JSON.parse(match[1]); } catch { return []; }
      if (value?.modelType === 'quantum') return [value];
      return (value?.tasks || []).filter(item => item.payload?.modelType === 'quantum').map(item => item.payload);
    });
    assert.ok(examples.length >= 5, relative + ': full single plus four batch payloads');
    payloads.push(...examples);
  }
  const result = await python(pythonCommand, ['-c', `import json,sys
sys.path.insert(0,sys.argv[1])
from services.problem_data_service import validate_task_payload
payloads=json.loads(sys.argv[2])
for payload in payloads:
    validate_task_payload(payload)
print(len(payloads))`, backend, JSON.stringify(payloads)], { timeout: 10000, encoding: 'utf8' });
  assert.equal(Number(result.stdout.trim()), payloads.length);
});

test('documented classic, single and cluster dimensions match backend limits', async () => {
  const result = await python(pythonCommand, ['-c', `import json,sys
sys.path.insert(0,sys.argv[1])
from services.problem_data_service import PROBLEM_SPECS,QUANTUM_SIZE_LIMITS
print(json.dumps(dict(classic=PROBLEM_SPECS,quantum=QUANTUM_SIZE_LIMITS)))`, backend], { timeout: 10000, encoding: 'utf8' });
  const limits = JSON.parse(result.stdout);
  for (const problem of docs.problemExamples) {
    assert.ok(problem.size.includes(`经典 2–${limits.classic[problem.value].max_size}`));
    assert.ok(problem.size.includes(`量子单台 2–${limits.quantum.single[problem.value]}`));
    assert.ok(problem.size.includes(`多台 2–${limits.quantum.multi[problem.value]}`));
  }
});
