/**
 * Domain metadata: labels, colours and icons for every backend enum value.
 * The backend is the source of truth for values; this file only describes them.
 */
import {
  AlertTriangle,
  Ban,
  BatteryCharging,
  Beaker,
  Bell,
  Bike,
  Boxes,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Clock,
  FileText,
  Flame,
  GlassWater,
  Home,
  Leaf,
  Package,
  Recycle,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  UserCheck,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { ComplaintCategory, ComplaintStatus, PickupStatus, PriorityLevel } from "./types";

export type Tone = "slate" | "emerald" | "amber" | "red" | "blue" | "violet" | "cyan";

/** Tailwind class sets per tone (kept static so the compiler can see them). */
export const TONE_CLASSES: Record<Tone, string> = {
  slate: "bg-ink-100 text-ink-700 ring-ink-200",
  emerald: "bg-brand-50 text-brand-700 ring-brand-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
};

export const TONE_SOLID: Record<Tone, string> = {
  slate: "bg-ink-500",
  emerald: "bg-brand-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
};

export type Meta = { label: string; tone: Tone; icon: LucideIcon };

/* ------------------------------------------------------------------ priority */

export const PRIORITY_META: Record<PriorityLevel, Meta & { hint: string }> = {
  LOW: { label: "Low", tone: "slate", icon: Leaf, hint: "Routine collection" },
  MEDIUM: { label: "Medium", tone: "cyan", icon: CircleDashed, hint: "Schedule within 48 h" },
  HIGH: { label: "High", tone: "amber", icon: AlertTriangle, hint: "Attend within 24 h" },
  CRITICAL: {
    label: "Critical",
    tone: "red",
    icon: Flame,
    hint: "Rapid response within 6 h",
  },
};

export const PRIORITY_ORDER: PriorityLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/* -------------------------------------------------------------------- status */

export const STATUS_META: Record<ComplaintStatus, Meta> = {
  SUBMITTED: { label: "Submitted", tone: "slate", icon: FileText },
  AI_ANALYZED: { label: "AI Analyzed", tone: "violet", icon: Sparkles },
  REVIEWED: { label: "Admin Reviewed", tone: "cyan", icon: Search },
  ASSIGNED: { label: "Worker Assigned", tone: "blue", icon: UserCheck },
  ON_THE_WAY: { label: "On The Way", tone: "blue", icon: Truck },
  ARRIVED: { label: "Arrived On Site", tone: "cyan", icon: Bike },
  COLLECTED: { label: "Collected", tone: "emerald", icon: Trash2 },
  PROOF_UPLOADED: { label: "Proof Uploaded", tone: "emerald", icon: ShieldCheck },
  VERIFIED: { label: "Verified", tone: "emerald", icon: ClipboardCheck },
  RESOLVED: { label: "Resolved", tone: "emerald", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", tone: "red", icon: Ban },
};

export const STATUS_ORDER: ComplaintStatus[] = [
  "SUBMITTED",
  "AI_ANALYZED",
  "REVIEWED",
  "ASSIGNED",
  "ON_THE_WAY",
  "ARRIVED",
  "COLLECTED",
  "PROOF_UPLOADED",
  "VERIFIED",
  "RESOLVED",
];

export const PICKUP_STATUS_META: Record<PickupStatus, Meta> = {
  REQUESTED: { label: "Requested", tone: "slate", icon: CalendarClock },
  ASSIGNED: { label: "Crew Assigned", tone: "blue", icon: UserCheck },
  ON_THE_WAY: { label: "On The Way", tone: "blue", icon: Truck },
  COLLECTED: { label: "Collected", tone: "emerald", icon: Trash2 },
  COMPLETED: { label: "Completed", tone: "emerald", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", tone: "red", icon: Ban },
};

export const WORKER_STATUS_META: Record<string, Meta> = {
  AVAILABLE: { label: "Available", tone: "emerald", icon: CheckCircle2 },
  BUSY: { label: "On Job", tone: "amber", icon: Clock },
  OFFLINE: { label: "Offline", tone: "slate", icon: CircleDashed },
};

/* ------------------------------------------------------------------ category */

export const CATEGORY_META: Record<ComplaintCategory, Meta & { blurb: string }> = {
  OVERFLOWING_BIN: {
    label: "Overflowing Bin",
    tone: "amber",
    icon: Trash2,
    blurb: "Dustbin full, lid open or waste spilling out",
  },
  GARBAGE_ON_ROAD: {
    label: "Garbage on Road",
    tone: "red",
    icon: Waves,
    blurb: "Waste dumped in the open, on kerbs or in drains",
  },
  ILLEGAL_DUMPING: {
    label: "Illegal Dumping",
    tone: "red",
    icon: Ban,
    blurb: "Bulk or hazardous waste dumped at an unauthorised spot",
  },
  MISSED_COLLECTION: {
    label: "Missed Collection",
    tone: "blue",
    icon: CalendarClock,
    blurb: "Household or commercial waste not picked up on schedule",
  },
  IMPROPER_SEGREGATION: {
    label: "Improper Segregation",
    tone: "violet",
    icon: Recycle,
    blurb: "Wet, dry and hazardous waste mixed in one bin",
  },
  OTHER: {
    label: "Other Issue",
    tone: "slate",
    icon: Boxes,
    blurb: "Anything else - describe it in the next step",
  },
};

export const CATEGORY_ORDER: ComplaintCategory[] = [
  "OVERFLOWING_BIN",
  "GARBAGE_ON_ROAD",
  "ILLEGAL_DUMPING",
  "MISSED_COLLECTION",
  "IMPROPER_SEGREGATION",
  "OTHER",
];

/* --------------------------------------------------------------------- wards */

export const WARDS = [
  "Barauna",
  "Kakadeo",
  "Amanipur",
  "Kidarpur",
  "Kalyanpur",
  "Cement Factory",
  "Ghusanganj",
  "Nausahra",
  "Azamgarh",
  "Colelganj",
] as const;

export const WARD_COORDS: Record<string, { lat: number; lon: number }> = {
  Barauna: { lat: 26.4302, lon: 80.3121 },
  Kakadeo: { lat: 26.4518, lon: 80.3388 },
  Amanipur: { lat: 26.4618, lon: 80.3062 },
  Kidarpur: { lat: 26.4558, lon: 80.2884 },
  Kalyanpur: { lat: 26.4385, lon: 80.3505 },
  "Cement Factory": { lat: 26.472, lon: 80.326 },
  Ghusanganj: { lat: 26.4188, lon: 80.286 },
  Nausahra: { lat: 26.405, lon: 80.336 },
  Azamgarh: { lat: 26.4679, lon: 80.3443 },
  Colelganj: { lat: 26.442, lon: 80.3161 },
};

export const CITY_CENTER: { lat: number; lon: number } = { lat: 26.4499, lon: 80.3319 };

/* -------------------------------------------------------------- pickup waste */

export const PICKUP_WASTE_TYPES = [
  "E-Waste",
  "Plastic",
  "Paper",
  "Glass",
  "Metal",
  "Textiles",
  "Household Bulk",
  "Hazardous",
] as const;

export const BIN_COLOURS: Record<string, { tone: Tone; icon: LucideIcon }> = {
  "Wet Waste": { tone: "emerald", icon: Leaf },
  "Dry Waste": { tone: "blue", icon: Package },
  Plastic: { tone: "cyan", icon: Recycle },
  Paper: { tone: "amber", icon: FileText },
  Glass: { tone: "violet", icon: GlassWater },
  "E-Waste": { tone: "blue", icon: BatteryCharging },
  "Hazardous Waste": { tone: "red", icon: Beaker },
  "Medical Waste": { tone: "red", icon: ShieldCheck },
};

/* ---------------------------------------------------------------- nav config */

/** Nav shown to signed-out visitors on public pages (e.g. /awareness). */
export const PUBLIC_NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/awareness", label: "Waste Awareness", icon: Recycle },
  { to: "/login", label: "Sign in", icon: UserCheck },
] as const;

export const CITIZEN_NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: Home },
  { to: "/app/report", label: "Report Waste", icon: Sparkles },
  { to: "/app/pickup", label: "Pickup Request", icon: Truck },
  { to: "/app/complaints", label: "My Complaints", icon: ClipboardCheck },
  { to: "/app/notifications", label: "Notifications", icon: Bell },
  { to: "/app/awareness", label: "Waste Awareness", icon: Recycle },
  { to: "/app/eco-points", label: "Eco Points", icon: Leaf },
  { to: "/app/profile", label: "Profile", icon: UserCheck },
] as const;

export const WORKER_NAV = [
  { to: "/worker", label: "Dashboard", icon: Home },
  { to: "/worker/tasks", label: "My Tasks", icon: ClipboardCheck },
  { to: "/worker/task", label: "Active Task", icon: Truck },
  { to: "/worker/completed", label: "Completed", icon: CheckCircle2 },
  { to: "/worker/profile", label: "Profile", icon: Home },
] as const;

export const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", icon: Home },
  { to: "/admin/complaints", label: "Complaints", icon: ClipboardCheck },
  { to: "/admin/queue", label: "Priority Queue", icon: Flame },
  { to: "/admin/hotspots", label: "Hotspot Map", icon: Search },
  { to: "/admin/pickups", label: "Pickup Requests", icon: Truck },
  { to: "/admin/workers", label: "Workers", icon: UserCheck },
  { to: "/admin/analytics", label: "Analytics", icon: Sparkles },
  { to: "/admin/awareness", label: "Awareness", icon: Recycle },
  { to: "/admin/settings", label: "Settings", icon: ShieldCheck },
] as const;
