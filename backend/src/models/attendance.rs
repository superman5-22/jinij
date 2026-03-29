use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// 勤怠レコード
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AttendanceRecord {
    pub id:            Uuid,
    pub employee_id:   Uuid,
    pub user_id:       Uuid,
    pub work_date:     NaiveDate,
    pub clock_in:      Option<DateTime<Utc>>,
    pub clock_out:     Option<DateTime<Utc>>,
    pub break_minutes: i32,
    pub status:        String,
    pub note:          Option<String>,
    pub created_at:    DateTime<Utc>,
    pub updated_at:    DateTime<Utc>,
}

/// 出勤打刻リクエスト
#[derive(Debug, Deserialize)]
pub struct ClockInRequest {
    pub employee_id: Uuid,
    pub note:        Option<String>,
}

/// 退勤打刻リクエスト
#[derive(Debug, Deserialize)]
pub struct ClockOutRequest {
    pub employee_id:   Uuid,
    pub break_minutes: Option<i32>,
    pub note:          Option<String>,
}

/// 月次サマリーレスポンス
#[derive(Debug, Serialize)]
pub struct MonthlySummary {
    pub year:               i32,
    pub month:              u32,
    pub total_work_days:    i64,
    pub total_work_minutes: i64,
    pub absent_days:        i64,
    pub late_days:          i64,
    pub records:            Vec<AttendanceRecord>,
}

/// 今日の打刻状態クエリパラメーター
#[derive(Debug, Deserialize)]
pub struct TodayQuery {
    pub employee_id: Uuid,
}

/// 月次取得クエリパラメーター
#[derive(Debug, Deserialize)]
pub struct MonthlyQuery {
    pub year:  i32,
    pub month: u32,
}
