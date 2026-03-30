# 詳細設計書 — お知らせ掲示板機能（F-90）

**ドキュメント番号**: jinij-DET-004
**対象機能**: お知らせ掲示板（Announcement Board）
**バージョン**: 1.0
**作成日**: 2026-03-30

---

## 1. 画面詳細設計

### SCR-90-01 お知らせ一覧画面 (`/announcements`)

#### レイアウト

```
┌────────────────────────────────────────────────────────┐
│ [タイトル] お知らせ          [+ 新規作成] (HR/admin)   │
│ [サブタイトル] 社内アナウンス・重要連絡                │
├────────────────────────────────────────────────────────┤
│ [🔍 キーワード検索          ] [カテゴリ▼] [☑下書き含む]│
├────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐   │
│ │ 📌 [緊急] [NEW] タイトル（ピン留め・未読）       │   │
│ │     本文プレビュー（最大100字）                  │   │
│ │     田中 太郎  2026-04-01 09:00  ⏰ 4/30まで   │   │
│ │     [✏️] [🗑️] (HR/admin のみ)                   │   │
│ └──────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────┐   │
│ │  [人事] タイトル（既読済み）                     │   │
│ │  本文プレビュー...                               │   │
│ └──────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

#### 項目定義

| 項目名 | 型 | 必須 | 説明 |
|--------|-----|------|------|
| キーワード | text | - | 300ms debounce で検索実行 |
| カテゴリフィルター | select | - | 空=全件、general/hr/event/urgent |
| 下書き含む（toggle） | checkbox | - | HR/admin のみ表示 |
| カテゴリバッジ | badge | - | ANNOUNCEMENT_CATEGORY_COLORS でカラー決定 |
| NEWバッジ | badge | - | `!is_read && published_at != null` で表示 |
| 下書きバッジ | badge | - | `!published_at` かつ HR/admin のみ表示 |
| ピン留めアイコン | icon | - | `is_pinned = true` で bi-pin-angle-fill 表示 |
| 有効期限表示 | text | - | `expires_at` が存在する場合のみ表示 |

#### イベント処理

| イベント | 処理 |
|---------|------|
| カードクリック | `openDetail(item)` → 詳細モーダル表示 + 既読登録 |
| キーワード input | `debouncedFetch()` → 300ms 後に `applyFilters()` |
| カテゴリ change | `applyFilters()` 即時実行 |
| 下書きトグル change | `applyFilters()` 即時実行 |
| 新規作成ボタン | `openCreateModal()` |
| 編集ボタン（✏️） | `openEditModal(item)` |
| 削除ボタン（🗑️） | `confirmDelete(item)` |

---

### SCR-90-02 詳細モーダル

| 項目 | 内容 |
|------|------|
| カテゴリバッジ | 作成・編集と同スタイル |
| ピン留めバッジ | `is_pinned` が true の場合表示 |
| タイトル | `<h5>` |
| 本文 | `white-space: pre-wrap` でテキスト表示（XSS 対策） |
| 投稿者名 | `author.full_name ?? author.email ?? '不明'` |
| 公開日時 | `published_at ?? created_at` |
| 有効期限 | `expires_at` が存在する場合のみ |

---

### SCR-90-03/04 作成・編集フォームモーダル

#### 入力項目

| 項目名 | 型 | 必須 | バリデーション |
|--------|-----|------|---------------|
| タイトル | text | ✓ | 1〜200 文字 |
| カテゴリ | select | ✓ | general / hr / event / urgent |
| ピン留め | checkbox | - | true / false |
| 本文 | textarea | ✓ | 1 文字以上 |
| 公開日時 | datetime-local | - | 空 = 下書き |
| 有効期限 | datetime-local | - | 空 = 無期限 |

#### バリデーション詳細

```typescript
// validate() 関数ロジック
if (!form.title.trim()) → formErrors.title = 'タイトルは必須です'
if (!form.body.trim())  → formErrors.body  = '本文は必須です'
```

---

## 2. 帳票詳細設計

本機能では帳票出力なし（スコープ外）。

---

## 3. 機能詳細設計（処理フロー）

### F-90-01 一覧取得フロー

```
[コンポーネント onMounted]
  └→ applyFilters()
       └→ fetchAnnouncements(filters, isHR)
            ├─ loading = true, error = null
            ├─ supabase.from('announcements')
            │     .select('*, author:profiles!created_by(id,full_name,email)')
            │     .order('is_pinned', ascending: false)
            │     .order('published_at', ascending: false)
            │     ─ [isHR && show_all でない場合]
            │       .not('published_at', 'is', null)
            │       .lte('published_at', NOW)
            │       .or('expires_at.is.null,expires_at.gt.{NOW}')
            │     ─ [category フィルター]
            │       .eq('category', filters.category)
            │     ─ [keyword フィルター]
            │       .or('title.ilike.%{kw}%,body.ilike.%{kw}%')
            ├─ announcements.value = data ?? []
            ├─ attachReadStatus()
            │     └→ supabase.from('announcement_reads')
            │              .select('announcement_id')
            │              .in('announcement_id', ids)
            │          → readSet から is_read を付与
            └─ loading = false (finally)
