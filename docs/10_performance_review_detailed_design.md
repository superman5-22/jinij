# 人事評価機能 — 詳細設計書

**システム名**: jinij — 社内人事管理システム（追加機能）
**機能名**: 人事評価管理（Performance Review）
**バージョン**: 1.0
**作成日**: 2026-03-30

---

## 1. 画面詳細設計

### SCR-80: 人事評価一覧画面

#### レイアウト

```
┌──────────────────────────────────────────────────────┐
│ 人事評価                              [新規登録ボタン] │
│ 従業員の定期評価の登録・確認                          │
├──────────────────────────────────────────────────────┤
│ フィルターカード                                      │
│ [従業員▼] [年度▼] [種別▼] [ステータス▼] [絞り込み]  │
├──────────────────────────────────────────────────────┤
│ 評価テーブル                                          │
│ 従業員 | 年度・種別 | 総合評価 | 業績 | 行動 | スキル │
│ | ステータス | 操作                                   │
└──────────────────────────────────────────────────────┘
```

#### 項目定義

| 項目名 | 型 | 説明 |
|---|---|---|
| 従業員フィルター | select | hr/admin/manager のみ表示。全従業員 or 特定従業員 |
| 年度フィルター | select | 2020年〜翌年 |
| 種別フィルター | select | quarterly / semi_annual / annual |
| ステータスフィルター | select | draft / submitted / acknowledged |
| 絞り込みボタン | button | fetchReviews を呼び出す |

#### 操作ボタン表示条件

| ボタン | 表示条件 |
|---|---|
| 新規登録 | hr, admin, manager のみ表示 |
| 詳細（目アイコン） | 全ユーザー（閲覧可能なレコードのみ） |
| 編集（鉛筆アイコン） | hr/admin/manager かつ status === 'draft' |
| 提出（送信アイコン） | hr/admin/manager かつ status === 'draft' |
| 確認済み（チェックアイコン） | 被評価者本人 かつ status === 'submitted' |
| 削除（ゴミ箱アイコン） | hr/admin かつ status === 'draft' |

#### 入力チェック（フィルター）

- 全項目任意入力。未選択時は全件表示

---

### SCR-81: 評価登録・編集モーダル

#### 項目定義

| 項目名 | 必須 | 型 | 制約 |
|---|---|---|---|
| 従業員 | ○ | select | アクティブ従業員のみ。編集時は変更不可 |
| 評価年度 | ○ | select | 2020〜翌年 |
| 評価種別 | ○ | select | quarterly / semi_annual / annual |
| 四半期 | △ | select | review_type = 'quarterly' の場合のみ表示・必須。Q1〜Q4 |
| 総合評価 | ○ | select | 1〜5（1=S卓越〜5=D不十分） |
| 業績評価 | ○ | select | 1〜5 |
| 行動評価 | ○ | select | 1〜5 |
| スキル評価 | ○ | select | 1〜5 |
| 目標達成状況 | - | textarea | 最大2000文字 |
| 強み | - | textarea | 最大2000文字 |
| 改善点 | - | textarea | 最大2000文字 |
| 次期目標 | - | textarea | 最大2000文字 |
| 評価者コメント | - | textarea | 最大2000文字 |

#### バリデーション

| チェック | エラー表示 |
|---|---|
| 従業員未選択 | required 属性により HTML5 バリデーション |
| quarterly で四半期未選択 | `alert('四半期を選択してください')` |
| 各スコアの範囲 | select の選択肢を 1〜5 に限定することで保証 |

---

## 2. 機能詳細設計（処理フロー）

### F-81: 評価新規登録フロー

```
ユーザーが「新規登録」ボタンをクリック
  └→ openModal(null) 呼び出し
      └→ form をデフォルト値でリセット
      └→ showModal = true
         ↓
ユーザーがフォームを入力して「保存」をクリック
  └→ saveReview() 呼び出し
      ├→ [validation] employee_id が空 → 処理中断
      ├→ [validation] quarterly & quarter なし → alert → 処理中断
      ├→ quarterly でない場合 → review_quarter = null にリセット
      └→ createReview(form) 呼び出し
          └→ supabase.auth.getUser() で認証確認
              ├→ 未認証 → error セット → null 返却
              └→ supabase.from('performance_reviews').insert(payload)
                  ├→ 成功 → closeModal() → fetchReviews() → 一覧更新
                  └→ 失敗 → error.value にメッセージをセット
```

