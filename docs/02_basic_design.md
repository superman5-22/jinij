# 基本設計書

**システム名**: jinij — 社内人事管理システム
**バージョン**: 1.2
**作成日**: 2026-03-29
**改訂履歴**:

| バージョン | 日付 | 変更内容 | 担当者 |
|---|---|---|---|
| 1.0 | 2026-03-29 | 初版作成 | - |
| 1.1 | 2026-03-29 | 部署管理機能追加（SCR-08、F-50〜F-54） | - |
| 1.2 | 2026-03-29 | 勤怠管理機能追加（SCR-09、F-60〜F-66） | - |

---

## 1. システム全体構成図

```
┌─────────────────────────────────────────────────────────────┐
│                        利用者（ブラウザ）                        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
          ┌──────────────┼──────────────────┐
          │              │                  │
          ▼              ▼                  ▼
  ┌───────────────┐  ┌──────────────┐  ┌───────────────────┐
  │  Vue 3 SPA    │  │  Rust / Axum │  │  Supabase Cloud   │
  │  (Vercel)     │  │  Backend API │  │  ┌─────────────┐  │
  │               │  │              │  │  │ PostgreSQL  │  │
  │  - Vue Router │  │  /api/v1/    │  │  │ + RLS       │  │
  │  - Pinia      │  │  dashboard   │  │  ├─────────────┤  │
  │  - Bootstrap5 │  │  employees   │  │  │ Supabase    │  │
  │               │  │  leaves      │  │  │ Auth (JWT)  │  │
  │  直接アクセス  │  │  notifications│  │  ├─────────────┤  │
  │  (CRUD)       │  │              │  │  │ Realtime    │  │
  └──────┬────────┘  └──────┬───────┘  │  │ (WebSocket) │  │
         │                  │          │  └─────────────┘  │
         └──────────────────┴──────────┤                   │
              Supabase JS Client       └───────────────────┘
              + REST API                      ▲
                                              │ sqlx (Rust)
                                              │
                                    ┌─────────┴─────────┐
                                    │   Rust Backend    │
                                    │  (複雑なビジネス   │
                                    │   ロジック・集計)  │
                                    └───────────────────┘
```

### アーキテクチャ方針

| 処理種別 | 担当 | 理由 |
|---|---|---|
| 単純 CRUD（従業員・申請の基本操作） | Supabase JS Client 直接 | RLS で権限制御済み、RTT を最小化 |
| 複雑集計（ダッシュボード） | Rust Backend | 複数テーブルの JOIN・集計を型安全に実装 |
| 休暇残日数チェック・承認処理 | Rust Backend | トランザクション整合性が必要 |
| CSV エクスポート | Rust Backend | 大量データの変換・BOM 付与処理 |
| リアルタイム通知配信 | Supabase Realtime | DB トリガー → WebSocket で即時配信 |

---

## 2. 機能一覧

```
jinij
├── 認証機能
│   ├── F-01 ログイン
│   ├── F-02 ログアウト
│   └── F-03 ロール別アクセス制御
├── ダッシュボード
│   ├── F-10 人事サマリー表示
│   └── F-11 直近申請一覧
├── 従業員管理
│   ├── F-20 従業員一覧（検索・フィルタ・ページネーション）
│   ├── F-21 従業員詳細表示
│   ├── F-22 従業員登録
│   ├── F-23 従業員情報更新
│   └── F-24 CSV エクスポート
├── 休暇管理
│   ├── F-30 休暇申請
│   ├── F-31 申請一覧（フィルタ）
│   ├── F-32 承認処理
│   ├── F-33 却下処理
│   ├── F-34 申請キャンセル
│   ├── F-35 プロキシ申請
│   └── F-36 残日数確認
├── 部署管理 ★新規
│   ├── F-50 部署一覧表示
│   ├── F-51 部署登録（admin のみ）
│   ├── F-52 部署更新（admin のみ）
│   ├── F-53 部署削除（admin のみ）
│   └── F-54 バリデーション
├── 通知機能
│   ├── F-40 通知受信（DB トリガー起点）
│   ├── F-41 通知一覧表示（ベルアイコン）
│   ├── F-42 既読処理
│   ├── F-43 全件既読
│   └── F-44 Realtime リアルタイム更新
└── 勤怠管理 ★新規
    ├── F-60 出勤打刻
    ├── F-61 退勤打刻（休憩時間入力付き）
    ├── F-62 本日打刻状況確認
    ├── F-63 月次勤怠一覧
    ├── F-64 月次サマリー
    ├── F-65 月移動
    └── F-66 バリデーション（重複打刻防止）
```

---

## 3. 画面一覧・画面遷移図

### 3.1 画面一覧

