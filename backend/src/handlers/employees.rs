use axum::{
    extract::{Path, State},
    http::header,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::{errors::Result, models::employee::EmployeeCsvRow, AppState};

/// GET /api/v1/employees/export.csv
/// 全従業員データを CSV 形式でエクスポート。
/// Rust 側で UTF-8 BOM 付き CSV を生成（Excel での文字化け対策）。
pub async fn export_csv(State(state): State<AppState>) -> Result<impl IntoResponse> {
    let rows = sqlx::query!(
        r#"
        SELECT
            e.employee_code,
            e.full_name,
            COALESCE(e.full_name_kana, '')   AS full_name_kana,
            e.email,
            COALESCE(e.phone, '')            AS phone,
            COALESCE(d.name, '')             AS department,
            e.position,
            e.employment_type,
            e.hire_date::TEXT                AS hire_date,
            e.status,
            e.annual_leave_balance
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        ORDER BY e.employee_code
        "#
    )
    .fetch_all(&state.db)
    .await?;

    let mut wtr = csv::WriterBuilder::new()
        .has_headers(true)
        .from_writer(vec![]);

    // ヘッダー
    wtr.write_record([
        "社員コード", "氏名", "氏名（カナ）", "メール", "電話",
        "部署", "役職", "雇用形態", "入社日", "状態", "有給残日数",
    ])
    .map_err(|e| anyhow::anyhow!(e))?;

    for r in rows {
        let emp_type_label = match r.employment_type.as_str() {
            "full_time"  => "正社員",
            "part_time"  => "パート・アルバイト",
            "contract"   => "契約社員",
            "temporary"  => "派遣社員",
            other        => other,
        };
        let status_label = match r.status.as_str() {
            "active"   => "在職",
            "inactive" => "退職",
            "on_leave" => "休職中",
            other      => other,
        };

        wtr.write_record([
            &r.employee_code,
            &r.full_name,
            r.full_name_kana.as_deref().unwrap_or(""),
            &r.email,
            r.phone.as_deref().unwrap_or(""),
            r.department.as_deref().unwrap_or(""),
            &r.position,
            emp_type_label,
            r.hire_date.as_deref().unwrap_or(""),
            status_label,
            &r.annual_leave_balance.to_string(),
        ])
        .map_err(|e| anyhow::anyhow!(e))?;
    }

    let mut csv_bytes = wtr.into_inner().map_err(|e| anyhow::anyhow!(e))?;

    // UTF-8 BOM を先頭に追加（Excel 対策）
    let mut with_bom = vec![0xEF_u8, 0xBB, 0xBF];
    with_bom.append(&mut csv_bytes);

    let headers = [
        (
            header::CONTENT_TYPE,
            "text/csv; charset=utf-8".to_string(),
        ),
        (
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"employees.csv\"".to_string(),
        ),
    ];

    Ok((headers, with_bom))
}
