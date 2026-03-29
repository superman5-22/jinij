use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use chrono::{Datelike, Local, NaiveDate, Utc};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    middleware::auth::AuthUser,
    models::attendance::{
        AttendanceRecord, ClockInRequest, ClockOutRequest, MonthlyQuery, MonthlySummary,
        TodayQuery,
    },
    AppState,
};

/// POST /api/v1/attendance/clock-in
/// 出勤打刻。同一日に既存レコードがある場合は 400 を返す。
pub async fn clock_in(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(body): Json<ClockInRequest>,
) -> Result<Json<Value>> {
    let today = Local::now().date_naive();
    let now   = Utc::now();

    // 当日の重複チェック
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM attendance_records WHERE employee_id = $1 AND work_date = $2",
    )
    .bind(body.employee_id)
    .bind(today)
    .fetch_one(&state.db)
    .await?;

    if exists > 0 {
        return Err(AppError::BadRequest(
            "本日はすでに出勤打刻済みです".to_string(),
        ));
    }

    let record = sqlx::query_as!(
        AttendanceRecord,
        r#"
        INSERT INTO attendance_records
            (employee_id, user_id, work_date, clock_in, status, note)
        VALUES ($1, $2, $3, $4, 'present', $5)
        RETURNING *
        "#,
        body.employee_id,
        auth_user.id,
        today,
        now,
        body.note,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({ "message": "出勤しました", "record": record })))
}

/// POST /api/v1/attendance/clock-out
/// 退勤打刻。当日の出勤レコードが存在しない場合は 400 を返す。
pub async fn clock_out(
    State(state): State<AppState>,
    Extension(_auth_user): Extension<AuthUser>,
    Json(body): Json<ClockOutRequest>,
) -> Result<Json<Value>> {
    let today         = Local::now().date_naive();
    let now           = Utc::now();
    let break_minutes = body.break_minutes.unwrap_or(0).max(0);

    let record = sqlx::query_as!(
        AttendanceRecord,
        r#"
        UPDATE attendance_records
        SET clock_out     = $1,
            break_minutes = $2,
            note          = COALESCE($3, note),
            updated_at    = NOW()
        WHERE employee_id = $4
          AND work_date   = $5
          AND clock_out IS NULL
        RETURNING *
        "#,
        now,
        break_minutes,
        body.note,
        body.employee_id,
        today,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| {
        AppError::BadRequest(
            "本日の出勤記録が見つかりません（すでに退勤済みの可能性があります）".to_string(),
        )
    })?;

    Ok(Json(json!({ "message": "退勤しました", "record": record })))
}

/// GET /api/v1/attendance/today?employee_id=xxx
/// 今日の打刻状態を取得する。
pub async fn get_today(
    State(state): State<AppState>,
    Extension(_auth_user): Extension<AuthUser>,
    Query(params): Query<TodayQuery>,
) -> Result<Json<Value>> {
    let today = Local::now().date_naive();

    let record = sqlx::query_as!(
        AttendanceRecord,
        "SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2",
        params.employee_id,
        today,
    )
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(json!({ "record": record })))
}

/// GET /api/v1/attendance/:employee_id/monthly?year=2026&month=3
/// 指定月の勤怠一覧とサマリーを返す。
pub async fn get_monthly(
    State(state): State<AppState>,
    Extension(_auth_user): Extension<AuthUser>,
    Path(employee_id): Path<Uuid>,
    Query(params): Query<MonthlyQuery>,
) -> Result<Json<Value>> {
    let start_date = NaiveDate::from_ymd_opt(params.year, params.month, 1)
        .ok_or_else(|| AppError::BadRequest("無効な年月です".to_string()))?;

    let end_date = if params.month == 12 {
        NaiveDate::from_ymd_opt(params.year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(params.year, params.month + 1, 1)
    }
    .ok_or_else(|| AppError::BadRequest("無効な年月です".to_string()))?;

    let records = sqlx::query_as!(
        AttendanceRecord,
        r#"
        SELECT * FROM attendance_records
        WHERE employee_id = $1
          AND work_date  >= $2
          AND work_date   < $3
        ORDER BY work_date ASC
        "#,
        employee_id,
        start_date,
        end_date,
    )
    .fetch_all(&state.db)
    .await?;

    let total_work_days = records.len() as i64;
    let total_work_minutes: i64 = records
        .iter()
        .filter_map(|r| {
            if let (Some(ci), Some(co)) = (r.clock_in, r.clock_out) {
                let minutes = (co - ci).num_minutes() - r.break_minutes as i64;
                Some(minutes.max(0))
            } else {
                None
            }
        })
        .sum();
    let absent_days = records.iter().filter(|r| r.status == "absent").count() as i64;
    let late_days   = records.iter().filter(|r| r.status == "late").count() as i64;

    let summary = MonthlySummary {
        year: params.year,
        month: params.month,
        total_work_days,
        total_work_minutes,
        absent_days,
        late_days,
        records,
    };

    Ok(Json(serde_json::to_value(summary).unwrap()))
}
