# 詳細設計書 — お知らせ（掲示板）機能

| バージョン | 作成日 | 作成者 |
|---|---|---|
| 1.0 | 2026-03-30 | システムアーキテクト |

---

## 1. 画面詳細設計

### SCR-80: お知らせ一覧画面（`/announcements`）

#### レイアウト

```
┌───────────────────────────────────────────────┐
│ h1: お知らせ           [新規作成ボタン(hr/admin)] │
├───────────────────────────────────────────────┤
│ フィルターカード                               │
│  [カテゴリ ▼]  [□ 下書きを含む(hr/admin)]      │
├───────────────────────────────────────────────┤
│ 📌 ピン留め                                    │
│ [AnnouncementCard × n]                        │
│ ────────────────────                          │
│ [AnnouncementCard × n]                        │
└───────────────────────────────────────────────┘
```

#### 項目定義

| 項目 | 型 | 説明 |
|---|---|---|
| カテゴリフィルター | `select` | `''`（全て）/ `general` / `important` / `event` / `hr` |
| 下書きを含む | `checkbox` | hr/admin のみ表示。`true` で `published_at IS NULL` も取得 |
| 新規作成ボタン | `button` | hr/admin のみ表示。クリックで SCR-81 を開く |

#### AnnouncementCard 項目定義

| 項目 | 表示条件 | 説明 |
|---|---|---|
| ピンアイコン | `is_pinned = true` | `bi-pin-fill text-danger` |
| カテゴリバッジ | 常時 | ANNOUNCEMENT_CATEGORY_LABELS に対応する色 |
| 下書きバッジ | `published_at = NULL` | `bg-warning text-dark` |
| 期限切れバッジ | `expires_at < now()` | `bg-secondary` |
| 公開日時 | 常時 | `YYYY/MM/DD HH:mm` 形式 |
| タイトル | 常時 | `h5` |
| 本文 | 常時 | 改行保持（`white-space: pre-wrap`） |
| 即時公開ボタン | 下書き かつ hr/admin | `bi-send` アイコン |
| 編集ボタン | hr/admin | `bi-pencil` アイコン |
| 削除ボタン | hr/admin | `bi-trash` アイコン |

#### 入力チェック仕様

| 項目 | チェック内容 |
|---|---|
| カテゴリ | 変更時に即 `fetchAnnouncements` を再実行 |
| 下書きを含む | 変更時に即 `fetchAnnouncements` を再実行 |

---

### SCR-81: 作成/編集モーダル

#### フォーム項目定義

| 項目 | 型 | 必須 | 検証ルール |
|---|---|---|---|
| タイトル | `input[text]` | ○ | 最大 200 文字 |
| カテゴリ | `select` | ○ | `general` / `important` / `event` / `hr` |
| 本文 | `textarea` | ○ | 最大文字数制限なし |
| 公開日時 | `input[datetime-local]` | × | 空 = 下書き |
| 有効期限 | `input[datetime-local]` | × | 空 = 無期限。公開日時より後である必要あり（UI ガイダンスのみ） |
| ピン留め | `checkbox` | × | デフォルト false |

#### イベント処理

| イベント | 処理 |
|---|---|
| 保存ボタン押下 | `saveAnnouncement()` を実行 |
| キャンセル / backdrop クリック | `closeModal()` |
| 編集モード時の初期表示 | `dayjs(item.published_at).format('YYYY-MM-DDTHH:mm')` で datetime-local に変換 |
| 送信時の日時変換 | `new Date(form.published_at).toISOString()` で ISO 8601 に変換 |

---

### SCR-82: 削除確認モーダル

| 要素 | 内容 |
|---|---|
| タイトル | 「削除確認」（赤色） |
| メッセージ | 「`{title}` を削除しますか？この操作は取り消せません。」 |
| キャンセルボタン | `deleteTarget = null` |
| 削除ボタン | `execDelete()` → 完了後 `deleteTarget = null` |

---

## 2. 帳票詳細設計

該当なし（本機能はオンライン参照のみ）。

---

## 3. 機能詳細設計（処理フロー）

### F-80: お知らせ一覧取得

```
onMounted()
    │
    ▼
fetchAnnouncements({ category?, include_drafts })
    │
    ├── isLoading = true
    ├── supabase.from('announcements')
    │       .select('*')
    │       .order('is_pinned', desc)
    │       .order('published_at', desc)
    │       [.eq('category', value)]  ※ フィルター指定時のみ
    │       [.not('published_at', 'is', null)]  ※ include_drafts=false 時
    │
    ├── 正常: announcements.value = data
    ├── エラー: error.value = message
    └── finally: isLoading = false
```

### F-81/F-82: 登録・更新

```
saveAnnouncement()
    │
    ├── [新規] createAnnouncement(form)
    │       ├── getUser() → user 取得
    │       ├── INSERT into announcements
    │       └── 成功: announcements.unshift(data) → closeModal()
    │
    └── [編集] updateAnnouncement(id, form)
            ├── UPDATE announcements SET ... WHERE id = ?
            └── 成功: current.value = data, 配列内を置換 → closeModal()
```

