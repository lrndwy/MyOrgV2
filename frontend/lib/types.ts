import type { ReactNode } from "react"

export interface ApiEnvelope<T = unknown> {
  success: boolean
  message: string
  data?: T
  errors?: Record<string, string[]>
}

export interface User {
  id: number
  username: string
  email: string
  full_name: string
  birth_date?: string | null
  hometown?: string | null
  phone?: string | null
  avatar_url?: string | null
  division_id?: number | null
  role_id?: number | null
  status?: string
  division?: string | Division | null
  role?: string | Role | null
  violation_count?: number
}

export interface Division {
  id: number
  name: string
  description?: string | null
}

export interface Role {
  id: number
  name: string
  description?: string | null
  is_system?: boolean
  user_count?: number
}

export interface Permission {
  id: number
  code: string
  module: string
  description?: string | null
}

export interface OrganizationSettings {
  web_name?: string
  logo_url?: string | null
  icon_url?: string | null
  theme?: "light" | "dark" | "system"
  appearance?: string
  allow_self_register?: boolean
  allow_cross_division_events_view?: boolean
}

export interface Event {
  id: number
  title: string
  description?: string | null
  division_id?: number | null
  division?: Division | string | null
  location?: string | null
  start_time: string
  end_time: string
  status: "upcoming" | "ongoing" | "finished" | string
  allow_permission?: boolean
  banner_url?: string | null
  banner_image_url?: string | null
  my_attendance_status?: string | null
  my_permission_request_status?: string | null
}

export interface Attendance {
  id: number
  event_id: number
  user_id: number
  status: string
  selfie_url?: string | null
  signature_url?: string | null
  attended_at?: string | null
  checked_in_at?: string | null
  full_name?: string | null
  user?: User
}

export interface EventRecap {
  event: Event
  summary?: {
    present: number
    permitted: number
    absent: number
    total: number
  }
  attendances?: Attendance[]
}

export interface PermissionRequest {
  id: number
  event_id: number
  user_id: number
  reason?: string | null
  proof_url?: string | null
  status: "pending" | "approved" | "rejected" | string
  note?: string | null
  created_at?: string
  event?: Event
  user?: User
}

export interface Announcement {
  id: number
  title: string
  content?: string | null
  banner_url?: string | null
  target_type?: string
  created_at?: string
  updated_at?: string
  attachments?: AnnouncementAttachment[]
}

export interface AnnouncementAttachment {
  id: number
  announcement_id: number
  file_url: string
  file_type?: string
}

export interface Violation {
  id: number
  user_id: number
  type?: string
  violation_type?: string
  description?: string | null
  sp_level?: string
  document_url?: string | null
  issued_at?: string
  issued_date?: string
  user?: User
}

export interface ViolationType {
  id: number
  name: string
  description?: string | null
  sp_level?: string
}

export interface Recruitment {
  id: number
  title: string
  slug: string
  description?: string | null
  is_active?: boolean
  fields?: RecruitmentField[]
  created_at?: string
}

export interface RecruitmentField {
  name: string
  label: string
  type: string
  required?: boolean
}

export interface RecruitmentSubmission {
  id: number
  recruitment_id: number
  data: Record<string, unknown>
  created_at?: string
}

export interface LetterCategory {
  id: number
  name: string
  code?: string
  start_number?: number
  current_number?: number
  number_format_template?: string
}

export interface Letter {
  id: number
  type: "incoming" | "outgoing" | string
  letter_code?: string
  subject?: string
  sender?: string | null
  recipient?: string | null
  category_id?: number
  category?: LetterCategory
  attachment_url?: string | null
  document_url?: string | null
  created_at?: string
}

export interface FinanceCategory {
  id: number
  name: string
  type?: string
}

export interface Wallet {
  id: number
  name: string
  description?: string | null
  initial_balance?: number
  is_active?: boolean
  total_income?: number
  total_expense?: number
  balance?: number
  transaction_count?: number
  created_at?: string
}

export interface FinanceTransaction {
  id: number
  category_id?: number
  category?: FinanceCategory
  wallet_id?: number | null
  amount: number
  type: "income" | "expense" | string
  description?: string | null
  receipt_url?: string | null
  transaction_date?: string
  created_at?: string
}

export interface StorageFile {
  id: number
  folder_id?: number | null
  name: string
  file_url: string
  mime_type?: string
  size_bytes?: number
  created_at?: string
}

export interface StorageFolder {
  id: number
  name: string
  parent_id?: number | null
}

export interface LetterTemplate {
  id: number
  name: string
  category_id: number
  template_url?: string
}

export interface FinanceSummary {
  total_income?: number
  total_expense?: number
  income?: number
  expense?: number
  initial_balance?: number
  balance?: number
}

export interface FinanceDashboard {
  summary?: FinanceSummary
  recent_transactions?: FinanceTransaction[]
  wallets?: Wallet[]
}

export interface Paginated<T> {
  items: T[]
  total?: number
  page?: number
  per_page?: number
}

export interface LoginResponse {
  token: string
  user: User
}

export interface NavItem {
  title: string
  url: string
  icon?: ReactNode
  permission?: string | string[]
  items?: { title: string; url: string; permission?: string | string[] }[]
}

export interface ActivityLog {
  id: number
  user_id: number
  user_name: string
  action: string
  resource_type: string
  resource_id: number
  description: string
  ip_address: string
  created_at: string
}
