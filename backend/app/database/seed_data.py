"""Demo seed: users, workers, 30+ complaints, pickups, awareness content, hotspots.

Idempotent - skips seeding when the users table already has data.
"""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.complaint import Complaint, ComplaintEvent
from app.models.enums import (
    ComplaintCategory,
    ComplaintStatus,
    EvidenceType,
    NotificationType,
    PickupStatus,
    UserRole,
    WorkerStatus,
)
from app.models.misc import AwarenessContent, Hotspot, Notification
from app.models.pickup import PickupEvent, PickupRequest
from app.models.user import User, Worker, utcnow
from app.services import complaint_service as svc
from app.services.complaint_service import STATUS_LABELS
from app.services.duplicates import cluster_complaints
from app.services.geo import WARD_CENTERS, jitter
from app.services.gamification import award_points

DEMO_PASSWORD = "demo123"

CITIZEN_PROFILES = [
    ("citizen@demo.com", "Aarav Sharma", "Barauna", "House 42, Barauna Road, Kanpur"),
    ("priya@demo.com", "Priya Verma", "Kakadeo", "Flat 7, Kakadeo Market, Kanpur"),
    ("rohit@demo.com", "Rohit Singh", "Cement Factory", "Near Railway Crossing, Kanpur"),
    ("ananya@demo.com", "Ananya Iyer", "Kalyanpur", "House 108, Kalyanpur, Kanpur"),
    ("kabir@demo.com", "Kabir Khan", "Amanipur", "Amanipur Main Road, Kanpur"),
    ("sneha@demo.com", "Sneha Mishra", "Kidarpur", "Shop 12, Kidarpur Bazaar, Kanpur"),
]

WORKER_PROFILES = [
    ("worker@demo.com", "Ramesh Yadav", "Barauna", "Zone 1", "UP32-AB-4412"),
    ("sunita@demo.com", "Sunita Devi", "Kakadeo", "Zone 2", "UP32-AB-5523"),
    ("imran@demo.com", "Imran Ali", "Cement Factory", "Zone 3", "UP32-AB-6634"),
    ("deepak@demo.com", "Deepak Gupta", "Kalyanpur", "Zone 4", "UP32-AB-7745"),
    ("meena@demo.com", "Meena Kumari", "Amanipur", "Zone 5", "UP32-AB-8856"),
    ("vikas@demo.com", "Vikas Chauhan", "Kidarpur", "Zone 6", "UP32-AB-9967"),
]

CATEGORY_POOL = [
    ComplaintCategory.OVERFLOWING_BIN.value,
    ComplaintCategory.GARBAGE_ON_ROAD.value,
    ComplaintCategory.ILLEGAL_DUMPING.value,
    ComplaintCategory.MISSED_COLLECTION.value,
    ComplaintCategory.IMPROPER_SEGREGATION.value,
    ComplaintCategory.OTHER.value,
]

DESCRIPTIONS = {
    ComplaintCategory.OVERFLOWING_BIN.value: [
        "The community bin has been overflowing since yesterday, waste is spilling onto the footpath with a strong smell.",
        "Municipal bin is completely full and flies are circling the street. Needs urgent collection.",
    ],
    ComplaintCategory.GARBAGE_ON_ROAD.value: [
        "Garbage pile on the main road near the crossing. Plastic bags and food waste blocking half the road.",
        "Loose garbage along the divider after last night's collection. Very messy and unsafe for pedestrians.",
    ],
    ComplaintCategory.ILLEGAL_DUMPING.value: [
        "Someone dumped construction debris and plastic sheets near the empty plot at night. Third time this month.",
        "Illegal dumping of mixed waste behind the vacant shop. Bad smell and unsafe for children.",
    ],
    ComplaintCategory.MISSED_COLLECTION.value: [
        "Garbage vehicle did not come today. Both bins are full and the street is unhygienic.",
        "Our society bins have not been emptied for three days. Request urgent pickup.",
    ],
    ComplaintCategory.IMPROPER_SEGREGATION.value: [
        "Wet and dry waste are mixed in the same bin, so nothing can be recycled properly.",
        "Household is dumping sanitary waste into the green wet-waste bin. Needs correction.",
    ],
    ComplaintCategory.OTHER.value: [
        "Broken glass and sharp metal pieces lying beside the play area. Danger for kids.",
        "Old tyres and unusable furniture dumped at the corner lane. Needs removal.",
    ],
}

