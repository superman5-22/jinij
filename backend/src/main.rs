mod config;
mod errors;
mod handlers;
mod middleware;
mod models;
mod services;

use std::sync::Arc;

use axum::{
    middleware as axum_middleware,
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;

/// アプリケーション共有状態
#[derive(Clone)]
pub struct AppState {
    pub db:     sqlx::PgPool,
    pub config: Arc<Config>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // ログ初期化
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "jinij_backend=debug,tower_http=info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env()?;
    let addr   = format!("{}:{}", config.host, config.port);

    tracing::info!("設定を読み込みました");
    tracing::info!("データベースへ接続中...");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    tracing::info!("データベース接続完了");

    let shared_config = Arc::new(config);
    let state = AppState {
        db:     pool,
        config: shared_config.clone(),
    };

    // CORS 設定
    let cors = CorsLayer::new()
        .allow_origin(
            shared_config
                .cors_allowed_origins
                .iter()
                .filter_map(|o| o.parse().ok())
                .collect::<Vec<_>>(),
        )
        .allow_methods(Any)
        .allow_headers(Any);

    // 認証が必要なルートグループ
    let protected = Router::new()
        .route("/dashboard", get(handlers::dashboard::get_summary))
        .route("/employees/export.csv", get(handlers::employees::export_csv))
        .route("/leaves/:id/approve", post(handlers::leaves::approve))
        .route("/leaves/:id/reject", post(handlers::leaves::reject))
        .route(
            "/leaves/:employee_id/balance-check",
            get(handlers::leaves::balance_check),
        )
        // 勤怠管理
        .route("/attendance/clock-in",  post(handlers::attendance::clock_in))
        .route("/attendance/clock-out", post(handlers::attendance::clock_out))
        .route("/attendance/today",     get(handlers::attendance::get_today))
        .route(
            "/attendance/:employee_id/monthly",
            get(handlers::attendance::get_monthly),
        )
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            middleware::auth::require_auth,
        ));

    let app = Router::new()
        .nest("/api/v1", protected)
        .route("/health", get(health_check))
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    tracing::info!("サーバーを起動: http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "ok"
}
