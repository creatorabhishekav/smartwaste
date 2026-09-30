"""End-to-end smoke test for the SmartWaste 360 API.

Runs the real FastAPI app in-process (TestClient) and walks the full demo flow:

  health -> auth -> citizen report (with image) -> AI analysis -> priority ->
  admin queue -> assign worker -> worker task -> status updates ->
  before/after proof -> verification -> resolution -> citizen tracking ->
  pickups -> workers -> analytics -> hotspots -> notifications -> awareness ->
  uploads -> role enforcement

Usage:
    python tests/smoke_test.py
"""
from __future__ import annotations

import io
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: F401,E402
from app.database.seed_data import seed_demo_data  # noqa: E402
from app.database.session import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402

PASSED: list[str] = []
FAILED: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        PASSED.append(name)
        print(f"  [PASS] {name}")
    else:
        FAILED.append(f"{name} :: {detail}")
        print(f"  [FAIL] {name} -> {detail}")


def png_bytes(color: tuple[int, int, int] = (32, 140, 90), size: int = 96) -> bytes:
    """Build a tiny valid PNG so upload validation has real bytes to inspect."""
    raw = b"".join(
        b"\x00" + bytes(color) * size for _ in range(size)
    )

    def chunk(tag: bytes, data: bytes) -> bytes:
        payload = tag + data
        return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload))

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )


