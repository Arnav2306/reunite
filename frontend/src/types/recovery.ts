export interface CampusBlockItem {
  id: number;
  code: string;
  name: string;
  description: string;
}

export interface CollectionPoint {
  id: number;
  public_id: string;
  station_code: string;
  building: string;
  block?: number | null;
  block_details?: CampusBlockItem | null;
  requires_block_confirmation?: boolean;
  floor: string;
  station_type: string;
  status: 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED' | string;
  capacity: number;
  current_count: number;
  zone: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  directions?: string;
  map_link?: string;
  opening_hours?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

export interface CampusConfig {
  id?: number;
  name: string;
  address: string;
  locality: string;
  city: string;
  state: string;
  country?: string;
  pin_code: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  maps_link: string;
  is_configured: boolean;
  updated_at?: string;
}

export interface AvailableItem {
  id?: number;
  public_id: string;
  title: string;
  category: string;
  description: string;
  found_date?: string;
  found_location?: string;
  status?: string;
  risk_tier: number;
  is_published: boolean;
  published_at?: string;
  collection_location?: CollectionPoint;
  images?: Array<{ id: number; image: string; image_url?: string }>;
}

export interface AdminFoundItem extends AvailableItem {
  status: string;
  serial_number?: string;
  imei?: string;
  identifying_marks?: string;
  internal_notes?: string;
  secret_verification_info?: string;
  ai_metadata?: Record<string, any>;
  student_corrections?: Record<string, any>;
  unclaimed_stage?: string;
  disposition_type?: string;
  disposition_notes?: string;
  disposition_date?: string;
}

export interface OwnershipVerification {
  public_id: string;
  question: string;
  student_answer: string;
  verification_result: string;
  submission_timestamp: string;
  version: string;
}

export interface Handover {
  public_id: string;
  found_item?: AdminFoundItem;
  student?: {
    email: string;
    name: string;
  };
  custodian?: {
    email: string;
    name: string;
  };
  is_valuable: boolean;
  otp_expires_at?: string;
  otp_used: boolean;
  failed_otp_attempts: number;
  status: 'PENDING' | 'PENDING_OTP' | 'READY' | 'COMPLETED' | 'FAILED';
  confirmed_at?: string;
  created_at: string;
}

export interface Claim {
  public_id: string;
  found_item: AdminFoundItem;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  admin_notes?: string;
  verification?: OwnershipVerification;
  handover?: Handover;
  created_at: string;
  updated_at: string;
  student?: {
    email: string;
    name: string;
  };
}

export interface AppNotification {
  public_id: string;
  title: string;
  message: string;
  notification_type: string;
  read: boolean;
  created_at: string;
  /** Optional frontend route this notification should navigate to, e.g. '/matches' */
  action_url?: string;
  /** Dedup anchor — public_id of the related object (e.g. lost_item.public_id) */
  related_object_id?: string;
}

export interface AdminStats {
  total_lost?: number;
  total_found: number;
  listed_items?: number;
  active_claims?: number;
  pending_verification?: number;
  ready_for_pickup: number;
  successful_handovers?: number;
  unresolved_items?: number;
  active_stations?: number;
  awaiting_review: number;
  published_available: number;
  in_custody: number;
  risk_valuable: number;
  pending_claims: number;
  valuable_awaiting_verification?: number;
  pending_handovers: number;
  candidate_matches?: number;
  station_tasks?: number;
  cannot_carry_tasks?: number;
  disputes?: number;
}

export interface LostItem {
  id: number;
  public_id: string;
  category: string;
  description: string;
  original_answers?: Record<string, any>;
  normalized_attributes?: Record<string, string>;
  status: string;
  risk_tier: number;
  images?: Array<{ id: number; image: string; image_url?: string }>;
  matches_count?: number;
  user_name?: string;
  user_email?: string;
  created_at: string;
  updated_at: string;
}

export interface MatchItem {
  id: number;
  public_id: string;
  lost_item_id: number;
  lost_item_public_id: string;
  lost_item_category: string;
  lost_item_description: string;
  found_item: AvailableItem;
  score: number;
  label: 'Strong Possible Match' | 'Possible Match' | 'Weak Match' | string;
  score_breakdown: {
    category_score: number;
    attribute_score: number;
    location_score: number;
    time_score: number;
    feature_score: number;
    photo_score: number | null;
    weights_used: Record<string, number>;
    final_score: number;
    algorithm_version: string;
  };
  status: 'CANDIDATE' | 'REVIEWED' | 'DISMISSED' | 'CLAIMED' | string;
  matching_algorithm_version: string;
  created_at: string;
  updated_at: string;
}