### F-83: 評価提出フロー

```
ユーザーが「提出（送信アイコン）」ボタンをクリック
  └→ submitReview(id) 呼び出し
      └→ confirm() ダイアログ
          ├→ キャンセル → 処理中断
          └→ OK → changeStatus(id, 'submitted') 呼び出し
              └→ supabase.from('performance_reviews')
                    .update({ status: 'submitted', submitted_at: now })
                    .eq('id', id)
                  ├→ 成功 → reviews.value 内の該当レコードのステータスを更新
                  │         → DB トリガーが通知を自動生成
                  └→ 失敗 → error.value にメッセージをセット
```

### F-84: 評価確認（本人確認）フロー

```
ユーザーが「確認済みにする（チェックアイコン）」ボタンをクリック
  └→ acknowledgeReview(id) 呼び出し
      └→ confirm() ダイアログ
          ├→ キャンセル → 処理中断
          └→ OK → changeStatus(id, 'acknowledged') 呼び出し
              └→ supabase.from('performance_reviews')
                    .update({ status: 'acknowledged', acknowledged_at: now })
                    .eq('id', id)
                  ├→ 成功 → reviews.value 内の該当レコードのステータスを更新
                  └→ 失敗 → error.value にメッセージをセット
```

---

## 3. モジュール設計

### 3.1 `usePerformanceReviews` Composable

**ファイルパス**: `frontend/src/composables/usePerformanceReviews.ts`

| 関数名 | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `fetchReviews` | `filters?: Partial<PerformanceReviewFilters>` | `Promise<void>` | フィルタ付き一覧取得 |
| `fetchReview` | `id: string` | `Promise<void>` | 単件取得、current に格納 |
| `createReview` | `form: PerformanceReviewFormData` | `Promise<PerformanceReview \| null>` | 新規登録 |
| `updateReview` | `id: string, form: Partial<PerformanceReviewFormData>` | `Promise<PerformanceReview \| null>` | 更新 |
| `changeStatus` | `id: string, newStatus: ReviewStatus` | `Promise<boolean>` | ステータス変更 |
| `deleteReview` | `id: string` | `Promise<boolean>` | 削除 |

**State**

| 変数名 | 型 | 説明 |
|---|---|---|
| `reviews` | `Ref<PerformanceReview[]>` | 一覧データ |
| `current` | `Ref<PerformanceReview \| null>` | 単件データ |
| `isLoading` | `Ref<boolean>` | ローディング状態 |
| `error` | `Ref<string \| null>` | エラーメッセージ |

### 3.2 型定義

**ファイルパス**: `frontend/src/types/index.ts`

```typescript
export type ReviewType   = 'quarterly' | 'semi_annual' | 'annual'
export type ReviewStatus = 'draft' | 'submitted' | 'acknowledged'

export interface PerformanceReview { /* ... */ }
export interface PerformanceReviewFormData { /* ... */ }
export interface PerformanceReviewFilters { /* ... */ }

export const REVIEW_TYPE_LABELS:   Record<ReviewType, string>
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string>
export const RATING_LABELS:        Record<number, string>
```

---

## 4. データベース詳細設計

### テーブル定義: `performance_reviews`

