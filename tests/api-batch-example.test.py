import importlib.util
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch


class BatchExampleTests(unittest.TestCase):
    def test_real_http_lifecycle_retries_same_keys_and_resumes_without_resubmission(self):
        self.run_http_lifecycle()

    def test_large_matrices_use_one_request_and_keep_keys_on_retry_and_resume(self):
        matrix = [[0 if i == j else 30 for j in range(256)] for i in range(256)]
        payload = dict(problemType='maxcut', modelType='classic', matrixSize=256, adjacencyMatrix=matrix)
        self.run_http_lifecycle([dict(payload) for _ in range(25)])

    def run_http_lifecycle(self, payloads=None):
        owner = self
        requests, stored = [], {}
        submit_sizes = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                pass

            def do_POST(self):
                raw = self.rfile.read(int(self.headers['Content-Length']))
                if self.path.endswith('/batch'):
                    submit_sizes.append(len(raw))
                    if len(raw) > 32 * 1024 * 1024:
                        self.send_response(413)
                        self.end_headers()
                        return
                body = json.loads(raw)
                requests.append((self.path, body))
                owner.assertEqual(self.headers['Authorization'], 'Bearer example-test-key')
                owner.assertIsNone(self.headers.get('Idempotency-Key'))
                if self.path.endswith('/batch'):
                    results = []
                    for item in body['tasks']:
                        key = item['idempotencyKey']
                        if key not in stored:
                            stored[key] = dict(taskId='t_test' + str(len(stored)), state='queued', idempotencyKey=key)
                        results.append(stored[key])
                    if len(requests) == 1:
                        self.send_response(503)  # Committed, acknowledgement lost.
                        self.send_header('Retry-After', '1')
                        self.end_headers()
                        return
                elif self.path.endswith('/batch-status'):
                    results = [dict(taskId=key, state='completed' if key == 't_test0' else 'failed', message='test') for key in body['taskIds']]
                else:
                    owner.assertTrue(self.path.endswith('/batch-results'))
                    results = [dict(taskId=key, state='completed', results={'runtime': .1}) for key in body['taskIds']]
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'data': {'tasks': results}}).encode())

        server = HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            path = Path(__file__).resolve().parents[1] / 'src/content/examples/batch.py'
            spec = importlib.util.spec_from_file_location('batch_example', path)
            example = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(example)
            with tempfile.TemporaryDirectory() as temp, patch.object(example.time, 'sleep'):
                example.API_KEY = 'example-test-key'
                example.BASE_URL = f'http://127.0.0.1:{server.server_port}/api/v1'
                example.JOB_FILE = Path(temp) / 'job.json'
                example.OUTPUT_DIR = Path(temp) / 'results'
                if payloads is not None:
                    example.TASK_PAYLOADS = payloads
                expected_count = len(example.TASK_PAYLOADS)
                example.main()
                self.assertEqual(requests[0], requests[1])
                self.assertEqual(len(stored), expected_count)
                self.assertTrue(all(size <= 32 * 1024 * 1024 for size in submit_sizes))
                if payloads is not None:
                    self.assertGreater(submit_sizes[0], 4 * 1024 * 1024)
                    self.assertEqual(len(submit_sizes), 2)  # One request plus its identical retry.
                self.assertEqual(json.loads((example.OUTPUT_DIR / 't_test0.json').read_text())['results']['runtime'], .1)
                saved = example.JOB_FILE.read_text()
                self.assertNotIn(example.API_KEY, saved)
                saved_items = json.loads(saved)['items']
                self.assertEqual([item['terminal'] for item in saved_items], ['completed'] + ['failed'] * (expected_count - 1))
                submitted = [item for path, body in requests[1:] if path.endswith('/batch') for item in body['tasks']]
                self.assertEqual(submitted, [{key: item[key] for key in ('idempotencyKey', 'payload')} for item in saved_items])
                count = len(requests)
                example.main()
                self.assertEqual(len(requests), count)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_submission_chunks_honor_exact_byte_and_count_boundaries(self):
        path = Path(__file__).resolve().parents[1] / 'src/content/examples/batch.py'
        spec = importlib.util.spec_from_file_location('batch_example', path)
        example = importlib.util.module_from_spec(spec); spec.loader.exec_module(example)
        items = [{'idempotencyKey': str(i), 'payload': {**example.PAYLOAD, 'taskName': '\u6d4b\u8bd5"\\'}} for i in range(101)]
        self.assertEqual([len(group) for group in example.submission_chunks(items)], [100, 1])
        boundary = len(json.dumps({'tasks': items[:2]}, allow_nan=False).encode('utf-8'))
        with patch.object(example, 'SUBMIT_BYTES', boundary):
            self.assertEqual(list(example.submission_chunks(items[:2])), [items[:2]])
        with patch.object(example, 'SUBMIT_BYTES', boundary - 1):
            with self.assertRaisesRegex(ValueError, 'exceeds the 32 MiB'):
                list(example.submission_chunks(items[:2]))
        with patch.object(example, 'SUBMIT_BYTES', 1):
            with self.assertRaisesRegex(ValueError, 'exceeds the 32 MiB'):
                list(example.submission_chunks(items[:1]))

    def test_old_unconfirmed_manifest_refuses_to_resubmit(self):
        path = Path(__file__).resolve().parents[1] / 'src/content/examples/batch.py'
        spec = importlib.util.spec_from_file_location('batch_example', path)
        example = importlib.util.module_from_spec(spec); spec.loader.exec_module(example)
        with tempfile.TemporaryDirectory() as temp:
            example.API_KEY = 'example-test-key'
            example.JOB_FILE = Path(temp) / 'job.json'
            example.save_job({'baseUrl': example.BASE_URL, 'createdAt': 0,
                              'items': [{'idempotencyKey': 'old', 'payload': example.PAYLOAD}]})
            with patch.object(example, 'api_call') as send:
                with self.assertRaisesRegex(RuntimeError, 'deduplication window'):
                    example.main()
                send.assert_not_called()


if __name__ == '__main__':
    unittest.main()
