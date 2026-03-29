use axum::{
    extract::{Extension, Path, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::{AppError, Result},
    middleware::auth::AuthUser,
    models::leave::ReviewRequest,
    services::leave_service,
    AppState,
};

/// POST /api/v1/leaves/:id/approve
/// 承認: 年次有給の場合は残日数チェックも実施。
pub async fn approve(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewRequest>,
) -> Result<Json<Value>> {
    check_manager_role(&auth_user)?;

    leave_service::approve_with_balance_check(
        &state.db,
        id,
        auth_user.id,
        body.comment,
    )
    .await?;

    Ok(Json(json!({ "message": "承認しました" })))
}

/// POST /api/v1/leaves/:id/reject
/// 却下: 理由が必須。
pub async fn reject(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewRequest>,
) -> Result<Json<Value>> {
    check_manager_role(&auth_user)?;

    let comment = body
        .comment
        .filter(|c| !c.trim().is_empty())
        .ok_or_else(|| AppError::BadRequest("却下理由を入力してください".to_string()))?;

    sqlx::query!(
        r#"
        UPDATE leave_requests
        SET status = 'rejected',
            reviewed_by    = $1,
            reviewed_at    = NOW(),
            review_comment = $2
        WHERE id = $3 AND status = 'pending'
        "#,
        auth_user.id,
        comment,
        id
    )
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "message": "却下しました" })))
}

/// GET /api/v1/leaves/:employee_id/balance-check?days=X
/// フロントから事前に残日数チェックを呼べるユーティリティ。
pub async fn balance_check(
    State(state): State<AppState>,
    Extension(_auth_user): Extension<AuthUser>,
    Path(employee_id): Path<Uuid>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Value>> {
    let days: f32 = params
        .get("days")
        .and_then(|d| d.parse().ok())
        .ok_or_else(|| AppError::BadRequest("days パラメーターが必要です".to_string()))?;

    let check = leave_service::check_leave_balance(&state.db, employee_id, days).await?;

    Ok(Json(serde_json::to_value(check).unwrap()))
}

fn check_manager_role(user: &AuthUser) -> Result<()> {
    let role = user.role.as_deref().unwrap_or("employee");
    if !["manager", "hr", "admin"].contains(&role) {
        return Err(AppError::Forbidden(
            "この操作にはマネージャー以上の権限が必要です".to_string(),
        ));
    }
    Ok(())
}
