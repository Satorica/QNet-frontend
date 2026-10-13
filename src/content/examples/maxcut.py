"""Standalone QNet HTTP example; Python 3.9+, no third-party packages.
Replace API_KEY below with your key, then run this file.
"""
import json
import socket
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE_URL = "https://api.trisp.com.cn/api/v1"
API_KEY = "YOUR_API_KEY"  # Replace with your key. Do not commit it to a public repository.
WAIT_TIMEOUT = 600  # Seconds to wait; timeout does not cancel the task.
TASK_ID = None  # Set a saved task ID here to resume polling without submitting.
IDEMPOTENCY_KEY = None  # Set a saved key here to retry an interrupted submission.


def api_call(method, path, payload=None, idempotency_key=None):
    headers = {"Authorization": "Bearer " + API_KEY, "Content-Type": "application/json"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    body = json.dumps(payload, allow_nan=False).encode("utf-8") if payload is not None else None
    for attempt in range(6):
        retry_after = None
        try:
            req = Request(BASE_URL + path, data=body, headers=headers, method=method)
            with urlopen(req, timeout=30) as response:
                return json.load(response)["data"]
        except HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504):
                try:
                    error = json.load(exc)
                    message = error.get("error", {}).get("message", "Request failed")
                    code = error.get("error", {}).get("code", str(exc.code))
                    request_id = error.get("requestId", "")
                except (ValueError, AttributeError):
                    message, code, request_id = "Request failed", str(exc.code), ""
                raise RuntimeError(f"{code}: {message}; requestId={request_id}") from None
            try:
                retry_after = max(1.0, float(exc.headers.get("Retry-After", "0")))
            except (ValueError, TypeError):
                pass
        except (URLError, TimeoutError, socket.timeout, ConnectionError):
            pass
        if attempt == 5:
            raise RuntimeError("Retries exhausted. Reuse the SAME Idempotency-Key to retry submission.")
        time.sleep(min(60, retry_after if retry_after is not None else 2 ** attempt))
    raise RuntimeError("Request failed")


def wait_for_result(task_id):
    deadline = time.monotonic() + WAIT_TIMEOUT
    while time.monotonic() < deadline:
        task = api_call("GET", "/tasks/" + task_id)
        print("State:", task["state"], flush=True)
        if task["state"] == "completed":
            return api_call("GET", "/tasks/" + task_id + "/result")
        if task["state"] in ("failed", "cancelled"):
            raise RuntimeError(f"Task {task_id}: {task['state']}; {task.get('message', '')}")
        time.sleep(2)
    raise TimeoutError(f"Stopped waiting. Task {task_id} may still be running; query this ID, do not resubmit.")


PAYLOAD = {'problemType': 'maxcut', 'modelType': 'classic', 'methodType': 'sa', 'matrixSize': 2, 'adjacencyMatrix': [[0, 1], [1, 0]]}

def main():
    if not API_KEY or API_KEY == "YOUR_API_KEY":
        raise ValueError("Replace API_KEY at the top of this file with your API Key.")
    task_id = TASK_ID
    if not task_id:
        # Save this key before the request; reuse it after any ambiguous failure.
        idem_key = IDEMPOTENCY_KEY or str(uuid.uuid4())
        print("Idempotency-Key:", idem_key, flush=True)
        task = api_call("POST", "/tasks", PAYLOAD, idempotency_key=idem_key)
        task_id = task["taskId"]
        print("Task ID:", task_id, flush=True)
    result = wait_for_result(task_id)
    output = Path("task-" + task_id + ".json")
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Result saved:", output.resolve())


if __name__ == "__main__":
    main()
