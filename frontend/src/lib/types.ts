/** TypeScript mirrors of the FastAPI response shapes. */

export type Role = "CITIZEN" | "WORKER" | "ADMIN";
export type WorkerStatus = "AVAILABLE" | "BUSY" | "OFFLINE";
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ALERT";

export type ComplaintCategory =
  | "OVERFLOWING_BIN"
  | "GARBAGE_ON_ROAD"
  | "ILLEGAL_DUMPING"
  | "MISSED_COLLECTION"
  | "IMPROPER_SEGREGATION"
  | "OTHER";

export type ComplaintStatus =
  | "SUBMITTED"
  | "AI_ANALYZED"
  | "REVIEWED"
  | "ASSIGNED"
  | "ON_THE_WAY"
  | "ARRIVED"
  | "COLLECTED"
  | "PROOF_UPLOADED"
  | "VERIFIED"
  | "RESOLVED"
  | "REJECTED";

export type PickupStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "ON_THE_WAY"
  | "COLLECTED"
  | "COMPLETED"
  | "CANCELLED";

export type Health = {
  status: string;
  service: string;
  message: string;
  database: string;
  database_error: string | null;
  ai: {
    provider: string;
    model: string;
    live_ai: boolean;
    api_key_configured: boolean;
  };
  verification: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  ward: string | null;
  address: string | null;
  eco_points: number;
  created_at?: string | null;
};

export type Worker = {
  id: number;
  user_id: number;
  name: string;
  email: string | null;
  employee_code: string;
  ward: string;
  zone: string | null;
  vehicle_number: string | null;
  status: WorkerStatus;
  total_assigned: number;
  total_completed: number;
  average_resolution_minutes: number;
  rating: number;
  latitude: number | null;
  longitude: number | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: User;
  worker: Worker | null;
};

export type PriorityComponent = {
  value: number;
  weight: number;
  contribution: number;
  label?: string;
  nearby_count?: number;
};

export type PriorityBreakdown = {
  severity: PriorityComponent;
  age: PriorityComponent;
  proximity: PriorityComponent;
  location: PriorityComponent;
};

export type TimelineEntry = {
  status: string;
  label: string;
  completed: boolean;
  timestamp: string | null;
  note: string | null;
};

export type Evidence = {
  id: number;
  evidence_type: "BEFORE" | "AFTER";
  file_url: string;
  note: string | null;
  cleanliness_score: number | null;
  created_at: string;
};

export type Complaint = {
  id: number;
  complaint_id: string;
  user_id: number;
  citizen_name: string | null;
  category: ComplaintCategory;
  description: string | null;
  image_url: string | null;
  address: string;
  ward: string | null;
  waste_type: string | null;
  issue_type: string | null;
  severity: number | null;
  detected_objects: string[];
  recommended_action: string | null;
  ai_provider: string | null;
  ai_confidence: number | null;
  priority_score: number | null;
  priority_level: PriorityLevel;
  priority_reasons: string[];
  priority_breakdown: PriorityBreakdown;
  status: ComplaintStatus;
  assigned_worker_id: number | null;
  duplicate_group: string | null;
  is_duplicate: boolean;
  merged_into_id: number | null;
  before_cleanliness: number | null;
  after_cleanliness: number | null;
  verification_status: string | null;
  verification_notes: string | null;
  response_minutes: number | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  worker: Worker | null;
  evidence: Evidence[];
  timeline: TimelineEntry[];
  latitude: number;
  longitude: number;
  distance_km: number | null;
};

export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type Pickup = {
  id: number;
  pickup_id: string;
  user_id: number;
  citizen_name: string | null;
  waste_type: string;
  quantity: number;
  unit: string;
  address: string;
  latitude: number;
  longitude: number;
  ward: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  photo_url: string | null;
  status: PickupStatus;
  assigned_worker_id: number | null;
  worker_name: string | null;
  eco_points_awarded: number;
  created_at: string;
  completed_at: string | null;
  timeline: TimelineEntry[];
};

export type AppNotification = {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  complaint_id: string | null;
  pickup_ref: string | null;
  created_at: string;
};

export type AwarenessItem = {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  what_it_is: string;
  which_bin: string;
  how_to_dispose: string;
  recyclable: boolean;
  hazard_level: string;
  accent: string;
  do_list: string[];
  dont_list: string[];
  is_published: boolean;
  updated_at: string;
};

export type Hotspot = {
  id: number;
  code: string;
  label: string;
  ward: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  complaint_count: number;
  critical_count: number;
  open_count: number;
  top_issue: string;
  recommended_action: string;
  intensity: number;
  last_updated: string;
};

export type Overview = {
  total_complaints: number;
  pending_complaints: number;
  critical_complaints: number;
  high_complaints: number;
  medium_complaints: number;
  low_complaints: number;
  resolved_complaints: number;
  resolution_rate: number;
  in_progress_complaints: number;
  avg_response_minutes: number;
  avg_resolution_hours: number;
  active_workers: number;
  total_workers: number;
  citizens: number;
  total_pickups: number;
  pending_pickups: number;
  total_evidence: number;
  open_hotspots: number;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
};

export type Impact = {
  citizens_registered: number;
  reports_resolved: number;
  resolution_rate: number;
  avg_response_minutes: number;
  active_crews: number;
  evidence_photos: number;
  wards_covered: number;
  hotspots_mapped: number;
};

export type AdminOverview = Overview & {
  impact: Impact;
  recent_complaints: Complaint[];
  top_workers: WorkerPerformance[];
  critical_queue: Complaint[];
};