AWARENESS_SEED: list[dict] = [
    {
        "slug": "wet-waste",
        "title": "Wet / Organic Waste",
        "category": "Segregation",
        "summary": "Kitchen leftovers, vegetable peels and garden trimmings that can be composted.",
        "what_it_is": "Biodegradable organic material such as food scraps, vegetable and fruit peels, tea leaves, flower waste and garden trimmings.",
        "which_bin": "Wet waste bin (green)",
        "how_to_dispose": "Drain excess water, remove plastic wrappers, then hand over to the wet-waste collector in a sealed bag. Compost at home if possible.",
        "recyclable": True,
        "hazard_level": "LOW",
        "accent": "emerald",
        "do_list": [
            "Use a dedicated green bin with a lid.",
            "Compost at home using a simple pit or pot.",
            "Segregate within 24 hours to avoid fermentation and flies.",
        ],
        "dont_list": [
            "Do not mix with dry recyclables.",
            "Do not dump sanitary pads or diapers in wet waste.",
        ],
    },
    {
        "slug": "dry-waste",
        "title": "Dry Recyclable Waste",
        "category": "Segregation",
        "summary": "Clean, dry and recyclable material that must stay separate from organic waste.",
        "what_it_is": "Non-biodegradable but recyclable dry material: paper, cardboard, cleaned plastic, glass, metal and inert items.",
        "which_bin": "Dry recyclable bin (blue)",
        "how_to_dispose": "Rinse and dry items, flatten containers, then deposit at the blue dry-waste bin or an authorised recycler.",
        "recyclable": True,
        "hazard_level": "LOW",
        "accent": "sky",
        "do_list": [
            "Rinse bottles and jars before disposal.",
            "Flatten cartons to save space and keep them dry.",
            "Separate caps and labels where the recycler requires it.",
        ],
        "dont_list": [
            "Do not throw soiled or wet paper into dry waste.",
            "Do not bag recyclables in black polythene.",
        ],
    },
    {
        "slug": "plastic",
        "title": "Plastic Waste",
        "category": "Material",
        "summary": "Single-use and reusable plastic packaging, bottles, bags and wrappers.",
        "what_it_is": "Plastic products such as PET bottles, HDPE containers, polythene bags, sachets, cups and takeaway packaging.",
        "which_bin": "Dry recyclable bin (blue) for clean items",
        "how_to_dispose": "Rinse, dry and flatten clean plastic, then place it in the dry recyclable bin. Carry a cloth bag and a refillable bottle to reduce single-use plastic.",
        "recyclable": True,
        "hazard_level": "MEDIUM",
        "accent": "cyan",
        "do_list": [
            "Buy and carry reusable bottles and bags.",
            "Collect plastic in a dedicated dry-waste bag.",
            "Report blocked drains caused by plastic through SmartWaste 360.",
        ],
        "dont_list": [
            "Do not burn plastic releases toxic fumes.",
            "Do not mix multilayer sachets with recyclables.",
        ],
    },
    {
        "slug": "paper",
        "title": "Paper & Cardboard",
        "category": "Material",
        "summary": "Newspapers, notebooks, cartons and office paper that can be recycled many times.",
        "what_it_is": "Clean fibrous material including newsprint, magazines, cardboard, office paper, envelopes and paper bags.",
        "which_bin": "Dry recyclable bin (blue)",
        "how_to_dispose": "Remove food and oil stains, bundle paper flat and keep it dry, then hand it to the paper recycler or the blue bin.",
        "recyclable": True,
        "hazard_level": "LOW",
        "accent": "amber",
        "do_list": [
            "Tear confidential documents before disposal.",
            "Flatten boxes to keep them dry and compact.",
            "Reuse the back side of printed sheets for rough work.",
        ],
        "dont_list": [
            "Do not recycle wet or oil-soiled paper.",
            "Do not mix thermal receipts with recyclables.",
        ],
    },
    {
        "slug": "glass",
        "title": "Glass Waste",
        "category": "Material",
        "summary": "Bottles, jars and containers that can be infinitely recycled when kept clean.",
        "what_it_is": "Glass packaging such as beverage bottles, medicine vials, food jars and drinking-glass items.",
        "which_bin": "Glass drop-off / Dry recyclable bin",
        "how_to_dispose": "Drain the contents, remove caps and labels, and deliver the glass to a recycler or authorised kiosk - never into a mixed bin.",
        "recyclable": True,
        "hazard_level": "MEDIUM",
        "accent": "teal",
        "do_list": [
            "Wrap broken glass in thick paper and mark it.",
            "Store glass in a closed box to protect handlers.",
            "Return soft-drink bottles to the shop for a refill credit.",
        ],
        "dont_list": [
            "Do not place broken glass in household dry waste.",
            "Do not put glass in the wet waste bin.",
        ],
    },
    {
        "slug": "e-waste",
        "title": "E-Waste",
        "category": "Special",
        "summary": "Phones, laptops, chargers, batteries and electronic accessories.",
        "what_it_is": "Electronic devices and their accessories including mobile phones, laptops, chargers, adapters, TVs, batteries and circuit boards.",
        "which_bin": "E-Waste / Red hazardous drop-off centre",
        "how_to_dispose": "Wipe personal data, then hand the device to a certified collection centre or authorised e-waste vendor. Many vendors offer a buy-back or exchange.",
        "recyclable": False,
        "hazard_level": "HIGH",
        "accent": "violet",
        "do_list": [
            "Remove and store memory/SD cards separately.",
            "Remove batteries and deliver them as hazardous waste.",
            "Use the city e-waste collection drive announced on SmartWaste 360.",
        ],
        "dont_list": [
            "Do not burn or bury e-waste.",
            "Do not put electronics in household dry waste.",
        ],
    },
    {
        "slug": "hazardous",
        "title": "Hazardous / Household Chemical Waste",
        "category": "Special",
        "summary": "Paints, solvents, pesticides, oils and medical sharps that need authorised handling.",
        "what_it_is": "Materials that can harm people, animals or the environment: paints, thinners, pesticides, expired medicines, chemical containers and used sharps.",
        "which_bin": "Yellow hazardous bin - authorised centre only",
        "how_to_dispose": "Store sealed in a cool, shaded place, never mix with kitchen or garden waste, and hand over within 48 hours to an authorised collection point.",
        "recyclable": False,
        "hazard_level": "CRITICAL",
        "accent": "rose",
        "do_list": [
            "Wear gloves and a mask while handling.",
            "Keep chemicals away from children and food.",
            "Ask the municipal helpline for a scheduled hazardous pickup.",
        ],
        "dont_list": [
            "Do not pour chemicals down a drain or into a water body.",
            "Do not reuse containers for food or water.",
        ],
    },
]