| 画面 ID | 画面名 | パス | 対象ロール |
|---|---|---|---|
| SCR-01 | ログイン画面 | `/login` | 全員（未認証） |
| SCR-02 | ダッシュボード | `/` | 全ロール |
| SCR-03 | 従業員一覧 | `/employees` | 全ロール |
| SCR-04 | 従業員詳細 | `/employees/:id` | 全ロール |
| SCR-05 | 従業員新規登録 | `/employees/new` | hr / admin |
| SCR-06 | 従業員編集 | `/employees/:id/edit` | hr / admin |
| SCR-07 | 休暇申請・承認 | `/leaves` | 全ロール |
| SCR-08 | 部署管理 | `/departments` | admin のみ（閲覧は全ロール） |
| SCR-09 | 勤怠管理 | `/attendance` | 全ロール |

### 3.2 画面遷移図

```
[未認証]
    │ アクセス
    ▼
SCR-01 ログイン
    │ 認証成功
    ▼
SCR-02 ダッシュボード ◄────────────────────────────────┐
    │                                                   │
    ├─[サイドバー: 従業員一覧]──► SCR-03 従業員一覧        │
    │                                  │                │
    │                          [詳細表示]  [新規登録]    │
    │                               │         │        │
    │                           SCR-04     SCR-05       │
    │                           詳細表示    新規登録      │
    │                               │                   │
    │                           [編集ボタン]             │
    │                               │                   │
    │                           SCR-06 編集 ────────────┘
    │
    ├─[サイドバー: 休暇申請]──► SCR-07 休暇申請・承認
    │
    ├─[サイドバー: 部署管理（admin）]──► SCR-08 部署管理
    │                                             │
    │                              [新規登録/編集/削除（admin）]
    │
    └─[サイドバー: 勤怠管理]──► SCR-09 勤怠管理
                                      │
                         [出勤ボタン / 退勤ボタン]
                         [月切替 ◄ YYYY年MM月 ►]
```

### 3.3 通知ドロップダウン（全画面共通）

すべての認証済み画面のヘッダーにベルアイコンを表示。クリックで通知一覧ドロップダウンが展開する。

---

## 4. 帳票一覧

| 帳票 ID | 帳票名 | 形式 | 出力タイミング | 対象ロール |
|---|---|---|---|---|
| RPT-01 | 従業員一覧エクスポート | CSV (UTF-8 BOM) | 手動（ボタン押下） | hr / admin |

### RPT-01 出力項目

| 列 | フィールド名 | 備考 |
|---|---|---|
| 1 | 社員番号 | employee_code |
| 2 | 氏名 | full_name |
| 3 | 氏名（カナ） | full_name_kana |
| 4 | メールアドレス | email |
| 5 | 部署 | departments.name |
| 6 | 役職 | position |
| 7 | 雇用形態 | employment_type |
| 8 | 在籍ステータス | status |
| 9 | 入社日 | hire_date |
| 10 | 有給残日数 | annual_leave_balance |

---

## 5. バッチ処理一覧

本システムにおけるバッチ処理は現時点では定義しない。将来的には以下を検討する。

| バッチ ID | 処理名 | 処理概要 | 頻度（予定） |
|---|---|---|---|
| BAT-01 | 有給付与バッチ | 入社記念日到来者への有給付与 | 日次 |
| BAT-02 | 有給失効バッチ | 有効期限切れ有給の失効処理 | 日次 |

---

## 6. 外部インターフェース設計

### 6.1 Supabase REST API

| エンドポイント | メソッド | 用途 | 認証 |
|---|---|---|---|
| `/rest/v1/profiles` | GET | プロフィール取得 | JWT |
| `/rest/v1/employees` | GET/POST/PATCH | 従業員 CRUD | JWT + RLS |
| `/rest/v1/leave_requests` | GET/POST/PATCH | 休暇申請 CRUD | JWT + RLS |
| `/rest/v1/departments` | GET/POST/PATCH/DELETE | 部署 CRUD | JWT + RLS |
| `/rest/v1/notifications` | GET/PATCH | 通知取得・既読更新 | JWT + RLS |
| `/realtime/v1/websocket` | WS | Realtime 通知 | JWT |

### 6.2 Rust Backend API

| エンドポイント | メソッド | 用途 | 認証 |
|---|---|---|---|
| `/api/v1/dashboard` | GET | 集計サマリー取得 | JWT |
| `/api/v1/employees/export.csv` | GET | CSV エクスポート | JWT |
| `/api/v1/leaves/:id/approve` | POST | 残日数トランザクション付き承認 | JWT |
| `/api/v1/leaves/:id/reject` | POST | 却下処理 | JWT |
| `/api/v1/leaves/:employee_id/balance-check` | GET | 残日数シミュレート | JWT |
| `/api/v1/attendance/clock-in` | POST | 出勤打刻 | JWT |
| `/api/v1/attendance/clock-out` | POST | 退勤打刻 | JWT |
| `/api/v1/attendance/today` | GET | 本日の打刻状態取得 | JWT |
| `/api/v1/attendance/:employee_id/monthly` | GET | 月次勤怠サマリー取得 | JWT |

