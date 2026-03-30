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

// お知らせ
export type AnnouncementCategory = 'general' | 'hr' | 'event' | 'urgent'

export interface Announcement {
  id:           string
  title:        string
  body:         string
  category:     AnnouncementCategory
  is_pinned:    boolean
  published_at: string | null
  expires_at:   string | null
  created_by:   string
  created_at:   string
  updated_at:   string
  // JOIN (既読状態)
  is_read?:     boolean
  author?:      Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

export interface AnnouncementFormData {
  title:        string
  body:         string
  category:     AnnouncementCategory
  is_pinned:    boolean
  published_at: string  // ISO datetime string or ''
  expires_at:   string  // ISO datetime string or ''
}

export interface AnnouncementFilters {
  category: AnnouncementCategory | ''
  keyword:  string
  show_all: boolean  // HR/admin: 下書き含む全件表示フラグ
}

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  general: '一般',
  hr:      '人事',
  event:   'イベント',
  urgent:  '緊急',
}

export const ANNOUNCEMENT_CATEGORY_COLORS: Record<AnnouncementCategory, string> = {
  general: 'secondary',
  hr:      'primary',
  event:   'info',
  urgent:  'danger',
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