```

### F-90-12 既読登録フロー

```
[カードクリック] → openDetail(item)
  ├─ selectedItem = item
  ├─ showDetail = true
  └─ [!item.is_read && item.published_at]
       └→ markAsRead(item.id)
            ├─ supabase.from('announcement_reads')
            │     .upsert({ announcement_id: id })
            │     (user_id は RLS で自動付与される設計だが
            │      upsert 時は auth.uid() が WITH CHECK で検証)
            └─ announcements.value の該当レコード.is_read = true
```

### F-90-03 作成フロー

```
[新規作成ボタン] → openCreateModal() → resetForm() → showFormModal=true

[フォーム送信] → submitForm()
  ├─ validate() → false なら中断
  ├─ submitting = true
  ├─ createAnnouncement(form)
  │     └→ buildPayload(form)  // trim・空→null 変換
  │         supabase.from('announcements')
  │           .insert(payload)
  │           .select('*, author:profiles!created_by(id,full_name,email)')
  │           .single()
  ├─ announcements.value.unshift(created)
  ├─ closeFormModal()
  └─ [エラー時] formErrors.title にメッセージ表示
```

---

## 4. モジュール設計

### Composable: `useAnnouncements.ts`

```typescript
// 公開インターフェース
interface UseAnnouncements {
  announcements:        Ref<Announcement[]>
  loading:              Ref<boolean>
  error:                Ref<string | null>
  fetchAnnouncements:   (filters?: Partial<AnnouncementFilters>, isHR?: boolean) => Promise<void>
  markAsRead:           (announcementId: string) => Promise<void>
  fetchUnreadCount:     () => Promise<number>
  createAnnouncement:   (form: AnnouncementFormData) => Promise<Announcement>
  updateAnnouncement:   (id: string, form: AnnouncementFormData) => Promise<Announcement>
  deleteAnnouncement:   (id: string) => Promise<void>
}
```

#### メソッド定義

| メソッド | 引数 | 戻り値 | 処理概要 |
|---------|------|--------|---------|
| `fetchAnnouncements` | `filters?: Partial<AnnouncementFilters>`, `isHR?: boolean` | `Promise<void>` | 一覧取得 + 既読状態付与 |
| `attachReadStatus` | なし（private） | `Promise<void>` | announcement_reads から既読セット作成し付与 |
| `markAsRead` | `announcementId: string` | `Promise<void>` | upsert で既読登録 |
| `fetchUnreadCount` | なし | `Promise<number>` | 公開済みお知らせ数 − 既読数 |
| `createAnnouncement` | `form: AnnouncementFormData` | `Promise<Announcement>` | INSERT + select |
| `updateAnnouncement` | `id: string`, `form: AnnouncementFormData` | `Promise<Announcement>` | PATCH + select |
| `deleteAnnouncement` | `id: string` | `Promise<void>` | DELETE |
| `buildPayload` | `form: AnnouncementFormData` | `object` (private) | trim / 空→null 正規化 |

---

## 5. データベース詳細設計

### announcements テーブル

| カラム名 | データ型 | NULL | デフォルト | 制約 | 説明 |
|---------|---------|------|-----------|------|------|
| id | UUID | NOT NULL | gen_random_uuid() | PK | お知らせ ID |
| title | TEXT | NOT NULL | - | len 1〜200 | タイトル |
| body | TEXT | NOT NULL | - | len >= 1 | 本文 |
| category | TEXT | NOT NULL | 'general' | CHECK (4 種) | カテゴリ |
| is_pinned | BOOLEAN | NOT NULL | FALSE | - | ピン留めフラグ |
| published_at | TIMESTAMPTZ | NULL | - | - | NULL = 下書き |
| expires_at | TIMESTAMPTZ | NULL | - | - | NULL = 無期限 |
| created_by | UUID | NOT NULL | - | FK auth.users | 作成者 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | - | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | Trigger | 更新日時 |

### announcement_reads テーブル

| カラム名 | データ型 | NULL | デフォルト | 制約 | 説明 |
|---------|---------|------|-----------|------|------|
| announcement_id | UUID | NOT NULL | - | PK, FK announcements | お知らせ ID |
| user_id | UUID | NOT NULL | - | PK, FK auth.users | 既読ユーザー |
| read_at | TIMESTAMPTZ | NOT NULL | NOW() | - | 既読日時 |

### インデックス

| インデックス名 | 対象カラム | 種類 | 目的 |
|--------------|-----------|------|------|
| idx_announcements_published_at | published_at DESC NULLS LAST | B-tree | 一覧ソート高速化 |
| idx_announcements_category | category | B-tree | カテゴリフィルター |
| idx_announcements_is_pinned | is_pinned WHERE is_pinned=TRUE | Partial | ピン留め抽出 |
| idx_announcements_expires_at | expires_at WHERE IS NOT NULL | Partial | 有効期限チェック |
| idx_announcement_reads_user | user_id | B-tree | 既読状態取得 |

### RLS ポリシー一覧

| ポリシー名 | 操作 | 対象 | 条件 |
|-----------|------|------|------|
| announcements_authenticated_select | SELECT | 全認証ユーザー | 公開済み + 有効期限内 |
| announcements_hr_select_all | SELECT | hr / admin | 全件（下書き含む） |
| announcements_hr_insert | INSERT | hr / admin | profiles.role IN ('hr','admin') |
| announcements_hr_update | UPDATE | hr / admin | profiles.role IN ('hr','admin') |
| announcements_hr_delete | DELETE | hr / admin | profiles.role IN ('hr','admin') |
| announcement_reads_owner | ALL | 本人 | user_id = auth.uid() |

> `announcements_hr_select_all` は `announcements_authenticated_select` と OR 評価される。

---

## 6. 外部 IF 詳細仕様

Supabase PostgREST を経由。supabase-js が HTTP リクエストを構築するため、
アプリコードはクエリビルダー API を使用する。

| パラメータ | 説明 |
|-----------|------|
| `Authorization` ヘッダー | `Bearer {JWT}` — supabase-js が自動付与 |
| `Content-Type` | application/json |
| エラーレスポンス | `{ message: string, code: string }` |

---

## 7. バッチ処理詳細設計

有効期限切れの非表示は RLS + アプリ WHERE 句で対応するため、バッチ不要。

---

## 8. セキュリティ設計

### 認証・認可

| レイヤー | 実装 | 内容 |
|---------|------|------|
| ルートガード | Vue Router `beforeEach` | 未認証ユーザーはログイン画面へリダイレクト |
| UI 表示制御 | `v-if="auth.isHR"` | 作成・編集・削除ボタンを HR/admin 以外は非表示 |
| DB アクセス制御 | Supabase RLS | 一般従業員・マネージャーは INSERT/UPDATE/DELETE 不可 |
| 下書き保護 | RLS `announcements_hr_select_all` | 下書きは HR/admin のみ SELECT 可能 |

### XSS 対策

- 本文表示に `v-html` を使用しない（`{{ item.body }}` テキスト挿入のみ）
- `white-space: pre-wrap` CSS で改行を表示（HTML 解釈なし）
- タイトル・本文は DB 保存前に `.trim()` のみ実施

### 入力バリデーション

| 項目 | クライアント | DB 制約 |
|------|------------|---------|
| タイトル | 空チェック | `char_length(title) BETWEEN 1 AND 200` |
| 本文 | 空チェック | `char_length(body) >= 1` |
| カテゴリ | select 固定選択 | `CHECK (category IN (...))` |