def _complaint_ref(index: int) -> str:
    return f"SW-{datetime.utcnow().year}-{index:04d}"


def seed_demo_data(db: Session) -> dict[str, int]:
    """Populate the database with a realistic Kanpur demo dataset."""
    if db.query(User).count() > 0:
        return {"skipped": 1}

    random.seed(42)
    now = utcnow()

    # --- users ---------------------------------------------------------
    admin = User(
        name="Nagar Nigam Admin",
        email="admin@demo.com",
        phone="+91 90000 00001",
        password_hash=hash_password(DEMO_PASSWORD),
        role=UserRole.ADMIN.value,
        ward="Barauna",
        address="Kanpur Nagar Nigam HQ, Barauna",
        latitude=26.4499,
        longitude=80.3319,
        eco_points=0,
    )
    db.add(admin)
    db.flush()

    citizens: list[User] = []
    for email, name, ward, address in CITIZEN_PROFILES:
        lat, lon = WARD_CENTERS[ward]
        jlat, jlon = jitter(lat, lon, 0.006, seed=abs(hash(email)) % 997)
        user = User(
            name=name,
            email=email,
            phone=f"+91 9{random.randint(100000000, 999999999)}",
            password_hash=hash_password(DEMO_PASSWORD),
            role=UserRole.CITIZEN.value,
            ward=ward,
            address=address,
            latitude=round(jlat, 6),
            longitude=round(jlon, 6),
            eco_points=0,
        )
        db.add(user)
        citizens.append(user)

    workers: list[Worker] = []
    for idx, (email, name, ward, zone, vehicle) in enumerate(WORKER_PROFILES):
        lat, lon = WARD_CENTERS[ward]
        jlat, jlon = jitter(lat, lon, 0.008, seed=idx * 31 + 5)
        user = User(
            name=name,
            email=email,
            phone=f"+91 8{random.randint(100000000, 999999999)}",
            password_hash=hash_password(DEMO_PASSWORD),
            role=UserRole.WORKER.value,
            ward=ward,
            address=f"Zone office, {ward}, Kanpur",
            latitude=round(jlat, 6),
            longitude=round(jlon, 6),
            eco_points=0,
        )
        db.add(user)
        db.flush()
        worker = Worker(
            user_id=user.id,
            employee_code=f"SW-WK-{1000 + user.id}",
            ward=ward,
            zone=zone,
            vehicle_number=vehicle,
            status=WorkerStatus.AVAILABLE.value if idx % 3 else WorkerStatus.BUSY.value,
            current_latitude=round(jlat, 6),
            current_longitude=round(jlon, 6),
            rating=round(4.2 + random.random() * 0.7, 1),
        )
        db.add(worker)
        workers.append(worker)
    db.flush()

    # --- complaints -----------------------------------------------------
    ward_names = list(WARD_CENTERS.keys())

    # Deterministic plan so the demo always shows a healthy, realistic queue.
    # (status, category, ward, hours_ago)
    A = ComplaintCategory
    S = ComplaintStatus
    plan: list[tuple[str, str, str, int]] = [
        # --- hotspot 1: Barauna hospital crossing, overflowing bins --------
        # One resolved + FIVE still open, one of them aging. This unresolved
        # cluster is what the priority engine must escalate to CRITICAL.
        (S.RESOLVED.value, A.OVERFLOWING_BIN.value, "Barauna", 214),
        (S.ON_THE_WAY.value, A.OVERFLOWING_BIN.value, "Barauna", 30),
        (S.ASSIGNED.value, A.OVERFLOWING_BIN.value, "Barauna", 26),
        (S.AI_ANALYZED.value, A.OVERFLOWING_BIN.value, "Barauna", 66),
        (S.REVIEWED.value, A.OVERFLOWING_BIN.value, "Barauna", 20),
        (S.AI_ANALYZED.value, A.OVERFLOWING_BIN.value, "Barauna", 5),
        # --- hotspot 2: Kakadeo market bus stand, road garbage (3 open) ----
        (S.RESOLVED.value, A.GARBAGE_ON_ROAD.value, "Kakadeo", 190),
        (S.REVIEWED.value, A.GARBAGE_ON_ROAD.value, "Kakadeo", 44),
        (S.AI_ANALYZED.value, A.GARBAGE_ON_ROAD.value, "Kakadeo", 11),
        # --- hotspot 3: Amanipur STP boundary, illegal dumping (3 open) ---
        (S.COLLECTED.value, A.ILLEGAL_DUMPING.value, "Amanipur", 58),
        (S.ASSIGNED.value, A.ILLEGAL_DUMPING.value, "Amanipur", 22),
        (S.AI_ANALYZED.value, A.ILLEGAL_DUMPING.value, "Amanipur", 4),
        # --- hotspot 4: Kidarpur temple street, missed collection --------
        (S.RESOLVED.value, A.MISSED_COLLECTION.value, "Kidarpur", 168),
        (S.ON_THE_WAY.value, A.MISSED_COLLECTION.value, "Kidarpur", 19),
        (S.AI_ANALYZED.value, A.MISSED_COLLECTION.value, "Kidarpur", 52),
        # --- spread across the remaining wards ---------------------------
        (S.RESOLVED.value, A.IMPROPER_SEGREGATION.value, "Kalyanpur", 150),
        (S.RESOLVED.value, A.OVERFLOWING_BIN.value, "Kalyanpur", 132),
        (S.RESOLVED.value, A.GARBAGE_ON_ROAD.value, "Cement Factory", 126),
        (S.RESOLVED.value, A.ILLEGAL_DUMPING.value, "Cement Factory", 120),
        (S.RESOLVED.value, A.MISSED_COLLECTION.value, "Ghusanganj", 115),
        (S.RESOLVED.value, A.IMPROPER_SEGREGATION.value, "Ghusanganj", 108),
        (S.RESOLVED.value, A.OTHER.value, "Nausahra", 101),
        (S.RESOLVED.value, A.OVERFLOWING_BIN.value, "Nausahra", 96),
        (S.RESOLVED.value, A.GARBAGE_ON_ROAD.value, "Azamgarh", 88),
        (S.RESOLVED.value, A.MISSED_COLLECTION.value, "Azamgarh", 81),
        (S.RESOLVED.value, A.ILLEGAL_DUMPING.value, "Colelganj", 74),
        (S.RESOLVED.value, A.IMPROPER_SEGREGATION.value, "Colelganj", 68),
        (S.RESOLVED.value, A.OTHER.value, "Barauna", 61),
        (S.RESOLVED.value, A.OVERFLOWING_BIN.value, "Kakadeo", 55),
        (S.RESOLVED.value, A.MISSED_COLLECTION.value, "Amanipur", 48),
        (S.ON_THE_WAY.value, A.GARBAGE_ON_ROAD.value, "Kalyanpur", 16),
        (S.ASSIGNED.value, A.OVERFLOWING_BIN.value, "Cement Factory", 14),
        (S.AI_ANALYZED.value, A.OTHER.value, "Ghusanganj", 6),
        (S.AI_ANALYZED.value, A.IMPROPER_SEGREGATION.value, "Nausahra", 2),
        (S.SUBMITTED.value, A.OTHER.value, "Azamgarh", 1),
        (S.REVIEWED.value, A.MISSED_COLLECTION.value, "Colelganj", 9),
        (S.COLLECTED.value, A.ILLEGAL_DUMPING.value, "Kidarpur", 27),
        (S.RESOLVED.value, A.IMPROPER_SEGREGATION.value, "Kidarpur", 43),
    ]

    # Hotspot clusters share a tight anchor so the 250 m grouping forms.
    anchors = {
        ("Barauna", A.OVERFLOWING_BIN.value): (26.4302, 80.3121),
        ("Kakadeo", A.GARBAGE_ON_ROAD.value): (26.4518, 80.3388),
        ("Amanipur", A.ILLEGAL_DUMPING.value): (26.4618, 80.3062),
        ("Kidarpur", A.MISSED_COLLECTION.value): (26.4558, 80.2884),
    }

    # Sensitive public anchors for the clustered complaints.
    HOTSPOT_STREETS = {
        (26.4302, 80.3121): "Civil Hospital crossing, near the medical college gate",
        (26.4518, 80.3388): "Kakadeo market bus stand main road",
        (26.4618, 80.3062): "Amanipur water treatment plant boundary",
        (26.4558, 80.2884): "Kidarpur temple street and drain crossing",
    }

    complaints: list[Complaint] = []
    for index, (target_status, category, ward, hours_ago) in enumerate(plan, start=1):
        anchor = anchors.get((ward, category))
        clustered = anchor is not None
        base_lat, base_lon = anchor or WARD_CENTERS[ward]
        lat, lon = jitter(
            base_lat, base_lon, 0.0016 if clustered else 0.011, seed=index * 7
        )
        created = now - timedelta(hours=hours_ago, minutes=random.randint(0, 55))
        citizen = citizens[index % len(citizens)]

        if clustered:
            # Hotspot clusters sit on sensitive public anchors - exactly the
            # condition the location factor is designed to escalate.
            address = f"{HOTSPOT_STREETS[anchor]} {ward}, Kanpur"
        else:
            address = f"{random.randint(1, 240)}, {ward} Main Road, Kanpur"

        complaint = Complaint(
            complaint_id=_complaint_ref(index),
            user_id=citizen.id,
            category=category,
            description=random.choice(DESCRIPTIONS[category]),
            image_url=None,
            latitude=round(lat, 6),
            longitude=round(lon, 6),
            address=address,
            ward=ward,
            status=ComplaintStatus.SUBMITTED.value,
            created_at=created,
            updated_at=created,
        )
        db.add(complaint)
        db.flush()
        complaints.append(complaint)

        db.add(
            ComplaintEvent(
                complaint_id=complaint.id,
                status=ComplaintStatus.SUBMITTED.value,
                label=STATUS_LABELS[ComplaintStatus.SUBMITTED.value],
                note="Citizen report received",
                actor_id=citizen.id,
                created_at=created,
            )
        )

        # AI analysis (uses the deterministic demo provider during seeding)
        svc.run_ai_analysis(db, complaint, image_bytes=None, image_filename=f"seed-{index}.jpg", actor_id=citizen.id)
        svc.refresh_neighbour_priorities(db, complaint)
        analysis_time = created + timedelta(minutes=2)
        complaint.events[0].created_at = created
        for event in complaint.events:
            if event.status == ComplaintStatus.AI_ANALYZED.value:
                event.created_at = analysis_time

        # advance to the planned status
        chain = [
            ComplaintStatus.REVIEWED.value,
            ComplaintStatus.ASSIGNED.value,
            ComplaintStatus.ON_THE_WAY.value,
            ComplaintStatus.ARRIVED.value,
            ComplaintStatus.COLLECTED.value,
            ComplaintStatus.PROOF_UPLOADED.value,
            ComplaintStatus.VERIFIED.value,
            ComplaintStatus.RESOLVED.value,
        ]
        worker = workers[index % len(workers)]
        reached = chain.index(target_status) if target_status in chain else -1
        assignment = None
        if target_status in {ComplaintStatus.RESOLVED.value} or reached >= 0:
            svc.admin_set_status(
                db, complaint, ComplaintStatus.REVIEWED.value, actor_id=admin.id, note="Reviewed by ward supervisor"
            )
            complaint.response_minutes = round(
                random.uniform(18, 320), 1
            )
            assignment = svc.assign_worker(db, complaint, worker, actor_id=admin.id)
            for step_index, step in enumerate(chain[: reached + 1]):
                if step in {
                    ComplaintStatus.REVIEWED.value,
                    ComplaintStatus.ASSIGNED.value,
                }:
                    continue
                svc.worker_transition(db, complaint, worker, step)
        if target_status == ComplaintStatus.COLLECTED.value:
            pass
        if target_status == ComplaintStatus.RESOLVED.value:
            result = svc.finalize_with_evidence(
                db,
                complaint,
                before_url=f"/media/seed/before-{index}.jpg",
                after_url=f"/media/seed/after-{index}.jpg",
                before_bytes=None,
                after_bytes=None,
                before_filename=f"before-{index}.jpg",
                after_filename=f"after-{index}.jpg",
                worker=worker,
                note="Collected and swept",
            )
            if result["status"] != "VERIFIED":
                # deterministic fallback so the demo always has resolved items
                complaint.status = ComplaintStatus.RESOLVED.value
                complaint.resolved_at = now - timedelta(hours=random.randint(1, 40))
                complaint.verification_status = "VERIFIED"

        if target_status == ComplaintStatus.SUBMITTED.value:
            # leave as analysed-only for a few rows to exercise the queue
            pass
        db.flush()

    # eco points for the primary demo citizen
    primary = citizens[0]
    award_points(db, user_id=primary.id, points=0, reason="Welcome to SmartWaste 360")
    primary.eco_points = 820
    for other in citizens[1:]:
        other.eco_points = random.randint(120, 1450)
    db.flush()

    # --- pickup requests ----------------------------------------------
    pickup_plan = [
        ("Household Dry Waste", 45.0, PickupStatus.COMPLETED.value, 6),
        ("E-Waste", 8.5, PickupStatus.COMPLETED.value, 3),
        ("Bulk Construction Debris", 120.0, PickupStatus.ON_THE_WAY.value, 1),
        ("Garden / Green Waste", 30.0, PickupStatus.ASSIGNED.value, 0),
        ("Mixed Commercial Waste", 65.0, PickupStatus.REQUESTED.value, 0),
    ]
    for i, (waste_type, quantity, status_value, days_ago) in enumerate(pickup_plan, start=1):
        citizen = citizens[i % len(citizens)]
        lat, lon = citizen.latitude or 26.4499, citizen.longitude or 80.3319
        created = now - timedelta(days=days_ago, hours=random.randint(0, 10))
        pickup = PickupRequest(
            pickup_id=f"PU-{datetime.utcnow().year}-{i:04d}",
            user_id=citizen.id,
            waste_type=waste_type,
            quantity=quantity,
            unit="kg",
            address=citizen.address or "Kanpur",
            latitude=lat,
            longitude=lon,
            ward=citizen.ward,
            preferred_date=(now + timedelta(days=1)).date(),
            preferred_time="09:00 - 12:00",
            notes="Please call before arriving.",
            status=PickupStatus.REQUESTED.value,
            created_at=created,
            updated_at=created,
        )
        db.add(pickup)
        db.flush()
        db.add(
            PickupEvent(
                pickup_id=pickup.id,
                status=PickupStatus.REQUESTED.value,
                label="Requested",
                note=f"{quantity} kg of {waste_type}",
                created_at=created,
            )
        )
        if status_value in {
            PickupStatus.ASSIGNED.value,
            PickupStatus.ON_THE_WAY.value,
            PickupStatus.COLLECTED.value,
            PickupStatus.COMPLETED.value,
        }:
            worker = workers[i % len(workers)]
            pickup.assigned_worker_id = worker.id
            pickup.status = PickupStatus.ASSIGNED.value
            db.add(
                PickupEvent(
                    pickup_id=pickup.id,
                    status=PickupStatus.ASSIGNED.value,
                    label="Assigned",
                    note=f"Crew {worker.employee_code} assigned",
                    created_at=created + timedelta(hours=2),
                )
            )
        if status_value in {PickupStatus.ON_THE_WAY.value, PickupStatus.COLLECTED.value, PickupStatus.COMPLETED.value}:
            pickup.status = PickupStatus.ON_THE_WAY.value
            db.add(
                PickupEvent(
                    pickup_id=pickup.id,
                    status=PickupStatus.ON_THE_WAY.value,
                    label="On The Way",
                    created_at=created + timedelta(hours=5),
                )
            )
        if status_value in {PickupStatus.COLLECTED.value, PickupStatus.COMPLETED.value}:
            pickup.status = PickupStatus.COLLECTED.value
            db.add(
                PickupEvent(
                    pickup_id=pickup.id,
                    status=PickupStatus.COLLECTED.value,
                    label="Collected",
                    created_at=created + timedelta(hours=7),
                )
            )
        if status_value == PickupStatus.COMPLETED.value:
            pickup.status = PickupStatus.COMPLETED.value
            pickup.completed_at = created + timedelta(hours=9)
            pickup.eco_points_awarded = 40 if quantity >= 50 else 25
            db.add(
                PickupEvent(
                    pickup_id=pickup.id,
                    status=PickupStatus.COMPLETED.value,
                    label="Completed",
                    created_at=pickup.completed_at,
                )
            )
    db.flush()

    # --- awareness content ---------------------------------------------
    for item in AWARENESS_SEED:
        db.add(AwarenessContent(**item))
    db.flush()

    # --- notifications ---------------------------------------------------
    for citizen in citizens:
        for complaint in complaints[:3]:
            db.add(
                Notification(
                    user_id=citizen.id,
                    title=f"Update on {complaint.complaint_id}",
                    message="Your report is being tracked by the ward collection team.",
                    type=NotificationType.INFO.value,
                    complaint_id=complaint.id,
                    created_at=complaint.created_at + timedelta(hours=1),
                )
            )
    db.add(
        Notification(
            user_id=admin.id,
            title="Priority queue ready",
            message=f"{sum(1 for c in complaints if c.priority_level == 'CRITICAL')} critical reports need assignment.",
            type=NotificationType.ALERT.value,
        )
    )
    for worker in workers:
        db.add(
            Notification(
                user_id=worker.user_id,
                title="Today's route",
                message="Open your task list to see the priority queue for your ward.",
                type=NotificationType.INFO.value,
            )
        )
    db.flush()

    db.commit()

    # --- final priority pass over still-open complaints -------------------
    # Statuses changed while seeding, so recompute the queue from the live
    # open set. This is what surfaces real CRITICAL hotspot pressure.
    from app.models.enums import OPEN_STATUSES
    from app.services.priority_engine import compute_priority

    open_rows = [
        c
        for c in db.query(Complaint).filter(Complaint.status.in_(OPEN_STATUSES)).all()
    ]
    context = [
        {
            "id": c.id,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "status": c.status,
            "category": c.category,
        }
        for c in open_rows
    ]
    for c in open_rows:
        result = compute_priority(
            severity=c.severity,
            created_at=c.created_at,
            latitude=c.latitude,
            longitude=c.longitude,
            address=c.address,
            ward=c.ward,
            waste_type=c.waste_type,
            neighbours=[n for n in context if n["id"] != c.id],
        )
        c.priority_score = result.score
        c.priority_level = result.level
        c.priority_reasons = result.reasons
        c.priority_breakdown = result.breakdown
    db.commit()

    # --- hotspots (computed from the seeded complaints) ------------------
    clusters = cluster_complaints(complaints)
    for cluster in clusters:
        db.add(
            Hotspot(
                code=cluster["code"],
                label=cluster["label"],
                ward=cluster["ward"] or "Barauna",
                latitude=cluster["latitude"],
                longitude=cluster["longitude"],
                complaint_count=cluster["complaint_count"],
                critical_count=cluster["critical_count"],
                open_count=cluster["open_count"],
                top_issue=cluster["top_issue"],
                recommended_action=cluster["recommended_action"],
                intensity=cluster["intensity"],
            )
        )
    db.commit()

    return {
        "users": len(citizens) + len(workers) + 1,
        "workers": len(workers),
        "complaints": len(complaints),
        "pickups": len(pickup_plan),
        "awareness_items": len(AWARENESS_SEED),
        "hotspots": len(clusters),
    }
