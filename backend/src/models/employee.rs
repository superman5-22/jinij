use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Employee {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub employee_code: String,
    pub full_name: String,
    pub full_name_kana: Option<String>,
    pub email: String,
    pub phone: Option<String>,
    pub department_id: Option<Uuid>,
    pub position: String,
    pub employment_type: String,
    pub hire_date: NaiveDate,
    pub birth_date: Option<NaiveDate>,
    pub status: String,
    pub annual_leave_balance: i32,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// ダッシュボード集計用
#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub total_employees: i64,
    pub active_employees: i64,
    pub on_leave_today: i64,
    pub pending_leave_requests: i64,
    pub new_hires_this_month: i64,
    pub departments_count: i64,
}

/// CSV エクスポート行
#[derive(Debug, Serialize)]
pub struct EmployeeCsvRow {
    pub employee_code: String,
    pub full_name: String,
    pub full_name_kana: String,
    pub email: String,
    pub phone: String,
    pub department: String,
    pub position: String,
    pub employment_type: String,
    pub hire_date: String,
    pub status: String,
    pub annual_leave_balance: i32,
}
