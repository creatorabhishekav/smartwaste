"""Explicit seeding entry point.

Usage:
    python -m app.seed           # seed if the database is empty
    python -m app.seed --force   # re-seed (wipes the demo tables first)
"""
from __future__ import annotations

import argparse
import sys

from app.database.seed_data import seed_demo_data
from app.database.session import Base, SessionLocal, engine


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed SmartWaste 360 demo data")
    parser.add_argument(
        "--force", action="store_true", help="Drop existing demo rows before seeding"
    )
    args = parser.parse_args(argv)

    import app.models  # noqa: F401  (ensure metadata is registered)

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if args.force:
            from app.models.misc import AwarenessContent, EcoTransaction, Hotspot, Notification
            from app.models.pickup import PickupEvent, PickupRequest
            from app.models.complaint import Assignment, Complaint, ComplaintEvent, Evidence
            from app.models.user import User, Worker

            for model in (
                Evidence,
                Assignment,
                ComplaintEvent,
                Complaint,
                PickupEvent,
                PickupRequest,
                Notification,
                EcoTransaction,
                Hotspot,
                AwarenessContent,
                Worker,
                User,
            ):
                db.query(model).delete()
            db.commit()
            print("Cleared existing demo data.")

        result = seed_demo_data(db)
    if result.get("skipped"):
        print("Database already contains data. Use --force to re-seed.")
        return 0
    print("Seeded SmartWaste 360 demo data:")
    for key, value in result.items():
        print(f"  {key}: {value}")
    print("\nDemo logins (password: demo123)")
    print("  citizen@demo.com  worker@demo.com  admin@demo.com")
    return 0


if __name__ == "__main__":
    sys.exit(main())
