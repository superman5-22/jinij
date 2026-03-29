use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{errors::AppError, AppState};

/// Supabase JWT クレーム
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabaseClaims {
    pub sub: String,
    pub email: Option<String>,
    pub role: Option<String>,
    pub exp: i64,
    pub iat: i64,
}

/// リクエスト拡張: 検証済みユーザー情報
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: Option<String>,
    pub role: Option<String>,
}

/// Bearer トークンを検証し AuthUser を Extension に追加する
pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = extract_bearer_token(request.headers())
        .ok_or_else(|| AppError::Unauthorized("Authorization ヘッダーがありません".to_string()))?;

    let claims = verify_jwt(&token, &state.config.supabase_jwt_secret)
        .map_err(|e| AppError::Unauthorized(format!("トークンが無効です: {}", e)))?;

    let user_id = claims
        .sub
        .parse::<Uuid>()
        .map_err(|_| AppError::Unauthorized("ユーザーIDの形式が不正です".to_string()))?;

    request.extensions_mut().insert(AuthUser {
        id: user_id,
        email: claims.email,
        role: claims.role,
    });

    Ok(next.run(request).await)
}

fn extract_bearer_token(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

fn verify_jwt(token: &str, secret: &str) -> anyhow::Result<SupabaseClaims> {
    let key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&["authenticated"]);
    validation.set_issuer(&[""]);  // Supabase が issuer を使用しないケースがある

    let data = decode::<SupabaseClaims>(token, &key, &validation)?;
    Ok(data.claims)
}
