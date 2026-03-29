use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LeaveRequest {
    pub id: Uuid,
    pub employee_id: Uuid,
    pub leave_type: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub days_count: f32,
    pub reason: Option<String>,
    pub status: String,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_comment: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// 承認リクエスト本文
#[derive(Debug, Deserialize)]
pub struct ReviewRequest {
    pub comment: Option<String>,
}

/// 残日数バリデーション結果
#[derive(Debug, Serialize)]
pub struct LeaveBalanceCheck {
    pub employee_id: Uuid,
    pub requested_days: f32,
    pub current_balance: i32,
    pub is_sufficient: bool,
    pub balance_after: f32,
}
