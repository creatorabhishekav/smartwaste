"""Dump the exact JSON shape of the remaining endpoints so the TS types match."""
from __future__ import annotations

import json
import urllib.request

BASE = "http://127.0.0.1:8000"


def call(path: str, token: str | None = None, method: str = "GET", payload: dict | None = None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data=data, timeout=15) as resp:
        return json.loads(resp.read())


def shape(obj, depth=0):
    """Compact structural signature: keys -> types."""
    if depth > 3:
        return "..."
    if isinstance(obj, dict):
        return {k: shape(v, depth + 1) for k, v in obj.items()}
    if isinstance(obj, list):
        return [shape(obj[0], depth + 1)] if obj else []
    return type(obj).__name__


admin = call("/auth/demo-login", method="POST", payload={"role": "ADMIN"})["access_token"]
citizen = call("/auth/demo-login", method="POST", payload={"role": "CITIZEN"})["access_token"]
worker = call("/auth/demo-login", method="POST", payload={"role": "WORKER"})["access_token"]

targets = [
    ("/analytics", admin, "GET"),
    ("/admin/overview", admin, "GET"),
    ("/analytics/dashboard", citizen, "GET"),
    ("/analytics/dashboard", admin, "GET"),
    ("/workers/me/dashboard", worker, "GET"),
    ("/hotspots", None, "GET"),
    ("/notifications", citizen, "GET"),
    ("/awareness", citizen, "GET"),
    ("/uploads/config", citizen, "GET"),
    ("/pickup-requests/summary/overview", admin, "GET"),
    ("/awareness/ask", citizen, "POST"),
]

for path, token, method in targets:
    payload = {"question": "Where do I put a broken phone?"} if path == "/awareness/ask" else None
    try:
        body = shape(call(path, token, method, payload))
        print(f"=== {path} ({method}) ===")
        print(json.dumps(body, indent=1, default=str))
    except Exception as exc:  # noqa: BLE001
        print(f"=== {path} FAILED: {exc}")
