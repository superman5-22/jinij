use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub supabase_url: String,
    pub supabase_service_role_key: String,
    pub supabase_jwt_secret: String,
    pub cors_allowed_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let cors_origins: Vec<String> = env::var("CORS_ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:5173".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        Ok(Config {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()?,
            database_url: env::var("DATABASE_URL")
                .or_else(|_| {
                    // Supabase の接続文字列を組み立て
                    let url = env::var("SUPABASE_URL")?;
                    let key = env::var("SUPABASE_SERVICE_ROLE_KEY")?;
                    // Supabase の DB URL パターン
                    let db_host = url
                        .trim_start_matches("https://")
                        .split('.')
                        .next()
                        .unwrap_or("localhost")
                        .to_string();
                    Ok::<String, env::VarError>(format!(
                        "postgresql://postgres.{}:{}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres",
                        db_host, key
                    ))
                })
                .unwrap_or_else(|_| "postgresql://localhost:5432/jinij".to_string()),
            supabase_url: env::var("SUPABASE_URL")
                .unwrap_or_else(|_| "http://localhost:54321".to_string()),
            supabase_service_role_key: env::var("SUPABASE_SERVICE_ROLE_KEY")
                .unwrap_or_default(),
            supabase_jwt_secret: env::var("SUPABASE_JWT_SECRET")
                .unwrap_or_default(),
            cors_allowed_origins: cors_origins,
        })
    }
}