### F-83: 削除

```
execDelete()
    │
    ├── deleteAnnouncement(deleteTarget.id)
    │       ├── DELETE FROM announcements WHERE id = ?
    │       └── 成功: announcements.filter(a => a.id !== id)
    └── 成功: deleteTarget = null
```

### F-85: 即時公開

```
handlePublish(item)
    │
    └── publishAnnouncement(item.id)
            │
            └── updateAnnouncement(id, { published_at: new Date().toISOString() })
```

---

## 4. モジュール設計

### `useAnnouncements()` — `/composables/useAnnouncements.ts`

#### State

| 名前 | 型 | 説明 |
|---|---|---|
| `announcements` | `Ref<Announcement[]>` | 一覧 |
| `current` | `Ref<Announcement \| null>` | 単件参照用 |
| `isLoading` | `Ref<boolean>` | ローディングフラグ |
| `error` | `Ref<string \| null>` | エラーメッセージ |

#### メソッド

| メソッド名 | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `fetchAnnouncements` | `Partial<AnnouncementFilters>` | `Promise<void>` | 一覧取得 |
| `fetchAnnouncement` | `id: string` | `Promise<void>` | 単件取得 |
| `createAnnouncement` | `AnnouncementFormData` | `Promise<Announcement \| null>` | 登録 |
| `updateAnnouncement` | `id: string, Partial<AnnouncementFormData>` | `Promise<Announcement \| null>` | 更新 |
| `deleteAnnouncement` | `id: string` | `Promise<boolean>` | 削除 |
| `publishAnnouncement` | `id: string` | `Promise<Announcement \| null>` | 即時公開 |

---

## 5. データベース詳細設計

### `announcements` テーブル

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | 主キー |
| `title` | `TEXT` | NOT NULL | — | タイトル（最大 200 文字はアプリ側制御） |
| `content` | `TEXT` | NOT NULL | — | 本文（改行含む） |
| `category` | `announcement_category` | NOT NULL | `'general'` | カテゴリ ENUM |
| `is_pinned` | `BOOLEAN` | NOT NULL | `false` | ピン留めフラグ |
| `published_at` | `TIMESTAMPTZ` | NULL | — | NULL = 下書き |
| `expires_at` | `TIMESTAMPTZ` | NULL | — | NULL = 無期限 |
| `created_by` | `UUID` | NULL | — | FK → `auth.users.id` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 作成日時 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()` | 更新日時（トリガー自動更新） |

### ENUM: `announcement_category`

| 値 | 表示名 | バッジ色 |
|---|---|---|
| `general` | 一般 | secondary |
| `important` | 重要 | danger |
| `event` | イベント | success |
| `hr` | 人事 | primary |

### インデックス

| インデックス名 | カラム | 目的 |
|---|---|---|
| `idx_announcements_published_at` | `published_at DESC` | 一覧取得の ORDER BY 高速化 |
| `idx_announcements_is_pinned` | `is_pinned` | ピン留め絞り込み |
| `idx_announcements_expires_at` | `expires_at` | 有効期限フィルター |

### RLS ポリシー

| ポリシー名 | 操作 | 条件 |
|---|---|---|
| `announcements_select_published` | SELECT | 認証済み かつ `published_at <= now()` かつ 有効期限内 |
| `announcements_select_hr_admin` | SELECT | `profiles.role IN ('hr', 'admin')` |
| `announcements_insert_hr_admin` | INSERT | `profiles.role IN ('hr', 'admin')` |
| `announcements_update_hr_admin` | UPDATE | `profiles.role IN ('hr', 'admin')` |
| `announcements_delete_hr_admin` | DELETE | `profiles.role IN ('hr', 'admin')` |

---

## 6. 外部 IF 詳細仕様

本機能は Supabase JS クライアントのみ使用。Rust バックエンドへのリクエストなし。

| 通信先 | エンドポイント | 認証 | タイミング |
|---|---|---|---|
| Supabase REST | `https://<project>.supabase.co/rest/v1/announcements` | JWT Bearer | 画面表示時・CRUD 操作時 |

---

## 7. バッチ処理詳細設計

該当なし（有効期限は DB クエリで動的対応）。

---

## 8. セキュリティ設計

| 観点 | 実装内容 |
|---|---|
| 認証 | Supabase Auth JWT。セッション切れ時はログイン画面にリダイレクト（既存 `router.beforeEach` guard）|
| 認可（DB） | RLS により、一般従業員は `INSERT/UPDATE/DELETE` 不可 |
| 認可（UI） | `auth.isHR` フラグで hr/admin のみ操作ボタンを表示 |
| XSS 対策 | Vue 3 のテンプレートエンジンが HTML エスケープ。`v-html` は未使用 |
| 入力バリデーション | `required` / `maxlength` HTML 属性 + フォーム submit ガード |