| カラム名 | データ型 | NULL | デフォルト | 制約 | 説明 |
|---|---|---|---|---|---|
| id | UUID | NOT NULL | gen_random_uuid() | PRIMARY KEY | レコードID |
| employee_id | UUID | NOT NULL | - | FK: employees.id CASCADE | 被評価者ID |
| reviewer_id | UUID | NULL | - | FK: auth.users.id | 評価者ID |
| review_year | INTEGER | NOT NULL | - | CHECK (2000〜2100) | 評価年度 |
| review_type | TEXT | NOT NULL | 'annual' | CHECK IN ('quarterly','semi_annual','annual') | 評価種別 |
| review_quarter | INTEGER | NULL | - | CHECK (1〜4) | 四半期（quarterly のみ） |
| overall_rating | INTEGER | NOT NULL | 3 | CHECK (1〜5) | 総合評価 |
| performance_score | INTEGER | NOT NULL | 3 | CHECK (1〜5) | 業績評価 |
| behavior_score | INTEGER | NOT NULL | 3 | CHECK (1〜5) | 行動評価 |
| skill_score | INTEGER | NOT NULL | 3 | CHECK (1〜5) | スキル評価 |
| goals_achievement | TEXT | NULL | - | - | 目標達成状況 |
| strengths | TEXT | NULL | - | - | 強み |
| improvements | TEXT | NULL | - | - | 改善点 |
| next_goals | TEXT | NULL | - | - | 次期目標 |
| self_comment | TEXT | NULL | - | - | 本人コメント |
| reviewer_comment | TEXT | NULL | - | - | 評価者コメント |
| status | TEXT | NOT NULL | 'draft' | CHECK IN ('draft','submitted','acknowledged') | ステータス |
| submitted_at | TIMESTAMPTZ | NULL | - | - | 提出日時 |
| acknowledged_at | TIMESTAMPTZ | NULL | - | - | 確認日時 |
| created_by | UUID | NULL | - | FK: auth.users.id | 作成者 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | - | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | - | 更新日時（トリガー更新） |

**UNIQUE制約**: `(employee_id, review_year, review_type, review_quarter)`

**インデックス**:
- `idx_performance_reviews_employee_id`
- `idx_performance_reviews_reviewer_id`
- `idx_performance_reviews_year_type`
- `idx_performance_reviews_status`

---

## 5. RLS ポリシー詳細

| ポリシー名 | 対象ロール | 操作 | 条件 |
|---|---|---|---|
| `perf_reviews_hr_admin_all` | hr, admin | ALL | profiles.role IN ('hr','admin') |
| `perf_reviews_manager_all` | manager | ALL | 自部署の従業員の評価に限る（manager の department_id と employee の department_id が一致） |
| `perf_reviews_employee_select` | employee | SELECT | 自身の employee レコードに紐づく評価、かつ status IN ('submitted','acknowledged') |
| `perf_reviews_employee_acknowledge` | employee | UPDATE | 自身の submitted 評価を acknowledged に限定更新 |

---

## 6. DB トリガー詳細

### `trg_notify_review_submitted`

| 項目 | 内容 |
|---|---|
| 発火条件 | `performance_reviews` の AFTER UPDATE |
| 発火タイミング | OLD.status = 'draft' かつ NEW.status = 'submitted' に変化したとき |
| 処理内容 | 被評価者の `user_id` を `employees` から取得し、`notifications` テーブルへ INSERT |
| 通知タイプ | `system` |
| 通知タイトル | `人事評価が提出されました` |
| 通知メッセージ | `{review_year}年度の人事評価が提出されました。内容をご確認ください。` |
| `related_id` | 評価レコードの UUID |
| NULL チェック | `user_id` が NULL の場合は通知を生成しない |

---

## 7. セキュリティ設計

| 脅威 | 対策 |
|---|---|
| 他人の評価データ閲覧 | RLS により DB レベルで行単位に制御 |
| employee が draft 評価を閲覧 | RLS `perf_reviews_employee_select` で status フィルタ |
| employee が draft → submitted へ変更 | RLS `perf_reviews_employee_acknowledge` で状態遷移を制限（submitted→acknowledged のみ許可） |
| 不正なスコア値挿入 | DB CHECK 制約（1〜5）でサーバーサイドバリデーション |
| 重複評価の登録 | DB UNIQUE 制約で防止 |
| 削除操作 | UI レベルで hr/admin かつ draft のみ表示。DB レベルでは RLS `perf_reviews_hr_admin_all` で制御 |
