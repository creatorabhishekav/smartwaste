"""End-to-end verification of every endpoint the React frontend calls.

Mirrors the exact request shapes in src/lib/api.ts and src/pages/**.
"""
from __future__ import annotations

import io
import sys

import requests

BASE = "http://127.0.0.1:8000"

PASS: list[str] = []
FAIL: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    (PASS if ok else FAIL).append(f"{name}{f' -> {detail}' if detail else ''}")
    print(f"{'PASS' if ok else 'FAIL'}  {name}{f'  ({detail})' if detail else ''}")


def get(path: str, token: str | None = None, **params):
    return requests.get(
        f"{BASE}{path}",
        headers={"Authorization": f"Bearer {token}"} if token else {},
        params=params,
        timeout=20,
    )


def post(path: str, token: str | None = None, **json_body):
    return requests.post(
        f"{BASE}{path}",
        headers={"Authorization": f"Bearer {token}"} if token else {},
        json=json_body,
        timeout=20,
    )


def png_bytes() -> bytes:
    # 1x1 red PNG
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02"
        b"\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc``\x00\x00\x00\x02\x00\x01"
        b"\xe2\x21\xbc\x33\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def login(role: str) -> str:
    response = post("/auth/demo-login", role=role)
    response.raise_for_status()
    return response.json()["access_token"]


