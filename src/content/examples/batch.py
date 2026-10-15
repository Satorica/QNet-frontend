"""QNet batch workflow, Python 3.9+ standard library.
Keep JOB_FILE to resume safely. Use a NEW filename only for a genuinely new job.
The job file contains inputs and item keys, never the API credential.
"""
import json
import socket
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE_URL = "https://api.trisp.com.cn/api/v1"
API_KEY = "YOUR_API_KEY"
PAYLOAD = {'problemType': 'maxcut', 'modelType': 'classic', 'methodType': 'sa', 'matrixSize': 2, 'adjacencyMatrix': [[0, 1], [1, 0]]}
TASK_PAYLOADS = [dict(PAYLOAD), dict(PAYLOAD)]  # Replace with your full task parameters.
JOB_FILE = Path("qnet-batch-job.json")
OUTPUT_DIR = Path("qnet-batch-results")
WAIT_TIMEOUT = 600  # Stopping the client does not cancel accepted tasks.
SUBMIT_BATCH_SIZE = 25
SUBMIT_BYTES = 4 * 1024 * 1024


def save_job(job):
    temporary = JOB_FILE.with_suffix(JOB_FILE.suffix + '.tmp')
    temporary.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(JOB_FILE)


def encode_json(payload):
    return json.dumps(payload, allow_nan=False).encode('utf-8')


def api_call(path, payload=None, method='POST'):
    headers = {'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json'}
    body = encode_json(payload) if payload is not None else None
    for attempt in range(6):
        delay = min(30, 2 ** attempt)
        try:
            with urlopen(Request(BASE_URL + path, data=body, headers=headers, method=method), timeout=30) as response:
                return json.load(response)['data']
        except HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504):
                raise RuntimeError(exc.read().decode('utf-8', errors='replace')) from None
            try:
                delay = max(delay, float(exc.headers.get('Retry-After', '0')))
            except (TypeError, ValueError):
                pass
        except (URLError, TimeoutError, socket.timeout, ConnectionError):
            pass
        if attempt == 5:
            raise RuntimeError('Retries exhausted. Keep the job file and resume with the SAME item keys.')
        time.sleep(delay)


def chunks(items, size):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def submission_item(item):
    return {'idempotencyKey': item['idempotencyKey'], 'payload': item['payload']}


def submission_chunks(items):
    # Count the exact wire encoding, including the envelope and list separators.
    overhead = len(encode_json({'tasks': []}))
    group, size = [], overhead
    for item in items:
        item_size = len(encode_json(submission_item(item)))
        if overhead + item_size > SUBMIT_BYTES:
            raise ValueError('Task ' + item['idempotencyKey'] +
                             ' exceeds the 4 MiB batch request limit by itself. '
                             'Keep its key and input; use the single-task API or contact the service.')
        extra = item_size + (2 if group else 0)  # json.dumps uses ", ".
        if group and (len(group) >= SUBMIT_BATCH_SIZE or size + extra > SUBMIT_BYTES):
            yield group
            group, size = [], overhead
            extra = item_size
        group.append(item)
        size += extra
    if group:
        yield group


def main():
    if not API_KEY or API_KEY == 'YOUR_API_KEY':
        raise ValueError('Set API_KEY before running this example.')
    if JOB_FILE.exists():
        job = json.loads(JOB_FILE.read_text(encoding='utf-8'))
        if job['baseUrl'] != BASE_URL:
            raise ValueError('Job belongs to a different API base URL.')
        print('Resuming saved job; TASK_PAYLOADS changes do not change this job.')
    else:
        job = {'baseUrl': BASE_URL, 'createdAt': time.time(), 'items': [
            {'idempotencyKey': str(uuid.uuid4()), 'payload': payload} for payload in TASK_PAYLOADS]}
        save_job(job)  # Persist all keys before sending any request.
    unsent = [item for item in job['items'] if not item.get('taskId')]
    if unsent and time.time() - job['createdAt'] >= 23 * 3600:
        raise RuntimeError('Unconfirmed submission is near/past its 24h deduplication window. Reconcile with the service before resubmitting.')
    for group in submission_chunks(unsent):
        data = api_call('/tasks/batch', {'tasks': [submission_item(item) for item in group]})
        by_key = {item['idempotencyKey']: item for item in data['tasks']}
        for item in group:
            accepted = by_key[item['idempotencyKey']]
            item['taskId'] = accepted['taskId']
            if accepted.get('taskDeleted'):
                item['terminal'] = 'deleted'
        save_job(job)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + WAIT_TIMEOUT
    while time.monotonic() < deadline:
        pending = [item for item in job['items'] if not item.get('terminal')]
        if not pending:
            print('Finished. Check the job file for failed/cancelled tasks and the output directory for results.')
            return
        completed = []
        for group in chunks(pending, 100):
            data = api_call('/tasks/batch-status', {'taskIds': [item['taskId'] for item in group]})
            by_id = {item['taskId']: item for item in group}
            for status in data['tasks']:
                item = by_id[status['taskId']]
                if 'error' in status:
                    item.update(terminal='unavailable', error=status['error'])
                elif status['state'] == 'completed':
                    completed.append(item)
                elif status['state'] in ('failed', 'cancelled'):
                    item.update(terminal=status['state'], message=status.get('message', ''))
            save_job(job)
        for group in chunks(completed, 20):
            data = api_call('/tasks/batch-results', {'taskIds': [item['taskId'] for item in group]})
            by_id = {item['taskId']: item for item in group}
            for result in data['tasks']:
                key = result['taskId']
                if result.get('error', {}).get('code') == 'RESULT_TOO_LARGE':
                    result = api_call('/tasks/' + key + '/result', method='GET')
                if 'error' in result:
                    print('Result not saved:', key, result['error'])
                    continue
                (OUTPUT_DIR / (key + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
                by_id[key]['terminal'] = 'completed'
            save_job(job)
        time.sleep(2)
    raise TimeoutError('Stopped waiting. Keep the job file and rerun to resume; accepted tasks were not cancelled.')


if __name__ == '__main__':
    main()