export type TrendPoint = { date: string; reported: number; resolved: number };

export type NamedCount = { category: string; label: string; count: number; share: number };

export type StatusCount = { status: string; count: number };

export type PriorityCount = { level: string; count: number };

export type WardRow = {
  ward: string;
  total: number;
  critical: number;
  pending: number;
  resolution_rate: number;
  avg_response_minutes: number;
};

export type ResponseTimePoint = {
  date: string;
  avg_response_minutes: number;
  reports: number;
};

export type HotspotAnalytics = {
  code: string;
  label: string;
  ward: string;
  latitude: number;
  longitude: number;
  complaint_count: number;
  critical_count: number;
  open_count: number;
  top_issue: string;
  recommended_action: string;
  intensity: number;
};

export type WorkerPerformance = {
  worker_id: number;
  name: string;
  employee_code: string;
  ward: string;
  status: string;
  assigned: number;
  completed: number;
  completion_rate: number;
  proof_images: number;
  avg_resolution_minutes: number;
  rating: number;
};

export type PickupAnalytics = {
  total: number;
  completed: number;
  pending: number;
  by_status: StatusCount[];
  by_waste_type: { waste_type: string; count: number; quantity: number }[];
  total_quantity: number;
  avg_completion_hours: number;
};

export type Analytics = {
  overview: Overview;
  impact: Impact;
  trend: TrendPoint[];
  category_distribution: NamedCount[];
  status_distribution: StatusCount[];
  priority_distribution: PriorityCount[];
  ward_comparison: WardRow[];
  response_times: ResponseTimePoint[];
  hotspots: HotspotAnalytics[];
  worker_performance: WorkerPerformance[];
  pickups: PickupAnalytics;
};

export type CitizenSummary = {
  total_complaints: number;
  resolved_complaints: number;
  pending_complaints: number;
  critical_complaints: number;
  resolution_rate: number;
  total_evidence: number;
};

export type NearbyComplaint = {
  complaint_id: string;
  category: ComplaintCategory;
  address: string;
  ward: string | null;
  priority_level: PriorityLevel;
  latitude: number;
  longitude: number;
  distance_km: number;
};

export type DashboardPayload = {
  summary: CitizenSummary | Overview;
  eco_points: number;
  recent_complaints: Complaint[];
  nearby_hotspots: NearbyComplaint[];
  active_hotspots: HotspotAnalytics[];
};

export type EcoPayload = {
  eco_points: number;
  level: string;
  level_number: number;
  level_icon: string;
  xp_into_level: number;
  next_level: { level: string; needed: number } | null;
  badges: { name: string; icon: string; requirement: number; earned: boolean }[];
  history: { id: number; points: number; reason: string; created_at: string }[];
};

export type WorkerDashboard = {
  worker: Worker;
  summary: {
    today_tasks: number;
    pending: number;
    active: number;
    completed: number;
    critical: number;
    pickups: number;
    avg_resolution_minutes: number;
  };
  pending: Complaint[];
  active: Complaint[];
  completed: Complaint[];
  pickups: Pickup[];
};

export type WorkerSuggestion = {
  id: number;
  name: string;
  employee_code: string;
  ward: string;
  vehicle_number: string | null;
  status: string;
  active_tasks: number;
  distance_km: number;
  eta_minutes: number;
  match_score: number;
};

export type DuplicateGroup = {
  code: string;
  label: string;
  ward: string;
  latitude: number;
  longitude: number;
  complaint_count: number;
  critical_count: number;
  open_count: number;
  top_issue: string;
  recommended_action: string;
  intensity: number;
  member_ids: string[];
  member_refs: number[];
  members: Complaint[];
};

export type AiAnalysis = {
  waste_type: string | null;
  issue_type: string | null;
  severity: number;
  confidence: number;
  detected_objects: string[];
  recommended_action: string | null;
  environmental_risk: string | null;
  description_summary: string | null;
  priority_hint: string | null;
  provider: string;
  raw?: Record<string, unknown> | null;
};

export type PreviewAnalysis = {
  analysis: AiAnalysis;
  severity_reasoning: {
    severity: number;
    priority_hint: string | null;
    factors: string[];
    provider: string;
  };
  priority: {
    score: number;
    level: PriorityLevel;
    reasons: string[];
    breakdown: PriorityBreakdown;
  };
  duplicate_of: {
    complaint_id: string;
    distance_meters: number;
    match_score: number;
  } | null;
  nearby_reports: number;
  ai_status: Health["ai"];
};

export type VerificationResult = {
  status: string;
  before_score: number;
  after_score: number;
  improvement: number;
  notes: string;
  checks: { name: string; passed: boolean; detail: string }[];
  provider: string;
};

export type AskWasteAi = {
  question: string;
  answer: string;
  category: string;
  bin_colour: string;
  recyclable: boolean;
  steps: string[];
  hazard_note: string | null;
  provider: string;
  ai_status: Health["ai"];
  suggested_questions: string[];
};

export type UploadConfig = {
  allowed_types: string[];
  max_bytes: number;
  max_mb: number;
  folders: string[];
  upload_dir_exists: boolean;
};

export type SystemStatus = {
  app: string;
  environment: string;
  database: string;
  ai: Health["ai"];
  verification_provider: string;
  upload_dir: string;
  max_upload_mb: number;
};

export type MapComplaints = {
  items: Complaint[];
  total: number;
  note: string;
};
