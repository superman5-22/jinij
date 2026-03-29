use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    models::leave::LeaveBalanceCheck,
};

/// 休暇申請承認: 残日数チェック付き
///
/// ビジネスルール:
///   1. 対象従業員の annual_leave_balance を確認
///   2. 申請日数 > 残日数 の場合はエラー（有給休暇のみ）
///   3. OK なら leave_requests を approved に更新し、
///      employees の annual_leave_balance を減算する
pub async fn approve_with_balance_check(
    pool: &PgPool,
    request_id: Uuid,
    reviewer_id: Uuid,
    comment: Option<String>,
) -> Result<()> {
    let mut tx = pool.begin().await?;

    // 申請情報を取得
    let req = sqlx::query!(
        r#"
        SELECT lr.id, lr.employee_id, lr.days_count, lr.leave_type, lr.status
        FROM leave_requests lr
        WHERE lr.id = $1
        "#,
        request_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("申請 {} が見つかりません", request_id)))?;

    if req.status != "pending" {
        return Err(AppError::BadRequest(
            "承認待ち状態の申請のみ承認できます".to_string(),
        ));
    }

    // 有給休暇の場合は残日数チェック
    if req.leave_type == "annual" {
        let balance: i32 = sqlx::query_scalar!(
            "SELECT annual_leave_balance FROM employees WHERE id = $1",
            req.employee_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::NotFound("従業員が見つかりません".to_string()))?;

        let days = req.days_count as f32;
        if balance as f32 - days < 0.0 {
            return Err(AppError::BadRequest(format!(
                "有給休暇残日数が不足しています（残 {}日 / 申請 {}日）",
                balance, days
            )));
        }

        // 残日数を減算
        sqlx::query!(
            "UPDATE employees SET annual_leave_balance = annual_leave_balance - $1 WHERE id = $2",
            days as i32,
            req.employee_id
        )
        .execute(&mut *tx)
        .await?;
    }

    // 申請を承認済みに更新
    sqlx::query!(
        r#"
        UPDATE leave_requests
        SET status = 'approved',
            reviewed_by = $1,
            reviewed_at = NOW(),
            review_comment = $2
        WHERE id = $3
        "#,
        reviewer_id,
        comment,
        request_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// 申請の残日数影響シミュレーション
pub async fn check_leave_balance(
    pool: &PgPool,
    employee_id: Uuid,
    requested_days: f32,
) -> Result<LeaveBalanceCheck> {
    let balance: i32 = sqlx::query_scalar!(
        "SELECT annual_leave_balance FROM employees WHERE id = $1",
        employee_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("従業員が見つかりません".to_string()))?;

    let is_sufficient = balance as f32 >= requested_days;
    let balance_after = (balance as f32) - requested_days;

    Ok(LeaveBalanceCheck {
        employee_id,
        requested_days,
        current_balance: balance,
        is_sufficient,
        balance_after,
    })
}
