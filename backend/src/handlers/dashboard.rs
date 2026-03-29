use axum::{extract::State, Json};
use chrono::Local;

use crate::{errors::Result, models::employee::DashboardSummary, AppState};

/// GET /api/v1/dashboard
/// 複数テーブルの集計を一発で返すエンドポイント。
/// Vue から個別に並列クエリを投げるより、この集計をサーバーサイドで行う。
pub async fn get_summary(State(state): State<AppState>) -> Result<Json<DashboardSummary>> {
    let today = Local::now().date_naive();
    let first_of_month = today
        .with_day(1)
        .unwrap_or(today);

    let row = sqlx::query!(
        r#"
        SELECT
            (SELECT COUNT(*) FROM employees)::BIGINT                                    AS total_employees,
            (SELECT COUNT(*) FROM employees WHERE status = 'active')::BIGINT            AS active_employees,
            (SELECT COUNT(*) FROM leave_requests
             WHERE status = 'approved'
               AND start_date <= $1 AND end_date >= $1)::BIGINT                         AS on_leave_today,
            (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending')::BIGINT      AS pending_leave_requests,
            (SELECT COUNT(*) FROM employees
             WHERE hire_date >= $2 AND status = 'active')::BIGINT                       AS new_hires_this_month,
            (SELECT COUNT(*) FROM departments)::BIGINT                                  AS departments_count
        "#,
        today,
        first_of_month,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(DashboardSummary {
        total_employees:        row.total_employees.unwrap_or(0),
        active_employees:       row.active_employees.unwrap_or(0),
        on_leave_today:         row.on_leave_today.unwrap_or(0),
        pending_leave_requests: row.pending_leave_requests.unwrap_or(0),
        new_hires_this_month:   row.new_hires_this_month.unwrap_or(0),
        departments_count:      row.departments_count.unwrap_or(0),
    }))
}

// chrono の day() を使うためのトレイト
use chrono::Datelike;
