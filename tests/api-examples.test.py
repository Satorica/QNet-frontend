"""Run all downloadable scripts against a local HTTP service, without packages."""
import importlib.util
import io
import json
import os
import tempfile
import threading
import unittest
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest.mock import patch


class ApiExampleTests(unittest.TestCase):
    def setUp(self):
        owner = self
        self.posts = []
        self.mode = 'completed'
        self.polls = 0

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                pass

            def send_data(self, value, status=200):
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(value).encode())

            def do_POST(self):
                data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                owner.posts.append((self.path, data, self.headers.get('Idempotency-Key'), self.headers.get('Authorization')))
                if len(owner.posts) == 1:
                    self.send_data({'error': {'code': 'RETRY', 'message': 'retry'}}, 503)
                else:
                    self.send_data({'data': {'taskId': 't_example'}})

            def do_GET(self):
                owner.polls += 1
                if self.path.endswith('/result'):
                    self.send_data({'data': {'results': {'candidates': [{'solution': [0, 1], 'value': -1}]}}})
                else:
                    self.send_data({'data': {'state': owner.mode, 'message': 'test'}})

        self.server = HTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def load(self, problem):
        path = Path(__file__).resolve().parents[1] / 'src/content/examples' / (problem + '.py')
        spec = importlib.util.spec_from_file_location('example_' + problem, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.API_KEY = 'test-secret'
        module.BASE_URL = f'http://127.0.0.1:{self.server.server_port}/api/v1'
        return module

    def test_five_scripts_run_with_direct_configuration_and_no_environment(self):
        with tempfile.TemporaryDirectory() as output:
            previous = Path.cwd()
            try:
                os.chdir(output)
                for problem in ('maxcut', 'number_partition', 'coloring', 'tsp', 'general'):
                    with self.subTest(problem=problem):
                        self.posts.clear()
                        module = self.load(problem)
                        with patch.dict(os.environ, {}, clear=True), patch.object(module.time, 'sleep'), redirect_stdout(io.StringIO()):
                            module.main()
                        self.assertEqual(len(self.posts), 2)
                        self.assertEqual(self.posts[0][2], self.posts[1][2])
                        self.assertEqual(self.posts[0][1]['problemType'], problem)
                        self.assertEqual(self.posts[0][3], 'Bearer test-secret')
                        self.assertIn('results', json.loads(Path('task-t_example.json').read_text(encoding='utf-8')))
            finally:
                os.chdir(previous)

    def test_wait_timeout_and_failure_do_not_resubmit(self):
        module = self.load('maxcut')
        self.mode = 'failed'
        with self.assertRaises(RuntimeError):
            module.wait_for_result('t_saved')
        self.assertEqual(len(self.posts), 0)

        self.mode = 'processing'
        module.WAIT_TIMEOUT = 0
        with self.assertRaisesRegex(TimeoutError, 't_saved'):
            module.wait_for_result('t_saved')
        self.assertEqual(len(self.posts), 0)

    def test_missing_key_fails_before_any_request(self):
        module = self.load('maxcut')
        module.API_KEY = 'YOUR_API_KEY'
        with self.assertRaisesRegex(ValueError, 'API_KEY'):
            module.main()
        self.assertEqual(self.posts, [])


if __name__ == '__main__':
    unittest.main()
