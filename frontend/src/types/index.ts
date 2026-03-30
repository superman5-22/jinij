// ============================================================
// 型定義
// ============================================================

export type UserRole = 'employee' | 'manager' | 'hr' | 'admin'
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'temporary'
export type EmployeeStatus = 'active' | 'inactive' | 'on_leave'
export type LeaveType = 'annual' | 'sick' | 'personal' | 'bereavement' | 'other'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  name: string
  code: string | null
  description: string | null
  created_at: string
}

export interface Employee {
  id: string
  user_id: string | null
  employee_code: string
  full_name: string
  full_name_kana: string | null
  email: string
  phone: string | null
  department_id: string | null
  position: string
  employment_type: EmploymentType
  hire_date: string
  birth_date: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  status: EmployeeStatus
  annual_leave_balance: number
  notes: string | null
  created_at: string
  updated_at: string
  // JOIN
  department?: Department | null
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days_count: number
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_comment: string | null
  created_at: string
  updated_at: string
  // JOIN
  employee?: Employee | null
  reviewer?: Profile | null
}

export interface DashboardSummary {
  total_employees: number
  active_employees: number
  on_leave_today: number
  pending_leave_requests: number
  new_hires_this_month: number
  departments_count: number
}

// フォーム用
export interface DepartmentFormData {
  name: string
  code: string
  description: string
}

export interface EmployeeFormData {
  employee_code: string
  full_name: string
  full_name_kana: string
  email: string
  phone: string
  department_id: string
  position: string
  employment_type: EmploymentType
  hire_date: string
  birth_date: string
  address: string
  emergency_contact_name: string
  emergency_contact_phone: string
  status: EmployeeStatus
  annual_leave_balance: number
  notes: string
}

export interface LeaveRequestFormData {
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  days_count: number
  reason: string
}

// フィルター
export interface EmployeeFilters {
  search: string
  department_id: string
  status: EmployeeStatus | ''
  employment_type: EmploymentType | ''
}

export interface LeaveFilters {
  employee_id: string
  status: LeaveStatus | ''
  leave_type: LeaveType | ''
  date_from: string
  date_to: string
}

// 通知
export type NotificationType = 'leave_approved' | 'leave_rejected' | 'leave_submitted' | 'system'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  related_id: string | null
  is_read: boolean
  created_at: string
}

// 勤怠管理
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'early_leave' | 'holiday' | 'remote'

export interface AttendanceRecord {
  id:            string
  employee_id:   string
  user_id:       string
  work_date:     string        // ISO date string 'YYYY-MM-DD'
  clock_in:      string | null // ISO datetime string
  clock_out:     string | null // ISO datetime string
  break_minutes: number
  status:        AttendanceStatus
  note:          string | null
  created_at:    string
  updated_at:    string
}

export interface AttendanceMonthlySummary {
  year:               number
  month:              number
  total_work_days:    number
  total_work_minutes: number
  absent_days:        number
  late_days:          number
  records:            AttendanceRecord[]
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present:     '出勤',
  absent:      '欠勤',
  late:        '遅刻',
  early_leave: '早退',
  holiday:     '休日',
  remote:      'リモート',
}

// 給与管理
export interface SalaryRecord {
  id:           string
  employee_id:  string
  year:         number
  month:        number
  base_salary:  number
  overtime_pay: number
  allowances:   number
  deductions:   number
  net_salary:   number  // Generated column: base + overtime + allowances - deductions
  paid_at:      string | null  // ISO date 'YYYY-MM-DD'
  notes:        string | null
  created_by:   string | null
  created_at:   string
  updated_at:   string
  // JOIN
  employee?: Employee | null
}

export interface SalaryFormData {
  employee_id:  string
  year:         number
  month:        number
  base_salary:  number
  overtime_pay: number
  allowances:   number
  deductions:   number
  paid_at:      string
  notes:        string
}

export interface SalaryFilters {
  employee_id: string
  year:        number | ''
  month:       number | ''
}

// ============================================================
// 人事評価
// ============================================================
export type ReviewType   = 'quarterly' | 'semi_annual' | 'annual'
export type ReviewStatus = 'draft' | 'submitted' | 'acknowledged'

export interface PerformanceReview {
  id:                 string
  employee_id:        string
  reviewer_id:        string | null
  review_year:        number
  review_type:        ReviewType
  review_quarter:     number | null
  overall_rating:     number
  performance_score:  number
  behavior_score:     number
  skill_score:        number
  goals_achievement:  string | null
  strengths:          string | null
  improvements:       string | null
  next_goals:         string | null
  self_comment:       string | null
  reviewer_comment:   string | null
  status:             ReviewStatus
  submitted_at:       string | null
  acknowledged_at:    string | null
  created_by:         string | null
  created_at:         string
  updated_at:         string
  // JOIN
  employee?: Employee | null
}

export interface PerformanceReviewFormData {
  employee_id:        string
  review_year:        number
  review_type:        ReviewType
  review_quarter:     number | null
  overall_rating:     number
  performance_score:  number
  behavior_score:     number
  skill_score:        number
  goals_achievement:  string
  strengths:          string
  improvements:       string
  next_goals:         string
  self_comment:       string
  reviewer_comment:   string
}

export interface PerformanceReviewFilters {
  employee_id: string
  review_year: number | ''
  review_type: ReviewType | ''
  status:      ReviewStatus | ''
}

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  quarterly:    '四半期評価',
  semi_annual:  '半期評価',
  annual:       '年次評価',
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft:        '作成中',
  submitted:    '提出済み',
  acknowledged: '確認済み',
}

export const RATING_LABELS: Record<number, string> = {
  1: 'S（卓越）',
  2: 'A（優秀）',
  3: 'B（標準）',
  4: 'C（要改善）',
  5: 'D（不十分）',
}

// ============================================================
// お知らせ（掲示板）
// ============================================================
export type AnnouncementCategory = 'general' | 'important' | 'event' | 'hr'

export interface Announcement {
  id:           string
  title:        string
  content:      string
  category:     AnnouncementCategory
  is_pinned:    boolean
  published_at: string | null  // ISO datetime, null = 下書き
  expires_at:   string | null  // ISO datetime, null = 無期限
  created_by:   string | null
  created_at:   string
  updated_at:   string
}

export interface AnnouncementFormData {
  title:        string
  content:      string
  category:     AnnouncementCategory
  is_pinned:    boolean
  published_at: string  // '' = 下書き
  expires_at:   string  // '' = 無期限
}

export interface AnnouncementFilters {
  category:    AnnouncementCategory | ''
  include_drafts: boolean
}

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  general:   '一般',
  important: '重要',
  event:     'イベント',
  hr:        '人事',
}

export const ANNOUNCEMENT_CATEGORY_COLORS: Record<AnnouncementCategory, string> = {
  general:   'secondary',
  important: 'danger',
  event:     'success',
  hr:        'primary',
}

// ページネーション
export interface Pagination {
  page: number
  per_page: number
  total: number
}

// ラベルマップ (UI 表示用)
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time:  '正社員',
  part_time:  'パート・アルバイト',
  contract:   '契約社員',
  temporary:  '派遣社員',
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active:   '在職',
  inactive: '退職',
  on_leave: '休職中',
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual:      '年次有給休暇',
  sick:        '病気休暇',
  personal:    '私用休暇',
  bereavement: '忌引き休暇',
  other:       'その他',
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending:   '承認待ち',
  approved:  '承認済み',
  rejected:  '却下',
  cancelled: 'キャンセル',
}
