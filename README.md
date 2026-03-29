# jinij — 社内人事システム

Vue 3 + Rust + Supabase で構築した、ミニマムな人事管理システムです。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Vue 3 (Composition API) + TypeScript + Bootstrap 5 |
| バックエンド | Rust (Axum) |
| DB / 認証 | Supabase (PostgreSQL + Auth) |

## 画面構成

1. **ログイン** — Supabase Auth (メール/パスワード)
2. **ダッシュボード** — 全体サマリー、最近の申請
3. **従業員一覧** — 検索・絞り込み・ページネーション
4. **従業員詳細/編集/登録** — モード切替フォーム
5. **休暇申請・承認** — 申請フォーム + 承認キュー

## ディレクトリ構成

```
.
├── frontend/          # Vue 3 アプリ
│   └── src/
│       ├── assets/styles/   # CSS design tokens
│       ├── components/      # 共通 / レイアウト / 機能別コンポーネント
│       ├── composables/     # useEmployees, useLeaves, useDashboard
│       ├── lib/             # supabase.ts クライアント
│       ├── router/          # Vue Router (認証ガード付き)
│       ├── stores/          # Pinia (auth)
│       ├── types/           # TypeScript 型定義
│       └── views/           # 5画面
├── backend/           # Rust (Axum) API サーバー
│   └── src/
│       ├── handlers/        # HTTP ハンドラー
│       ├── middleware/       # JWT 認証ミドルウェア
│       ├── models/          # データモデル
│       └── services/        # ビジネスロジック
└── supabase/
    └── migrations/          # DDL + RLS + シードデータ
```

## 起動方法

### 1. Supabase セットアップ

```bash
# Supabase CLI をインストール後
supabase init
supabase start
supabase db push  # migrations/ を適用
```

### 2. フロントエンド

```bash
cd frontend
cp .env.example .env          # Supabase URL / anon key を設定
npm install
npm run dev
```

### 3. バックエンド (Rust)

```bash
cd backend
cp .env.example .env          # Supabase URL / service_role key を設定
cargo run
```

## アーキテクチャの方針

- **CRUD / 認証** → Vue から Supabase クライアント直接
- **複雑なビジネスロジック** → Rust API 経由
  - 休暇残日数チェック付き承認処理
  - ダッシュボード集計 (複数テーブル結合)
  - CSV エクスポート
  - Supabase Webhook 受信

## RLS 設計

| ロール | 読み取り | 書き込み |
|---|---|---|
| employee | 自分のデータ / 全従業員の基本情報 | 自分の休暇申請のみ |
| manager | 自部署のデータ全般 | 自部署の休暇承認 |
| hr | 全データ | 従業員管理全般 |
| admin | 全データ | 全操作 |