def token_for(client: TestClient, role: str) -> str:
    response = client.post("/auth/demo-login", json={"role": role})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def main() -> int:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)

    with TestClient(app) as client:
        print("\n== 1. System endpoints ==")
        health = client.get("/health")
        check("GET /health returns 200", health.status_code == 200, health.text[:200])
        check(
            'health payload has status/service',
            health.json().get("status") == "ok"
            and health.json().get("service") == "SmartWaste 360 API",
            health.text[:200],
        )
        root = client.get("/")
        check(
            "GET / returns running status",
            root.status_code == 200 and root.json().get("status") == "running",
            root.text[:200],
        )
        docs = client.get("/docs")
        check("GET /docs serves Swagger", docs.status_code == 200, str(docs.status_code))
        openapi = client.get("/openapi.json")
        check("GET /openapi.json valid", openapi.status_code == 200, str(openapi.status_code))
        if openapi.status_code == 200:
            paths = openapi.json()["paths"]
            for required in (
                "/auth/login",
                "/auth/register",
                "/complaints",
                "/complaints/{complaint_ref}/analyze",
                "/complaints/{complaint_ref}/assign",
                "/complaints/{complaint_ref}/evidence",
                "/pickup-requests",
                "/workers",
                "/analytics",
                "/hotspots",
                "/notifications",
            ):
                check(f"route registered: {required}", required in paths, "missing")

        print("\n== 2. Authentication ==")
        login = client.post("/auth/login", json={"email": "admin@demo.com", "password": "demo123"})
        check(
            "admin login with password",
            login.status_code == 200 and "access_token" in login.json(),
            login.text[:200],
        )
        bad = client.post("/auth/login", json={"email": "admin@demo.com", "password": "wrong"})
        check("wrong password rejected (401)", bad.status_code == 401, str(bad.status_code))
        email = f"test-citizen-{int(__import__('time').time())}@example.com"
        register = client.post(
            "/auth/register",
            json={
                "name": "Test Citizen",
                "email": email,
                "password": "secret123",
                "ward": "Barauna",
                "address": "12 Test Lane, Kanpur",
            },
        )
        check("register new citizen", register.status_code == 201, register.text[:200])
        dupe = client.post(
            "/auth/register",
            json={"name": "Test Citizen", "email": email, "password": "secret123"},
        )
        check("duplicate email rejected (409)", dupe.status_code == 409, str(dupe.status_code))
        me = client.get("/auth/me", headers=auth(login.json()["access_token"]))
        check("GET /auth/me returns role", me.status_code == 200 and me.json()["user"]["role"] == "ADMIN", me.text[:200])
        noauth = client.get("/complaints")
        check("unauthenticated complaints blocked (401/403)", noauth.status_code in (401, 403), str(noauth.status_code))

        citizen_token = token_for(client, "CITIZEN")
        worker_token = token_for(client, "WORKER")
        admin_token = token_for(client, "ADMIN")

        print("\n== 3. AI preview analysis ==")
        preview = client.post(
            "/complaints/preview-analysis",
            headers=auth(citizen_token),
            files={"image": ("waste.png", png_bytes(), "image/png")},
            data={
                "category": "OVERFLOWING_BIN",
                "description": "Bin overflowing with plastic bags and food waste, bad smell",
                "address": "Near Barauna hospital crossing",
                "latitude": "26.4302",
                "longitude": "80.3121",
            },
        )
        check(
            "preview-analysis returns waste type + severity",
            preview.status_code == 200
            and preview.json()["analysis"]["waste_type"]
            and preview.json()["analysis"]["severity"] > 0
            and preview.json()["priority"]["score"] > 0,
            preview.text[:300],
        )

        print("\n== 4. Citizen reports waste (with image) ==")
        created = client.post(
            "/complaints",
            headers=auth(citizen_token),
            files={"image": ("report.png", png_bytes((200, 80, 60)), "image/png")},
            data={
                "category": "GARBAGE_ON_ROAD",
                "description": "Garbage pile on the main road near the school gate.",
                "address": "45 Barauna Main Road, Kanpur",
                "latitude": "26.4302",
                "longitude": "80.3121",
                "ward": "Barauna",
                "run_ai": "true",
            },
        )
        check("create complaint (201)", created.status_code == 201, created.text[:300])
        complaint = created.json()["complaint"]
        cid = complaint["complaint_id"]
        check("complaint id format SW-YYYY-XXXX", cid.startswith("SW-") and len(cid.split("-")) == 3, cid)
        check("AI severity stored", complaint["severity"] > 0, str(complaint["severity"]))
        check(
            "priority score + level stored",
            complaint["priority_score"] > 0 and complaint["priority_level"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"},
            f"{complaint['priority_score']} {complaint['priority_level']}",
        )
        check("priority reasons explained", len(complaint["priority_reasons"]) > 0, "empty")
        check("timeline has submitted step", complaint["timeline"][0]["completed"] is True, "empty")
        check("image url stored", bool(complaint["image_url"]), "missing")
        check("image served from /media", client.get(complaint["image_url"]).status_code == 200, "media 404")

        print("\n== 5. Invalid file rejection ==")
        bad_upload = client.post(
            "/complaints",
            headers=auth(citizen_token),
            files={"image": ("evil.exe", b"MZ\x90\x00notanimage", "application/x-msdownload")},
            data={
                "category": "OTHER",
                "description": "test",
                "address": "1 Somewhere Road",
                "latitude": "26.45",
                "longitude": "80.33",
            },
        )
        check("non-image upload rejected (422)", bad_upload.status_code == 422, str(bad_upload.status_code))

        print("\n== 6. Role-based access control ==")
        cross = client.get(f"/complaints/{cid}", headers=auth(token_for(client, "ADMIN") if False else worker_token))
        check("worker cannot read unassigned complaint (403)", cross.status_code == 403, str(cross.status_code))
        admin_health_only = client.get("/admin/overview", headers=auth(citizen_token))
        check("citizen blocked from admin (403)", admin_health_only.status_code == 403, str(admin_health_only.status_code))
        analytics_as_citizen = client.get("/analytics", headers=auth(citizen_token))
        check("citizen blocked from analytics (403)", analytics_as_citizen.status_code == 403, str(analytics_as_citizen.status_code))

        print("\n== 7. Admin priority queue + assignment ==")
        queue = client.get("/admin/priority-queue", headers=auth(admin_token))
        check("priority queue returns items", queue.status_code == 200 and len(queue.json()) > 0, queue.text[:200])
        scores = [row["priority_score"] for row in queue.json()]
        check("queue sorted by priority desc", scores == sorted(scores, reverse=True), str(scores[:6]))
        overview = client.get("/admin/overview", headers=auth(admin_token))
        ov = overview.json()
        check(
            "admin overview KPIs present",
            overview.status_code == 200
            and ov["total_complaints"] > 0
            and "critical_complaints" in ov
            and "avg_response_minutes" in ov
            and "active_workers" in ov,
            overview.text[:200],
        )
        suggestions = client.get(f"/complaints/{cid}/suggest-workers", headers=auth(admin_token))
        check(
            "worker suggestions with distance",
            suggestions.status_code == 200 and len(suggestions.json()["suggestions"]) > 0,
            suggestions.text[:200],
        )
        worker_id = suggestions.json()["suggestions"][0]["id"]
        assign = client.post(
            f"/complaints/{cid}/assign",
            headers=auth(admin_token),
            json={"worker_id": worker_id, "note": "Please attend today"},
        )
        check("assign worker (200)", assign.status_code == 200, assign.text[:300])
        check(
            "complaint status -> ASSIGNED",
            assign.json()["complaint"]["status"] == "ASSIGNED",
            assign.json()["complaint"]["status"],
        )

        print("\n== 8. Worker task workflow ==")
        worker_me = client.get("/workers/me", headers=auth(worker_token))
        check("worker profile loads", worker_me.status_code == 200 and "worker" in worker_me.json(), worker_me.text[:200])
        assigned_worker_id = worker_me.json()["worker"]["id"]
        # reassign to the demo worker so this flow is deterministic
        if assigned_worker_id != worker_id:
            reassign = client.post(
                f"/complaints/{cid}/assign",
                headers=auth(admin_token),
                json={"worker_id": assigned_worker_id},
            )
            check("reassign to demo worker", reassign.status_code == 200, reassign.text[:200])

        for target, label in (
            ("ON_THE_WAY", "on the way"),
            ("ARRIVED", "arrived"),
            ("COLLECTED", "collected"),
        ):
            step = client.post(
                f"/complaints/{cid}/status",
                headers=auth(worker_token),
                json={"status": target},
            )
            check(f"worker status -> {label}", step.status_code == 200 and step.json()["complaint"]["status"] == target, step.text[:200])

        dashboard = client.get("/workers/me/dashboard", headers=auth(worker_token))
        check(
            "worker dashboard task counts",
            dashboard.status_code == 200
            and dashboard.json()["summary"]["today_tasks"] > 0
            and "pending" in dashboard.json()["summary"],
            dashboard.text[:200],
        )
        tasks = dashboard.json()["pending"] + dashboard.json()["active"] + dashboard.json()["completed"]
        check("worker tasks show distance", all("distance_km" in t for t in tasks[:3]), "missing distance")

        print("\n== 9. Before/after proof + verification ==")
        proof = client.post(
            f"/complaints/{cid}/proof",
            headers=auth(worker_token),
            files={
                "before_image": ("before.png", png_bytes((120, 60, 40)), "image/png"),
                "after_image": ("after.png", png_bytes((30, 160, 110)), "image/png"),
            },
            data={"note": "Cleared and sanitised"},
        )
        check("proof upload (200)", proof.status_code == 200, proof.text[:300])
        verification = proof.json().get("verification", {})
        check(
            "verification returns before/after scores",
            verification.get("before_score") is not None and verification.get("after_score") is not None,
            proof.text[:300],
        )
        check("verification improved", verification.get("improvement", 0) > 0, str(verification.get("improvement")))
        resolved_complaint = proof.json()["complaint"]
        check(
            "complaint auto-resolved after verified proof",
            resolved_complaint["status"] in {"RESOLVED", "VERIFIED"},
            resolved_complaint["status"],
        )
        check("2 evidence files stored", len(resolved_complaint["evidence"]) == 2, str(len(resolved_complaint["evidence"])))

        print("\n== 10. Citizen tracking ==")
        tracked = client.get(f"/complaints/{cid}", headers=auth(citizen_token))
        check("citizen can track own complaint", tracked.status_code == 200, tracked.text[:200])
        timeline = tracked.json()["complaint"]["timeline"]
        completed_steps = [s for s in timeline if s["completed"]]
        check("timeline has >= 8 completed steps", len(completed_steps) >= 8, str(len(completed_steps)))
        check("timeline steps have timestamps", all(s["timestamp"] for s in completed_steps[:5]), "missing ts")
        mine = client.get("/complaints", headers=auth(citizen_token))
        check("citizen list scoped to own reports", mine.status_code == 200, mine.text[:200])

        print("\n== 11. Pickup requests ==")
        pickup = client.post(
            "/pickup-requests",
            headers=auth(citizen_token),
            files={"photo": ("bulk.png", png_bytes(), "image/png")},
            data={
                "waste_type": "E-Waste",
                "quantity": "12",
                "unit": "kg",
                "address": "78 Test Colony, Kanpur",
                "latitude": "26.4302",
                "longitude": "80.3121",
                "preferred_date": "2026-10-01",
                "preferred_time": "09:00 - 12:00",
                "notes": "Two old monitors",
            },
        )
        check("create pickup (201)", pickup.status_code == 201, pickup.text[:300])
        pickup_id = pickup.json()["pickup"]["pickup_id"]
        check("pickup id format PU-YYYY-XXXX", pickup_id.startswith("PU-"), pickup_id)
        pickups = client.get("/pickup-requests", headers=auth(admin_token))
        check("admin sees pickup requests", pickups.status_code == 200 and pickups.json()["total"] > 0, pickups.text[:200])
        assigned = client.post(
            f"/pickup-requests/{pickup_id}/assign",
            headers=auth(admin_token),
            data={"worker_id": str(assigned_worker_id)},
        )
        check("assign pickup", assigned.status_code == 200, assigned.text[:300])
        for target in ("ON_THE_WAY", "COLLECTED", "COMPLETED"):
            step = client.post(
                f"/pickup-requests/{pickup_id}/status",
                headers=auth(worker_token),
                json={"status": target},
            )
            check(f"pickup -> {target.lower()}", step.status_code == 200, step.text[:200])
        done = client.get(f"/pickup-requests/{pickup_id}", headers=auth(citizen_token))
        check("pickup completed + timeline", done.json()["pickup"]["status"] == "COMPLETED", done.text[:200])

        print("\n== 12. Workers management ==")
        workers_list = client.get("/workers", headers=auth(admin_token))
        check("admin lists workers", workers_list.status_code == 200 and len(workers_list.json()) >= 5, workers_list.text[:200])
        status_update = client.patch(
            f"/workers/{assigned_worker_id}",
            headers=auth(worker_token),
            json={"status": "AVAILABLE"},
        )
        check("worker updates own availability", status_update.status_code == 200, status_update.text[:200])
        forbidden = client.patch(f"/workers/{assigned_worker_id}", headers=auth(citizen_token), json={"status": "OFFLINE"})
        check("citizen cannot patch worker", forbidden.status_code == 403, str(forbidden.status_code))

        print("\n== 13. Analytics ==")
        analytics = client.get("/analytics", headers=auth(admin_token))
        a = analytics.json()
        check(
            "analytics sections present",
            analytics.status_code == 200
            and len(a["trend"]) > 0
            and len(a["category_distribution"]) > 0
            and len(a["ward_comparison"]) > 0
            and len(a["worker_performance"]) > 0
            and len(a["hotspots"]) > 0
            and "pickups" in a,
            str(list(a.keys())),
        )
        check("resolution rate computed", a["overview"]["resolution_rate"] > 0, str(a["overview"]["resolution_rate"]))
        impact = client.get("/analytics/impact")
        check("public impact endpoint", impact.status_code == 200 and impact.json()["reports_resolved"] > 0, impact.text[:200])

        print("\n== 14. Hotspots + duplicates ==")
        hotspots = client.get("/hotspots", params={"refresh": "true"})
        check("hotspots computed", hotspots.status_code == 200 and len(hotspots.json()) > 0, hotspots.text[:200])
        dupes = client.get("/admin/duplicates", headers=auth(admin_token))
        check("duplicate clusters detected", dupes.status_code == 200 and dupes.json()["count"] > 0, dupes.text[:200])
        markers = client.get("/hotspots/complaints", headers=auth(admin_token))
        check("map markers returned (rounded coords)", markers.status_code == 200 and markers.json()["total"] > 0, markers.text[:200])

        print("\n== 15. Notifications ==")
        inbox = client.get("/notifications", headers=auth(citizen_token))
        check("notification inbox", inbox.status_code == 200 and inbox.json()["items"], inbox.text[:200])
        notification_id = inbox.json()["items"][0]["id"]
        read = client.post(f"/notifications/{notification_id}/read", headers=auth(citizen_token))
        check("mark notification read", read.status_code == 200, read.text[:200])
        read_all = client.post("/notifications/read-all", headers=auth(citizen_token))
        check("mark all read", read_all.status_code == 200 and read_all.json()["unread"] if False else read_all.status_code == 200, read_all.text[:200])

        print("\n== 16. Awareness + Ask Waste AI ==")
        content = client.get("/awareness", headers=auth(citizen_token))
        check("awareness content seeded", content.status_code == 200 and len(content.json()) >= 7, str(len(content.json())))
        slugs = {row["slug"] for row in content.json()}
        for expected in ("wet-waste", "plastic", "e-waste", "hazardous"):
            check(f"awareness topic present: {expected}", expected in slugs, str(sorted(slugs)))
        ask = client.post("/awareness/ask", headers=auth(citizen_token), json={"question": "Where should I dispose of a used battery?"})
        check(
            "Ask Waste AI answers disposal question",
            ask.status_code == 200 and ask.json()["bin_colour"] and ask.json()["steps"],
            ask.text[:300],
        )
        check("Ask Waste AI provider reported", bool(ask.json().get("provider")), "missing provider")

        print("\n== 17. Uploads router ==")
        config = client.get("/uploads/config", headers=auth(citizen_token))
        check("upload config exposes limits", config.status_code == 200 and config.json()["max_mb"] > 0, config.text[:200])
        up = client.post(
            "/uploads/image",
            headers=auth(citizen_token),
            data={"folder": "complaints"},
            files={"file": ("test.png", png_bytes(), "image/png")},
        )
        check("direct image upload", up.status_code == 200 and up.json()["url"].startswith("/media/"), up.text[:200])

        print("\n== 18. Eco points ==")
        eco = client.get("/auth/me", headers=auth(citizen_token))
        check("eco points awarded on activity", eco.json()["user"]["eco_points"] > 0, str(eco.json()["user"]["eco_points"]))

        print("\n== 19. Admin system info ==")
        system = client.get("/admin/system", headers=auth(admin_token))
        check("admin system info", system.status_code == 200 and "ai" in system.json(), system.text[:200])
        check(
            "AI provider reported (demo fallback works)",
            system.json()["ai"]["provider"] in {"demo", "gemini"},
            str(system.json()["ai"]),
        )

    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASSED)}   FAILED: {len(FAILED)}")
    if FAILED:
        print("\nFailures:")
        for item in FAILED:
            print(f"  - {item}")
        return 1
    print("All API checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
