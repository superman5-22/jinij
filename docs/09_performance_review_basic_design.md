# 人事評価機能 — 基本設計書

**システム名**: jinij — 社内人事管理システム（追加機能）
**機能名**: 人事評価管理（Performance Review）
**バージョン**: 1.0
**作成日**: 2026-03-30

---

## 1. システム全体構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                   ブラウザ（Vue 3 SPA）                          │
│                                                                  │
│  PerformanceReviewView.vue                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  フィルター / 一覧テーブル / 登録モーダル / 詳細モーダル  │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │ usePerformanceReviews composable      │
│                          │ (fetchReviews / createReview /        │
│                          │  updateReview / changeStatus /        │
│                          │  deleteReview)                        │
└──────────────────────────┼──────────────────────────────────────┘
                           │ Supabase JS SDK (直接 CRUD)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL + Auth + Realtime)         │
│                                                                  │
│  performance_reviews テーブル                                    │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ RLS Policy: hr/admin 全件操作                          │     │
│  │             manager  自部署のみ操作                    │     │
│  │             employee 自身の submitted/acknowledged 閲覧 │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  DB Trigger: trg_notify_review_submitted                         │
│    → draft→submitted 変更時に notifications テーブルへ INSERT   │
└─────────────────────────────────────────────────────────────────┘
```

**アーキテクチャ上の判断**: 人事評価の CRUD は全て Supabase JS クライアントから直接操作する（Rust バックエンドは不使用）。理由は以下の通り：
- トランザクション処理が不要（単一テーブルの CRUD）
- RLS により認可制御が完結する
- バックエンドへの RTT を省略し応答性を高める
- 通知生成は DB トリガーで完結するため、複雑なサーバーサイドロジックが不要

---

## 2. 機能一覧

| 機能ID | 機能名 | 概要 |
|---|---|---|
| F-80 | 評価一覧表示 | フィルタリング付きの評価レコード一覧テーブル |
| F-81 | 評価新規登録 | モーダルフォームによる評価レコード作成 |
| F-82 | 評価編集 | draft 評価のモーダルフォーム編集 |
| F-83 | 評価提出 | draft → submitted ステータス変更（通知自動送信） |
| F-84 | 評価確認（本人確認） | submitted → acknowledged ステータス変更 |
| F-85 | 評価詳細表示 | 全項目の詳細モーダル表示 |
| F-86 | 評価削除 | draft 評価の論理削除（物理削除） |

---

## 3. 画面一覧・画面遷移図

### 3.1 画面一覧

| 画面ID | 画面名 | ファイルパス | アクセス制御 |
|---|---|---|---|
| SCR-80 | 人事評価一覧 | `frontend/src/views/PerformanceReviewView.vue` | 全ロール（要認証） |
| SCR-81 | 評価登録・編集モーダル | PerformanceReviewView.vue 内 | hr / admin / manager |
| SCR-82 | 評価詳細モーダル | PerformanceReviewView.vue 内 | 全ロール（閲覧可能範囲のみ） |

### 3.2 画面遷移図

```
[サイドバー: 人事評価]
        │
        ▼
[SCR-80: 人事評価一覧]
   │          │              │
   │          │              │
[詳細ボタン] [編集ボタン]  [新規登録ボタン]
   │          │              │
   ▼          ▼              ▼
[SCR-82:  [SCR-81:        [SCR-81:
 詳細MD]   編集MD]          登録MD]
   │          │              │
  閉じる    保存/Cancel     保存/Cancel
   │          │              │
   └──────────┴──────────────┘
              ▼
       [SCR-80: 一覧に戻る]
```

---

## 4. 帳票一覧

本機能では帳票出力は対象外（将来の拡張候補: 評価結果 PDF / CSV エクスポート）。

---

## 5. バッチ処理一覧

本機能ではバッチ処理は対象外（将来の拡張候補: 評価期間開始時の一括ドラフト生成）。

---

## 6. 外部インターフェース設計

| IF種別 | 接続先 | 概要 |
|---|---|---|
| DB直接操作 | Supabase PostgreSQL | Supabase JS SDK 経由で `performance_reviews` テーブルへ CRUD |
| 認証 | Supabase Auth | JWT トークンによりRLSポリシーが自動適用される |
| 通知 | `notifications` テーブル | DB トリガーが自動生成。Supabase Realtime 経由で UI へ通知 |

---

## 7. データベース概要設計

### 主要エンティティと関連（ER図概要）

```
employees (既存)
  │ 1
  │
  │ N
performance_reviews
  ├── employee_id  → employees.id
  ├── reviewer_id  → auth.users.id
  └── created_by   → auth.users.id

performance_reviews (status: draft→submitted)
  │ トリガー発火
  ▼
notifications (既存)
  └── related_id → performance_reviews.id
```

### テーブル一覧

| テーブル名 | 役割 |
|---|---|
| `performance_reviews` | 人事評価レコード（新規追加） |
| `employees` | 被評価者情報（既存） |
| `notifications` | 評価提出時の通知（既存、トリガーにより自動生成） |

---

## 8. 非機能要件に対する基本方針

| 区分 | 方針 |
|---|---|
| 性能 | Supabase インデックス（employee_id, review_year, status）により一覧取得を高速化 |
| セキュリティ | RLS ポリシーを利用し、ロールごとに閲覧・操作行を厳密に制限。フロントエンドの制御とDBレベルの制御で二重防御 |
| 可用性 | Supabase クラウドの冗長化に依存。フロントエンドはエラー時にアラート表示で縮退動作 |
| 整合性 | UNIQUE 制約 `(employee_id, review_year, review_type, review_quarter)` で重複評価を防止 |
| 監査 | `created_by`, `created_at`, `updated_at` を全レコードに記録。ステータス変更日時（`submitted_at`, `acknowledged_at`）も保持 |
