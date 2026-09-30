from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    CITIZEN = "CITIZEN"
    WORKER = "WORKER"
    ADMIN = "ADMIN"


class WorkerStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    OFFLINE = "OFFLINE"


class ComplaintCategory(str, enum.Enum):
    OVERFLOWING_BIN = "OVERFLOWING_BIN"
    GARBAGE_ON_ROAD = "GARBAGE_ON_ROAD"
    ILLEGAL_DUMPING = "ILLEGAL_DUMPING"
    MISSED_COLLECTION = "MISSED_COLLECTION"
    IMPROPER_SEGREGATION = "IMPROPER_SEGREGATION"
    OTHER = "OTHER"


class ComplaintStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    AI_ANALYZED = "AI_ANALYZED"
    REVIEWED = "REVIEWED"
    ASSIGNED = "ASSIGNED"
    ON_THE_WAY = "ON_THE_WAY"
    ARRIVED = "ARRIVED"
    COLLECTED = "COLLECTED"
    PROOF_UPLOADED = "PROOF_UPLOADED"
    VERIFIED = "VERIFIED"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"


#: Ordered lifecycle used to render the citizen-facing tracking timeline.
COMPLAINT_TIMELINE: tuple[str, ...] = (
    ComplaintStatus.SUBMITTED.value,
    ComplaintStatus.AI_ANALYZED.value,
    ComplaintStatus.REVIEWED.value,
    ComplaintStatus.ASSIGNED.value,
    ComplaintStatus.ON_THE_WAY.value,
    ComplaintStatus.ARRIVED.value,
    ComplaintStatus.COLLECTED.value,
    ComplaintStatus.PROOF_UPLOADED.value,
    ComplaintStatus.VERIFIED.value,
    ComplaintStatus.RESOLVED.value,
)

OPEN_STATUSES = (
    ComplaintStatus.SUBMITTED.value,
    ComplaintStatus.AI_ANALYZED.value,
    ComplaintStatus.REVIEWED.value,
    ComplaintStatus.ASSIGNED.value,
    ComplaintStatus.ON_THE_WAY.value,
    ComplaintStatus.ARRIVED.value,
    ComplaintStatus.COLLECTED.value,
    ComplaintStatus.PROOF_UPLOADED.value,
    ComplaintStatus.VERIFIED.value,
)


class PriorityLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class PickupStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    ASSIGNED = "ASSIGNED"
    ON_THE_WAY = "ON_THE_WAY"
    COLLECTED = "COLLECTED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


PICKUP_TIMELINE: tuple[str, ...] = (
    PickupStatus.REQUESTED.value,
    PickupStatus.ASSIGNED.value,
    PickupStatus.ON_THE_WAY.value,
    PickupStatus.COLLECTED.value,
    PickupStatus.COMPLETED.value,
)


class EvidenceType(str, enum.Enum):
    BEFORE = "BEFORE"
    AFTER = "AFTER"


class NotificationType(str, enum.Enum):
    INFO = "INFO"
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    ALERT = "ALERT"
