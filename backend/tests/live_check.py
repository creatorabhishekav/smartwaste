"""Live HTTP verification against a running uvicorn server.

Usage:
    python tests/live_check.py [base_url]
    Default base_url: http://127.0.0.1:8000
"""
from __future__ import annotations

import io
import struct
import sys
import zlib

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
OK, BAD = [], []


def check(name: str, cond: bool, detail: str = "") -> None:
    (OK if cond else BAD).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + ("" if cond else f" -> {detail}"))


def png(color=(40, 150, 100), size=64) -> bytes:
    raw = b"".join(b"\x00" + bytes(color) * size for _ in range(size))

    def chunk(tag, data):
        p = tag + data
        return struct.pack(">I", len(data)) + p + struct.pack(">I", zlib.crc32(p))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )


def main() -> int:
    c = httpx.Client(base_url=BASE, timeout=30.0)
    print(f"\n### Live verification against {BASE}")

    print("\n-- system --")
    h = c.get("/health")
    check("GET /health", h.status_code == 200, h.text[:160])
    print(f"      {h.json()}")
    r = c.get("/")
    check("GET /", r.status_code == 200 and r.json()["status"] == "running", r.text[:160])
    check("GET /docs", c.get("/docs").status_code == 200)
    check("GET /openapi.json", c.get("/openapi.json").status_code == 200)
    check("GET /media/ serves uploads", c.get("/media/").status_code in (200, 404))

    print("\n-- auth --")
    def login_as(role):
        resp = c.post("/auth/demo-login", json={"role": role})
        assert resp.status_code == 200, resp.text
        return resp.json()["access_token"]

    tokens = {role: login_as(role) for role in ("CITIZEN", "WORKER", "ADMIN")}
    H = {k: {"Authorization": f"Bearer {v}"} for k, v in tokens.items()}
    check("demo-login works for all 3 roles", len(tokens) == 3)
    lj = c.post("/auth/login", json={"email": "citizen@demo.com", "password": "demo123"})
    check("password login citizen@demo.com/demo123", lj.status_code == 200, lj.text[:160])
    lj2 = c.post("/auth/login", json={"email": "worker@demo.com", "password": "demo123"})
    check("password login worker@demo.com/demo123", lj2.status_code == 200, lj2.text[:160])
    lj3 = c.post("/auth/login", json={"email": "admin@demo.com", "password": "demo123"})
    check("password login admin@demo.com/demo123", lj3.status_code == 200, lj3.text[:160])
    check("bad password -> 401", c.post("/auth/login", json={"email": "admin@demo.com", "password": "nope"}).status_code == 401)
    check("no token -> 401", c.get("/complaints").status_code == 401)

    print("\n-- complaints --")
    cl = c.get("/complaints", headers=H["ADMIN"], params={"page_size": 5})
    check("admin lists complaints", cl.status_code == 200 and cl.json()["total"] > 0, cl.text[:160])
    check("no token cannot list", c.get("/complaints").status_code == 401)
    new = c.post(
        "/complaints",
        headers=H["CITIZEN"],
        files={"image": ("live.png", png(), "image/png")},
        data={
            "category": "OVERFLOWING_BIN",
            "description": "Bin overflowing near the hospital gate, live check.",
            "address": "88 Barauna Main Road, Kanpur",
            "latitude": "26.4302",
            "longitude": "80.3121",
            "ward": "Barauna",
        },
    )
    check("citizen creates complaint with image", new.status_code == 201, new.text[:200])
    cid = new.json()["complaint"]["complaint_id"]
    comp = new.json()["complaint"]
    check("AI severity present", comp["severity"] > 0, str(comp["severity"]))
    check("priority explained", comp["priority_level"] in {"LOW","MEDIUM","HIGH","CRITICAL"} and comp["priority_reasons"], str(comp["priority_level"]))
    print(f"      {cid} | severity {comp['severity']} | priority {comp['priority_score']} ({comp['priority_level']}) | {comp['waste_type']}")
    check("citizen can read own complaint", c.get(f"/complaints/{cid}", headers=H["CITIZEN"]).status_code == 200)
    check("admin can read any complaint", c.get(f"/complaints/{cid}", headers=H["ADMIN"]).status_code == 200)
    check("other citizen blocked (403)", c.get(f"/complaints/{cid}", headers=H["WORKER"]).status_code == 403)
    check("image bytes served", c.get(comp["image_url"]).status_code == 200)
    ana = c.post(f"/complaints/{cid}/analyze", headers=H["ADMIN"])
    check("re-analyze endpoint", ana.status_code == 200, ana.text[:160])
    prev = c.post(
        "/complaints/preview-analysis",
        headers=H["CITIZEN"],
        files={"image": ("p.png", png((10, 90, 60)), "image/png")},
        data={"category": "ILLEGAL_DUMPING", "description": "dumped debris", "address": "near railway station", "latitude": "26.43", "longitude": "80.31"},
    )
    check("preview-analysis", prev.status_code == 200 and prev.json()["priority"]["score"] > 0, prev.text[:160])

    print("\n-- admin --")
    ov = c.get("/admin/overview", headers=H["ADMIN"])
    check("admin/overview", ov.status_code == 200, ov.text[:160])
    o = ov.json()
    print(f"      total={o['total_complaints']} pending={o['pending_complaints']} critical={o['critical_complaints']} resolved={o['resolved_complaints']} avg_response={o['avg_response_minutes']}m workers={o['active_workers']}")
    pq = c.get("/admin/priority-queue", headers=H["ADMIN"])
    check("admin/priority-queue", pq.status_code == 200 and len(pq.json()) > 0)
    du = c.get("/admin/duplicates", headers=H["ADMIN"])
    check("admin/duplicates", du.status_code == 200 and du.json()["count"] > 0, str(du.json().get("count")))
    check("admin/system", c.get("/admin/system", headers=H["ADMIN"]).status_code == 200)
    check("admin/users", c.get("/admin/users", headers=H["ADMIN"]).status_code == 200)
    rc = c.post("/admin/recompute", headers=H["ADMIN"])
    check("admin/recompute hotspots", rc.status_code == 200, rc.text[:160])
    check("citizen blocked from admin", c.get("/admin/overview", headers=H["CITIZEN"]).status_code == 403)

    print("\n-- workers + task flow --")
    wl = c.get("/workers", headers=H["ADMIN"])
    check("workers list", wl.status_code == 200 and len(wl.json()) >= 5, str(len(wl.json()) if wl.status_code==200 else wl.text[:120]))
    sg = c.get(f"/complaints/{cid}/suggest-workers", headers=H["ADMIN"])
    check("suggest-workers", sg.status_code == 200 and len(sg.json()["suggestions"]) > 0)
    demo_worker = [w for w in wl.json() if w["email"] == "worker@demo.com"][0]
    asg = c.post(f"/complaints/{cid}/assign", headers=H["ADMIN"], json={"worker_id": demo_worker["id"]})
    check("admin assigns worker", asg.status_code == 200, asg.text[:200])
    check("status now ASSIGNED", asg.json()["complaint"]["status"] == "ASSIGNED", asg.json()["complaint"]["status"])
    for st in ("ON_THE_WAY", "ARRIVED", "COLLECTED"):
        s = c.post(f"/complaints/{cid}/status", headers=H["WORKER"], json={"status": st})
        check(f"worker -> {st}", s.status_code == 200 and s.json()["complaint"]["status"] == st, s.text[:160])
    wd = c.get("/workers/me/dashboard", headers=H["WORKER"])
    check("worker dashboard", wd.status_code == 200 and wd.json()["summary"]["today_tasks"] > 0, wd.text[:160])
    print(f"      worker tasks: {wd.json()['summary']}")
    pf = c.post(
        f"/complaints/{cid}/proof",
        headers=H["WORKER"],
        files={"before_image": ("b.png", png((140, 80, 40)), "image/png"), "after_image": ("a.png", png((20, 170, 110)), "image/png")},
        data={"note": "cleared"},
    )
    check("before/after proof upload", pf.status_code == 200, pf.text[:200])
    v = pf.json()["verification"]
    print(f"      verification: {v['before_score']} -> {v['after_score']} ({v['status']})")
    check("verification scores", v.get("after_score", 0) > v.get("before_score", 0), str(v))
    check("complaint resolved", pf.json()["complaint"]["status"] in {"RESOLVED", "VERIFIED"}, pf.json()["complaint"]["status"])

    print("\n-- pickups --")
    pk = c.post(
        "/pickup-requests",
        headers=H["CITIZEN"],
        files={"photo": ("p.png", png(), "image/png")},
        data={"waste_type": "Bulk Garden Waste", "quantity": "40", "unit": "kg", "address": "9 Live Road, Kanpur", "latitude": "26.43", "longitude": "80.31", "preferred_date": "2026-10-05", "preferred_time": "08:00 - 10:00"},
    )
    check("create pickup", pk.status_code == 201, pk.text[:200])
    pid = pk.json()["pickup"]["pickup_id"]
    check("admin lists pickups", c.get("/pickup-requests", headers=H["ADMIN"]).status_code == 200)
    pa = c.post(f"/pickup-requests/{pid}/assign", headers=H["ADMIN"], data={"worker_id": str(demo_worker["id"])})
    check("assign pickup", pa.status_code == 200, pa.text[:160])
    for st in ("ON_THE_WAY", "COLLECTED", "COMPLETED"):
        s = c.post(f"/pickup-requests/{pid}/status", headers=H["WORKER"], json={"status": st})
        check(f"pickup -> {st}", s.status_code == 200, s.text[:160])
    gs = c.get("/workers/me", headers=H["WORKER"])
    check("worker sets availability", c.patch(f"/workers/{demo_worker['id']}", headers=H["WORKER"], json={"status": "AVAILABLE"}).status_code == 200)
    check("citizen cannot patch worker", c.patch(f"/workers/{demo_worker['id']}", headers=H["CITIZEN"], json={"status": "OFFLINE"}).status_code == 403)

    print("\n-- analytics / hotspots / awareness / notifications / uploads --")
    an = c.get("/analytics", headers=H["ADMIN"])
    check("GET /analytics", an.status_code == 200, an.text[:160])
    a = an.json()
    check("analytics non-empty sections", all([a["trend"], a["category_distribution"], a["ward_comparison"], a["worker_performance"], a["hotspots"]]), "empty section")
    print(f"      trend points={len(a['trend'])} categories={len(a['category_distribution'])} wards={len(a['ward_comparison'])} workers={len(a['worker_performance'])} hotspots={len(a['hotspots'])}")
    check("public /analytics/impact", c.get("/analytics/impact").status_code == 200)
    check("citizen dashboard payload", c.get("/analytics/dashboard", headers=H["CITIZEN"]).status_code == 200)
    hs = c.get("/hotspots", params={"refresh": "true"})
    check("GET /hotspots", hs.status_code == 200 and len(hs.json()) > 0, str(len(hs.json()) if hs.status_code==200 else hs.text[:120]))
    check("map markers", c.get("/hotspots/complaints", headers=H["ADMIN"]).status_code == 200)
    aw = c.get("/awareness", headers=H["CITIZEN"])
    check("awareness content", aw.status_code == 200 and len(aw.json()) >= 7, str(len(aw.json())))
    ak = c.post("/awareness/ask", headers=H["CITIZEN"], json={"question": "Where should I dispose of a used battery?"})
    check("Ask Waste AI", ak.status_code == 200 and ak.json()["answer"], ak.text[:160])
    print(f"      AI: {ak.json()['answer'][:150]}")
    nt = c.get("/notifications", headers=H["CITIZEN"])
    check("notifications inbox", nt.status_code == 200 and nt.json()["items"], nt.text[:160])
    if nt.json()["items"]:
        nid = nt.json()["items"][0]["id"]
        check("mark read", c.post(f"/notifications/{nid}/read", headers=H["CITIZEN"]).status_code == 200)
    check("mark all read", c.post("/notifications/read-all", headers=H["CITIZEN"]).status_code == 200)
    check("uploads config", c.get("/uploads/config", headers=H["CITIZEN"]).status_code == 200)
    up = c.post("/uploads/image", headers=H["CITIZEN"], data={"folder": "complaints"}, files={"file": ("u.png", png(), "image/png")})
    check("direct upload", up.status_code == 200, up.text[:160])
    bad = c.post("/uploads/image", headers=H["CITIZEN"], data={"folder": "complaints"}, files={"file": ("x.txt", b"plain text not an image", "text/plain")})
    check("text file rejected (422)", bad.status_code == 422, str(bad.status_code))
    check("no auth upload -> 401", c.post("/uploads/image", data={"folder": "complaints"}, files={"file": ("u.png", png(), "image/png")}).status_code == 401)

    print("\n" + "=" * 60)
    print(f"LIVE PASSED: {len(OK)}  FAILED: {len(BAD)}")
    for item in BAD:
        print(f"  - {item}")
    return 1 if BAD else 0


if __name__ == "__main__":
    sys.exit(main())
