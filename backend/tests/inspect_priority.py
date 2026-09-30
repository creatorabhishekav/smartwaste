from collections import Counter

from app.database.session import SessionLocal
from app.models.complaint import Complaint

with SessionLocal() as db:
    rows = db.query(Complaint).all()
    print("priority levels:", Counter(r.priority_level for r in rows))
    print("status levels  :", Counter(r.status for r in rows))
    print("score min/max  :", min(r.priority_score for r in rows), max(r.priority_score for r in rows))
    print()
    for r in sorted(rows, key=lambda r: -r.priority_score)[:10]:
        b = r.priority_breakdown or {}
        sev = (b.get("severity") or {}).get("value")
        age = (b.get("age") or {}).get("value")
        prox = (b.get("proximity") or {}).get("value")
        loc = (b.get("location") or {}).get("value")
        print(
            f"{r.complaint_id} {r.priority_score:5.1f} {r.priority_level:9s} "
            f"sev={sev} age={age} prox={prox} loc={loc} {r.ward:16s} {r.status}"
        )