---

## 7. データベース概要設計

### 7.1 主要エンティティ関連図（ER 概要）

```
auth.users (Supabase 管理)
    │ 1:1
    ▼
profiles ──────────────────┐
    │                       │ reviewed_by (FK)
    │ user_id (1:0..1)      │
    ▼                       │
employees                   │
    │ department_id          │
    ├──────► departments     │
    │                        │
    │ 1:N                    │
    ▼                        │
leave_requests ◄────────────┘
    │ (INSERT/UPDATE トリガー)
    ▼
notifications ──────► auth.users (user_id)
```

### 7.2 テーブル概要

| テーブル名 | 概要 | 主キー |
|---|---|---|
| `profiles` | 認証ユーザーの拡張情報（ロール含む） | UUID (auth.users 参照) |
| `departments` | 部署マスタ | UUID |
| `employees` | 従業員情報（40+ 項目） | UUID |
| `leave_requests` | 休暇申請（ステータス管理） | UUID |
| `notifications` | アプリ内通知（★新規） | UUID |
| `attendance_records` | 勤怠記録（出退勤打刻・ステータス）（★新規） | UUID |
| `audit_logs` | 操作監査ログ | UUID |

### 7.3 通知テーブル設計概要 ★新規

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | 主キー |
| `user_id` | UUID | 通知受信者（auth.users 参照） |
| `type` | TEXT | 通知種別（leave_approved / leave_rejected / leave_submitted / system） |
| `title` | TEXT | 通知タイトル |
| `message` | TEXT | 通知本文 |
| `related_id` | UUID | 関連レコード ID（leave_requests.id 等） |
| `is_read` | BOOLEAN | 既読フラグ（デフォルト false） |
| `created_at` | TIMESTAMPTZ | 作成日時 |

**自動生成トリガー**: `leave_requests.status` が `pending → approved / rejected` に変化したとき、対象従業員の `user_id` に対して自動的に通知レコードを INSERT する。

### 7.4 勤怠テーブル設計概要 ★新規

| カラム | 型 | 説明 |
|---|---|---|
| `id` | UUID | 主キー |
| `employee_id` | UUID | 従業員 ID（employees.id 参照） |
| `user_id` | UUID | 打刻ユーザー（auth.users 参照、RLS 用） |
| `work_date` | DATE | 勤務日 |
| `clock_in` | TIMESTAMPTZ | 出勤時刻（nullable） |
| `clock_out` | TIMESTAMPTZ | 退勤時刻（nullable） |
| `break_minutes` | INTEGER | 休憩時間（分）。デフォルト 0 |
| `status` | TEXT | 勤怠ステータス（present / absent / late / early_leave / holiday / remote） |
| `note` | TEXT | 備考（nullable） |
| `created_at` | TIMESTAMPTZ | 作成日時 |
| `updated_at` | TIMESTAMPTZ | 更新日時（トリガー自動更新） |

**ユニーク制約**: `(employee_id, work_date)` — 同一従業員の同日レコードは1件のみ。

---

## 8. 非機能要件に対する基本方針

### 8.1 性能

| 要件 | 実現方式 |
|---|---|
| 高速な一覧表示 | Supabase から直接取得（RTT 短縮）、ページネーション（20件/ページ）でデータ量制限 |
| 集計処理の高速化 | Rust Backend で sqlx プリペアドステートメント、DB インデックス活用 |
| リアルタイム通知 | Supabase Realtime (WebSocket) で DB 変更をプッシュ通知 |

### 8.2 セキュリティ

| 要件 | 実現方式 |
|---|---|
| 認証 | Supabase Auth (JWT) によるセッション管理 |
| 認可 | PostgreSQL RLS ポリシーによる行レベルアクセス制御 |
| API 保護 | Rust Middleware で JWT を検証、未認証リクエストを 401 で拒否 |
| 通知の権限 | RLS により `user_id = auth.uid()` の通知のみ参照・更新可能 |
| CORS | 許可オリジンを設定ファイルで管理 |

### 8.3 可用性・運用性

| 要件 | 実現方式 |
|---|---|
| 高可用性 | Supabase Cloud のマネージド PostgreSQL を利用 |
| ログ | Rust Backend は `tracing` クレートで構造化ログ |
| 監査証跡 | `audit_logs` テーブルで変更履歴を記録 |
| デプロイ | フロントエンドは Vercel への自動デプロイ |