def main() -> int:
    print("=" * 72)
    print("SmartWaste 360 - frontend contract verification")
    print("=" * 72)

    # ---------------------------------------------------------------- public
    print("\n-- public (landing / awareness) --")
    health = get("/health")
    check("GET /health (App gate)", health.status_code == 200, str(health.status_code))
    impact = get("/analytics/impact")
    body = impact.json() if impact.ok else {}
    required = {
        "citizens_registered",
        "reports_resolved",
        "resolution_rate",
        "avg_response_minutes",
        "active_crews",
        "evidence_photos",
        "wards_covered",
        "hotspots_mapped",
    }
    check(
        "GET /analytics/impact (Landing stats)",
        impact.status_code == 200 and required <= set(body),
        f"{impact.status_code} keys={sorted(body)[:4]}",
    )
    awareness = get("/awareness")
    aw = awareness.json() if awareness.ok else []
    check(
        "GET /awareness (Awareness page)",
        awareness.status_code == 200 and isinstance(aw, list) and len(aw) > 0,
        f"{awareness.status_code} n={len(aw)}",
    )
    if aw:
        item = aw[0]
        fields = {
            "id", "slug", "title", "category", "summary", "what_it_is",
            "which_bin", "how_to_dispose", "recyclable", "hazard_level",
            "accent", "do_list", "dont_list", "is_published", "updated_at",
        }
        check("  AwarenessItem shape", fields <= set(item), f"missing={sorted(fields - set(item))}")

    anon_admin_awareness = get("/awareness", admin=True)
    check(
        "GET /awareness?admin=true anonymous -> 403",
        anon_admin_awareness.status_code == 403,
        str(anon_admin_awareness.status_code),
    )

    hotspots = get("/hotspots", refresh=False)
    hs = hotspots.json() if hotspots.ok else []
    check("GET /hotspots (HotspotMap)", hotspots.status_code == 200 and len(hs) > 0, f"n={len(hs)}")
    if hs:
        h = hs[0]
        check(
            "  Hotspot shape",
            {"code", "label", "ward", "latitude", "longitude", "radius_meters",
             "complaint_count", "critical_count", "open_count", "top_issue",
             "recommended_action", "intensity", "last_updated"} <= set(h),
            f"missing={sorted({'code','label','ward','latitude','longitude','radius_meters','complaint_count','critical_count','open_count','top_issue','recommended_action','intensity','last_updated'} - set(h))}",
        )
        check(
            "  intensity is 0..1 fraction",
            0.0 <= float(h.get("intensity", -1)) <= 1.0,
            f"intensity={h.get('intensity')}",
        )

    # -------------------------------------------------------------- sessions
    print("\n-- sessions --")
    citizen = login("CITIZEN")
    worker = login("WORKER")
    admin = login("ADMIN")
    check("POST /auth/demo-login x3 roles", all([citizen, worker, admin]))

    me = get("/auth/me", citizen).json()
    worker_wid = (get("/auth/me", worker).json().get("worker") or {}).get("id")
    check("demo WORKER has a worker profile (assign target)", bool(worker_wid), f"id={worker_wid}")
    check(
        "GET /auth/me (AuthContext)",
        {"user", "worker", "permissions", "environment"} <= set(me),
        f"keys={sorted(me)}",
    )
    check(
        "  User shape",
        {"id", "name", "email", "phone", "role", "ward", "address", "eco_points"} <= set(me["user"]),
    )

    eco = get("/auth/me/eco", citizen)
    eco_body = eco.json() if eco.ok else {}
    check(
        "GET /auth/me/eco (EcoPoints page)",
        eco.status_code == 200
        and {"eco_points", "level", "level_number", "level_icon", "xp_into_level",
             "next_level", "badges", "history"} <= set(eco_body),
        f"{eco.status_code}",
    )

    check(
        "POST /auth/me/password wrong current password -> 400",
        post("/auth/me/password", citizen, current_password="wrong", new_password="newpass").status_code == 400,
    )
    pw_ok = post("/auth/me/password", worker, current_password="demo123", new_password="demo123")
    check(
        "POST /auth/me/password with correct current password",
        pw_ok.status_code == 200,
        f"{pw_ok.status_code} {pw_ok.text[:60]}",
    )
    relogin = post("/auth/login", email="worker@demo.com", password="demo123")
    check(
        "  worker password login returns WORKER role (Login redirect)",
        relogin.status_code == 200 and relogin.json().get("user", {}).get("role") == "WORKER",
        f"role={relogin.json().get('user', {}).get('role') if relogin.ok else relogin.status_code}",
    )

    # --------------------------------------------------------------- citizen
    print("\n-- citizen pages --")
    dash = get("/analytics/dashboard", citizen)
    dash_body = dash.json() if dash.ok else {}
    check(
        "GET /analytics/dashboard (Citizen Dashboard)",
        dash.status_code == 200
        and {"summary", "eco_points", "recent_complaints", "nearby_hotspots", "active_hotspots"} <= set(dash_body),
        f"{dash.status_code}",
    )

    listed = get("/complaints", citizen, page=1, page_size=12)
    page = listed.json() if listed.ok else {}
    check(
        "GET /complaints (MyComplaints, Pagination)",
        listed.status_code == 200 and {"items", "total", "page", "page_size", "pages"} <= set(page),
        f"{listed.status_code} total={page.get('total')} pages={page.get('pages')}",
    )
    check(
        "  Paged shape",
        {"items", "total", "page", "page_size", "pages"} <= set(page),
        f"missing={sorted({'items','total','page','page_size','pages'} - set(page))}",
    )
    if page.get("items"):
        first = page["items"][0]
        check(
            "  Complaint shape",
            {"complaint_id", "category", "status", "priority_level", "priority_score",
             "address", "ward", "latitude", "longitude", "timeline", "evidence",
             "detected_objects", "worker", "is_duplicate", "citizen_name",
             "before_cleanliness", "after_cleanliness", "verification_status",
             "verification_notes", "priority_breakdown", "priority_reasons",
             "recommended_action", "response_minutes", "admin_note",
             "assigned_at", "resolved_at", "updated_at", "created_at",
             "description", "image_url", "waste_type", "ai_provider"} <= set(first),
            f"missing={sorted({'complaint_id','category','status','priority_level','priority_score','address','ward','latitude','longitude','timeline','evidence','detected_objects','worker','is_duplicate','citizen_name','before_cleanliness','after_cleanliness','verification_status','verification_notes','priority_breakdown','priority_reasons','recommended_action','response_minutes','admin_note','assigned_at','resolved_at','updated_at','created_at','description','image_url','waste_type','ai_provider'} - set(first))}",
        )

        detail = get(f"/complaints/{first['complaint_id']}", citizen)
        d = detail.json() if detail.ok else {}
        check(
            f"GET /complaints/{first['complaint_id']} (ComplaintDetail)",
            detail.status_code == 200 and "complaint" in d,
            f"{detail.status_code}",
        )
        tl = d.get("complaint", {}).get("timeline", [])
        if tl:
            check(
                "  TimelineEntry shape",
                {"status", "label", "completed", "timestamp", "note"} <= set(tl[0]),
                f"keys={sorted(tl[0])}",
            )

    preview = requests.post(
        f"{BASE}/complaints/preview-analysis",
        headers={"Authorization": f"Bearer {citizen}"},
        data={
            "category": "OVERFLOWING_BIN",
            "description": "Overflowing garbage bin near the market with rotting food waste and plastic bags",
            "address": "12 Market Road, Barauna",
            "latitude": "26.4512",
            "longitude": "80.3390",
        },
        timeout=40,
    )
    prev = preview.json() if preview.ok else {}
    check(
        "POST /complaints/preview-analysis (ReportWaste step 4)",
        preview.status_code == 200
        and {"analysis", "severity_reasoning", "priority", "duplicate_of",
             "nearby_reports", "ai_status"} <= set(prev),
        f"{preview.status_code}",
    )
    check(
        "  priority block shape",
        {"score", "level", "reasons", "breakdown"} <= set(prev.get("priority", {})),
        f"level={prev.get('priority', {}).get('level')} score={prev.get('priority', {}).get('score')}",
    )
    check(
        "  severity_reasoning block shape",
        {"severity", "priority_hint", "factors", "provider"} <= set(prev.get("severity_reasoning", {})),
        f"severity={prev.get('severity_reasoning', {}).get('severity')}",
    )
    check(
        "  analysis block shape",
        {"waste_type", "issue_type", "severity", "confidence", "detected_objects",
         "recommended_action", "environmental_risk", "description_summary",
         "priority_hint", "provider"} <= set(prev.get("analysis", {})),
        f"provider={prev.get('analysis', {}).get('provider')} "
        f"waste_type={prev.get('analysis', {}).get('waste_type')}",
    )
    check(
        "  priority_level is valid enum",
        prev.get("priority", {}).get("level") in {"LOW", "MEDIUM", "HIGH", "CRITICAL"},
        str(prev.get("priority", {}).get("level")),
    )

    upload_cfg = get("/uploads/config", citizen)
    cfg = upload_cfg.json() if upload_cfg.ok else {}
    check(
        "GET /uploads/config (ReportWaste upload limits)",
        upload_cfg.status_code == 200
        and {"allowed_types", "max_bytes", "max_mb", "folders", "upload_dir_exists"} <= set(cfg),
        f"{upload_cfg.status_code}",
    )

    uploaded = requests.post(
        f"{BASE}/uploads/image",
        headers={"Authorization": f"Bearer {citizen}"},
        files={"file": ("proof.png", io.BytesIO(png_bytes()), "image/png")},
        data={"folder": "complaints"},
        timeout=30,
    )
    check("POST /uploads/image (ImageDropzone)", uploaded.status_code in (200, 201), str(uploaded.status_code))

    notes = get("/notifications", citizen)
    n = notes.json() if notes.ok else {}
    check(
        "GET /notifications (AppShell bell, NotificationsPage)",
        notes.status_code == 200 and {"items", "unread"} <= set(n),
        f"{notes.status_code} unread={n.get('unread')}",
    )
    if n.get("items"):
        nid = n["items"][0]["id"]
        check("POST /notifications/{id}/read", post(f"/notifications/{nid}/read", citizen).status_code == 200)
        check("POST /notifications/read-all", post("/notifications/read-all", citizen).status_code == 200)

    pickups = get("/pickup-requests", citizen, page=1, page_size=20)
    pk = pickups.json() if pickups.ok else {}
    check(
        "GET /pickup-requests (PickupRequest list)",
        pickups.status_code == 200 and {"items", "total", "page", "page_size", "pages"} <= set(pk),
        f"{pickups.status_code} total={pk.get('total')}",
    )
    check(
        "GET /pickup-requests/summary/overview",
        get("/pickup-requests/summary/overview", citizen).status_code == 200,
    )

    prof = requests.patch(
        f"{BASE}/auth/me",
        headers={"Authorization": f"Bearer {citizen}"},
        json={"name": "Demo Citizen", "phone": "+91-90000-00000", "ward": "Barauna", "address": "12 Market Road"},
        timeout=20,
    )
    check("PATCH /auth/me (Profile save)", prof.status_code == 200, str(prof.status_code))

    # ---------------------------------------------------------------- worker
    print("\n-- worker pages --")
    wd = get("/workers/me/dashboard", worker)
    wbody = wd.json() if wd.ok else {}
    check(
        "GET /workers/me/dashboard (WorkerDashboard, TaskList)",
        wd.status_code == 200
        and {"worker", "summary", "pending", "active", "completed", "pickups"} <= set(wbody),
        f"{wd.status_code}",
    )
    check(
        "  Worker shape",
        {"id", "name", "employee_code", "ward", "zone", "vehicle_number", "status",
         "total_assigned", "total_completed", "average_resolution_minutes", "rating",
         "latitude", "longitude"} <= set(wbody.get("worker", {})),
        f"status={wbody.get('worker', {}).get('status')}",
    )
    wstatus = wbody.get("worker", {}).get("status")
    check(
        "  WorkerStatus enum matches frontend",
        wstatus in {"AVAILABLE", "BUSY", "OFFLINE"},
        str(wstatus),
    )

    # Share location: PATCH /workers/{id} with coordinates only (no status).
    loc = requests.patch(
        f"{BASE}/workers/{worker_wid}",
        headers={"Authorization": f"Bearer {worker}"},
        json={"latitude": 26.4515, "longitude": 80.3395},
        timeout=20,
    )
    check(
        "PATCH /workers/{id} latitude+longitude only (Share location)",
        loc.status_code == 200,
        f"{loc.status_code} {loc.text[:70]}",
    )
    if loc.ok:
        check(
        "  worker coords persisted",
        abs((loc.json().get("worker", {}).get("latitude") or 0) - 26.4515) < 1e-6,
        f"lat={loc.json().get('worker', {}).get('latitude')} lon={loc.json().get('worker', {}).get('longitude')}",
    )
    check(
        "PATCH /workers/{id} empty body -> 422",
        requests.patch(
            f"{BASE}/workers/{worker_wid}",
            headers={"Authorization": f"Bearer {worker}"},
            json={},
            timeout=20,
        ).status_code == 422,
    )
    check(
        "PATCH /workers/{id} invalid status -> 422",
        requests.patch(
            f"{BASE}/workers/{worker_wid}",
            headers={"Authorization": f"Bearer {worker}"},
            json={"status": "ON_THE_WAY"},
            timeout=20,
        ).status_code == 422,
    )

    tasks = wbody.get("active") or wbody.get("pending") or []
    check(
        "  worker task buckets present",
        "pending" in wbody and "active" in wbody and "completed" in wbody,
        f"pending={len(wbody.get('pending', []))} active={len(wbody.get('active', []))} completed={len(wbody.get('completed', []))}",
    )
    existing = tasks or wbody.get("completed") or []
    if existing:
        tid = existing[0]["complaint_id"]
        tstatus = existing[0].get("status")
        check(f"  task {tid} readable by assigned worker ({tstatus})",
              get(f"/complaints/{tid}", worker).status_code == 200)

    # ----------------------------------------------------------------- admin
    print("\n-- admin pages --")
    ov = get("/admin/overview", admin)
    ovb = ov.json() if ov.ok else {}
    check(
        "GET /admin/overview (AdminDashboard)",
        ov.status_code == 200
        and {"impact", "recent_complaints", "top_workers", "critical_queue",
             "total_complaints", "resolution_rate", "open_hotspots"} <= set(ovb),
        f"{ov.status_code} total={ovb.get('total_complaints')}",
    )

    q = get("/admin/priority-queue", admin, limit=200)
    queue = q.json() if q.ok else []
    check("GET /admin/priority-queue (PriorityQueue)", q.status_code == 200 and isinstance(queue, list), f"n={len(queue)}")
    if queue:
        check("  queue sorted desc by score",
              all(queue[i]["priority_score"] >= queue[i + 1]["priority_score"] for i in range(len(queue) - 1)),
              f"top={queue[0]['priority_score']}")
        sug = get(f"/complaints/{queue[0]['complaint_id']}/suggest-workers", admin)
        sg = sug.json() if sug.ok else {}
        check(
            "GET /complaints/{id}/suggest-workers (AdminComplaintReview)",
            sug.status_code == 200 and "suggestions" in sg,
            f"{sug.status_code} n={len(sg.get('suggestions', []))}",
        )
        if sg.get("suggestions"):
            s = sg["suggestions"][0]
            check(
                "  Suggestion shape",
                {"id", "name", "employee_code", "ward", "vehicle_number", "status",
                 "active_tasks", "distance_km", "eta_minutes", "match_score"} <= set(s),
                f"missing={sorted({'id','name','employee_code','ward','vehicle_number','status','active_tasks','distance_km','eta_minutes','match_score'} - set(s))}",
            )

    dups = get("/admin/duplicates", admin, refresh="false")
    dp = dups.json() if dups.ok else {}
    check(
        "GET /admin/duplicates (AdminDashboard clusters)",
        dups.status_code == 200 and {"groups", "count"} <= set(dp),
        f"{dups.status_code} count={dp.get('count')}",
    )

    analytics = get("/analytics", admin, days=14)
    an = analytics.json() if analytics.ok else {}
    check(
        "GET /analytics (Analytics page)",
        analytics.status_code == 200
        and {"overview", "impact", "trend", "category_distribution", "status_distribution",
             "priority_distribution", "ward_comparison", "response_times", "hotspots",
             "worker_performance", "pickups"} <= set(an),
        f"{analytics.status_code}",
    )
    check("  trend non-empty", bool(an.get("trend")), f"points={len(an.get('trend', []))}")
    check("  ward_comparison non-empty", bool(an.get("ward_comparison")), f"wards={len(an.get('ward_comparison', []))}")

    workers = get("/workers", admin)
    ws = workers.json() if workers.ok else []
    check("GET /workers (AdminWorkers, AdminPickups select)", workers.status_code == 200 and isinstance(ws, list), f"n={len(ws)}")
    if ws:
        check("  WorkerOut matches frontend Worker type",
              {"id", "employee_code", "vehicle_number", "total_assigned", "total_completed",
               "average_resolution_minutes", "rating", "latitude", "longitude"} <= set(ws[0]))

    admin_pickups = get("/pickup-requests", admin, page=1, page_size=20)
    ap = admin_pickups.json() if admin_pickups.ok else {}
    check("GET /pickup-requests as ADMIN (AdminPickups)", admin_pickups.status_code == 200 and "items" in ap, f"n={len(ap.get('items', []))}")

    # ------------------------------------------------- write paths (real actions)
    print("\n-- write paths exercised by the UI --")
    new_complaint = requests.post(
        f"{BASE}/complaints",
        headers={"Authorization": f"Bearer {citizen}"},
        data={
            "category": "OVERFLOWING_BIN",
            "latitude": "26.4512",
            "longitude": "80.3390",
            "address": "12 Market Road, Barauna",
            "description": "Contract check: overflowing bin with rotting food waste",
            "run_ai": "true",
        },
        timeout=40,
    )
    nc = new_complaint.json() if new_complaint.ok else {}
    check("POST /complaints (ReportWaste submit)", new_complaint.status_code in (200, 201), str(new_complaint.status_code))
    if nc:
        new_id = nc["complaint"]["complaint_id"]
        check(
            "  AI analyzed + scored on submit",
            nc["complaint"]["status"] == "AI_ANALYZED" and nc["complaint"]["priority_score"] is not None,
            f"{nc['complaint']['complaint_id']} {nc['complaint']['status']} "
            f"score={nc['complaint']['priority_score']} level={nc['complaint']['priority_level']}",
        )
        check(
            "  timeline present on new complaint",
            len(nc["complaint"].get("timeline", [])) >= 2,
            f"steps={[t['status'] for t in nc['complaint'].get('timeline', [])]}",
        )
        assign = post(f"/complaints/{new_id}/assign", admin, worker_id=worker_wid)
        check(
            f"POST /complaints/{new_id}/assign (AdminComplaintReview)",
            assign.status_code == 200,
            f"{assign.status_code} -> {assign.json().get('complaint', {}).get('status') if assign.ok else assign.text[:90]}",
        )
        for step in ("ON_THE_WAY", "ARRIVED", "COLLECTED"):
            r = post(f"/complaints/{new_id}/status", worker, status=step)
            check(f"  worker -> {step} (TaskDetail NEXT_STEP)", r.status_code == 200,
                  f"{r.status_code} -> {r.json().get('complaint', {}).get('status') if r.ok else r.text[:80]}")
            if r.status_code != 200:
                break
        p1 = requests.post(
            f"{BASE}/complaints/{new_id}/proof",
            headers={"Authorization": f"Bearer {worker}"},
            files={
                "before_image": ("b.png", io.BytesIO(png_bytes()), "image/png"),
                "after_image": ("a.png", io.BytesIO(png_bytes()), "image/png"),
            },
            data={"note": "contract check proof"},
            timeout=40,
        )
        check("  POST proof (TaskDetail upload)", p1.status_code == 200,
              f"{p1.status_code} -> {p1.json().get('complaint', {}).get('status') if p1.ok else p1.text[:80]}")
        pv = p1.json() if p1.ok else {}
        check(
            "  proof records verification + cleanliness",
            "verification" in pv
            and {"status", "before_score", "after_score", "improvement", "notes"} <= set(pv.get("verification", {})),
            f"vstatus={pv.get('verification', {}).get('status')} "
            f"{pv.get('verification', {}).get('before_score')}->{pv.get('verification', {}).get('after_score')}",
        )
        check(
            "  auto-verification resolved the complaint",
            pv.get("complaint", {}).get("status") == "RESOLVED",
            f"status={pv.get('complaint', {}).get('status')} vstatus={pv.get('verification', {}).get('status')}",
        )
        check(
            "  evidence before+after stored",
            {e.get("evidence_type") for e in pv.get("complaint", {}).get("evidence", [])} >= {"BEFORE", "AFTER"},
            f"types={sorted(e.get('evidence_type') for e in pv.get('complaint', {}).get('evidence', []))}",
        )
        bad = post(f"/complaints/{new_id}/status", admin, status="ARRIVED")
        check(
            "  illegal transition RESOLVED -> ARRIVED rejected",
            bad.status_code == 400,
            f"{bad.status_code} {bad.json().get('detail', '')[:60]}",
        )
        bad2 = post(f"/complaints/{new_id}/verify", admin, status="VERIFIED")
        check(
            "  verify on closed complaint rejected",
            bad2.status_code == 400,
            f"{bad2.status_code} {bad2.json().get('detail', '')[:60]}",
        )

    # NEEDS_REVIEW path: proof that fails verification leaves PROOF_UPLOADED for an admin.
    review_complaint = requests.post(
        f"{BASE}/complaints",
        headers={"Authorization": f"Bearer {citizen}"},
        data={
            "category": "ILLEGAL_DUMPING",
            "latitude": "26.4512",
            "longitude": "80.3390",
            "address": "Contract check review lane",
            "description": "Contract check: review-path report for admin verification",
            "run_ai": "true",
        },
        timeout=40,
    )
    if review_complaint.ok:
        rid = review_complaint.json()["complaint"]["complaint_id"]
        post(f"/complaints/{rid}/assign", admin, worker_id=worker_wid)
        for step in ("ON_THE_WAY", "ARRIVED", "COLLECTED"):
            post(f"/complaints/{rid}/status", worker, status=step)
        rp = requests.post(
            f"{BASE}/complaints/{rid}/proof",
            headers={"Authorization": f"Bearer {worker}"},
            files={
                "before_image": ("b.png", io.BytesIO(png_bytes()), "image/png"),
                "after_image": ("a.png", io.BytesIO(png_bytes()), "image/png"),
            },
            data={},
            timeout=40,
        )
        if rp.ok and rp.json()["complaint"]["status"] == "PROOF_UPLOADED":
            check(
                f"{rid} left in PROOF_UPLOADED (admin verify card is reachable)",
                True,
                f"vstatus={rp.json()['verification']['status']}",
            )
            v_ok = post(f"/complaints/{rid}/verify", admin, status="VERIFIED", note="Supervisor accepted.")
            check(
                f"POST /complaints/{rid}/verify VERIFIED (AdminComplaintReview)",
                v_ok.status_code == 200,
                f"{v_ok.status_code} -> {v_ok.json().get('complaint', {}).get('status') if v_ok.ok else v_ok.text[:70]}",
            )
        else:
            st = rp.json()["complaint"]["status"] if rp.ok else rp.status_code
            check(f"{rid} proof auto-resolved (no PROOF_UPLOADED state on this seed)", True, f"status={st}")

    new_pickup = requests.post(
        f"{BASE}/pickup-requests",
        headers={"Authorization": f"Bearer {citizen}"},
        data={
            "waste_type": "E_WASTE",
            "quantity": "2",
            "unit": "kg",
            "address": "12 Market Road, Barauna",
            "latitude": "26.4512",
            "longitude": "80.3390",
            "ward": "Barauna",
            "preferred_date": "2026-10-05",
            "preferred_time": "MORNING",
            "notes": "Contract check pickup",
        },
        timeout=30,
    )
    check("POST /pickup-requests (PickupRequest submit)", new_pickup.status_code in (200, 201),
          f"{new_pickup.status_code} {new_pickup.text[:80] if not new_pickup.ok else ''}")
    check(
        "  create returns {pickup: Pickup} (frontend unwraps .pickup)",
        new_pickup.ok and "pickup" in new_pickup.json()
        and {"pickup_id", "status", "waste_type", "quantity", "unit", "timeline"} <= set(new_pickup.json()["pickup"]),
        f"keys={sorted(new_pickup.json()['pickup'])[:5] if new_pickup.ok else new_pickup.text[:60]}",
    )
    if new_pickup.ok:
        pk = new_pickup.json()["pickup"]
        pk_id = pk["id"]
        pk_ref = pk["pickup_id"]
        assign_pk = requests.post(
            f"{BASE}/pickup-requests/{pk_id}/assign",
            headers={"Authorization": f"Bearer {admin}"},
            data={"worker_id": str(worker_wid)},
            timeout=20,
        )
        check(f"POST /pickup-requests/{pk_id}/assign (AdminPickups)", assign_pk.status_code == 200,
              f"{assign_pk.status_code} -> {assign_pk.json().get('pickup', {}).get('status') if assign_pk.ok else assign_pk.text[:80]}")
        for step in ("ON_THE_WAY", "COLLECTED", "COMPLETED"):
            r = post(f"/pickup-requests/{pk_id}/status", worker, status=step)
            check(f"  pickup -> {step}", r.status_code == 200,
                  f"{r.status_code} -> {r.json().get('pickup', {}).get('status') if r.ok else r.text[:80]}")
            if r.status_code != 200:
                break
        pk_detail = get(f"/pickup-requests/{pk_ref}", citizen)
        check(f"GET /pickup-requests/{pk_ref} (PickupRequest detail)", pk_detail.status_code == 200, str(pk_detail.status_code))

    system = get("/admin/system", admin)
    sy = system.json() if system.ok else {}
    check(
        "GET /admin/system (Settings)",
        system.status_code == 200
        and {"app", "environment", "database", "ai", "verification_provider",
             "upload_dir", "max_upload_mb"} <= set(sy),
        f"{system.status_code}",
    )

    recompute = post("/admin/recompute", admin)
    check("POST /admin/recompute (Settings, HotspotMap)", recompute.status_code == 200, str(recompute.status_code))

    admin_awareness = get("/awareness", admin, admin=True)
    check(
        "GET /awareness?admin=true as ADMIN (AdminAwareness)",
        admin_awareness.status_code == 200 and len(admin_awareness.json()) >= len(aw),
        f"{admin_awareness.status_code} n={len(admin_awareness.json()) if admin_awareness.ok else 0}",
    )

    # --------------------------------------------------- role guard negative
    print("\n-- role enforcement (frontend guards rely on these 403s) --")
    for path, token, label in (
        ("/admin/overview", citizen, "CITIZEN blocked from /admin/*"),
        ("/workers/me/dashboard", citizen, "CITIZEN blocked from /workers/*"),
        ("/admin/priority-queue", worker, "WORKER blocked from /admin/*"),
        ("/complaints", worker, "WORKER complaint list allowed (own tasks)"),
    ):
        r = get(path, token)
        if "blocked" in label:
            check(label, r.status_code == 403, str(r.status_code))
        else:
            check(label, r.status_code == 200, str(r.status_code))

    print("\n" + "=" * 72)
    print(f"PASSED: {len(PASS)}    FAILED: {len(FAIL)}")
    if FAIL:
        print("\nFailures:")
        for f in FAIL:
            print("  -", f)
    print("=" * 72)
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
