# 基本設計書 — お知らせ（掲示板）機能

| バージョン | 作成日 | 作成者 |
|---|---|---|
| 1.0 | 2026-03-30 | システムアーキテクト |

---

## 1. システム全体構成図

```
┌─────────────────────────────────────────────────────────┐
│  ブラウザ (Vue 3 SPA)                                    │
│                                                         │
│  AnnouncementView.vue                                   │
│       │                                                 │
│       ▼                                                 │
│  useAnnouncements() composable                          │
│       │                                                 │
│       ▼                                                 │
│  @supabase/supabase-js client ──────────────────────────┼──▶  Supabase
│                                                         │       │
└─────────────────────────────────────────────────────────┘       │
                                                                   ▼
                                                        PostgreSQL (announcements テーブル)
                                                        + RLS ポリシー
```

> 本機能は Rust バックエンドを経由せず、フロントエンドから Supabase JS クライアントで直接操作する（既存の departments・salary と同アーキテクチャ）。

---

## 2. 機能一覧

| 機能 ID | 機能名 | 概要 | 操作ロール |
|---|---|---|---|
| F-80 | お知らせ一覧 | 公開済み・ピン先頭・カテゴリフィルター | 全員 |
| F-81 | 新規作成 | モーダルフォームで登録 | hr / admin |
| F-82 | 編集 | モーダルフォームで更新 | hr / admin |
| F-83 | 削除 | 確認ダイアログ後に物理削除 | hr / admin |
| F-84 | 下書き保存 | 公開日時未入力で保存 | hr / admin |
| F-85 | 即時公開 | 一覧カード上のボタンで今すぐ公開 | hr / admin |
| F-86 | カテゴリフィルター | セレクトボックスで絞り込み | 全員 |
| F-87 | 有効期限除外 | DB クエリで `expires_at > now()` のみ取得 | システム |
| F-88 | ピン留め | `is_pinned = true` を先頭グループ表示 | hr / admin |

---

## 3. 画面一覧・画面遷移図

### 画面一覧

| 画面 ID | 画面名 | URL | 説明 |
|---|---|---|---|
| SCR-80 | お知らせ一覧画面 | `/announcements` | 一覧・フィルター・操作ボタン |
| SCR-81 | 作成/編集モーダル | （SCR-80 上のオーバーレイ） | フォーム入力 |
| SCR-82 | 削除確認モーダル | （SCR-80 上のオーバーレイ） | 削除前確認 |

### 画面遷移図

```
[サイドバー: お知らせ]
        │
        ▼
[SCR-80: お知らせ一覧]
        │
        ├── [新規作成ボタン(HR/Admin)] ──▶ [SCR-81: 作成モーダル] ──▶ 登録完了 ──▶ 一覧更新
        │
        ├── [編集ボタン(HR/Admin)] ────▶ [SCR-81: 編集モーダル] ──▶ 更新完了 ──▶ 一覧更新
        │
        ├── [削除ボタン(HR/Admin)] ────▶ [SCR-82: 削除確認モーダル] ──▶ 削除完了 ──▶ 一覧更新
        │
        └── [即時公開ボタン(HR/Admin)] ──▶ published_at = now() ──▶ 一覧更新
```

---

## 4. 帳票一覧

本機能に出力帳票は存在しない。（将来的に PDF 出力が必要になった場合は別途設計）

---

## 5. バッチ処理一覧

有効期限制御はバッチ処理ではなく、DB クエリの `WHERE` 条件で動的に対応する。定期バッチは不要。

---

## 6. 外部インターフェース設計

### Supabase REST API（JS クライアント経由）

| メソッド | テーブル | 操作 | 条件 |
|---|---|---|---|
| SELECT | `announcements` | 一覧取得 | `published_at IS NOT NULL AND published_at <= now() AND (expires_at IS NULL OR expires_at > now())` |
| SELECT | `announcements` | 一覧取得（下書き込み） | HR/Admin 時は条件緩和 |
| INSERT | `announcements` | 新規登録 | HR/Admin のみ |
| UPDATE | `announcements` | 更新 | HR/Admin のみ |
| DELETE | `announcements` | 削除 | HR/Admin のみ |

---

## 7. データベース概要設計

### 主要エンティティ

```
announcements
├── id           UUID PK
├── title        TEXT NOT NULL
├── content      TEXT NOT NULL
├── category     ENUM(general/important/event/hr)
├── is_pinned    BOOLEAN
├── published_at TIMESTAMPTZ  (NULL = 下書き)
├── expires_at   TIMESTAMPTZ  (NULL = 無期限)
├── created_by   UUID → auth.users
├── created_at   TIMESTAMPTZ
└── updated_at   TIMESTAMPTZ
```

### 既存エンティティとの関連

```
auth.users ──(created_by)──▶ announcements
```

`announcements` は他テーブルとの JOIN は不要（スタンドアロン）。

---

## 8. 非機能要件に対する基本方針

| 要件 | 実現方式 |
|---|---|
| **性能** | `published_at` / `is_pinned` にインデックスを設置。取得件数は年間 200 件程度のため全件取得でも問題なし |
| **セキュリティ** | PostgreSQL RLS で行レベルの読み書き制御。フロントエンドは Supabase Auth JWT を利用 |
| **可用性** | Supabase 本体の SLA（99.9%）に依存。フロントエンドは Vercel の CDN で提供 |
| **保守性** | composable / view / migration を独立ファイルに分離。既存パターンに準拠 |
| **UI 一貫性** | 既存の Bootstrap 5 クラスと `shadow-sm` / `border-0` カードスタイルを踏襲 |
