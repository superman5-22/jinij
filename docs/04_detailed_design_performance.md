# 詳細設計書（追補）— 目標・評価管理機能

**システム名**: jinij — 社内人事管理システム
**対象機能**: 目標・評価管理（F-80〜F-89）
**バージョン**: 1.0
**作成日**: 2026-03-30

---

## 1. 画面詳細設計 — SCR-11 目標・評価管理画面

### 1.1 画面レイアウト

```
┌─────────────────────────────────────────────────────┐
│ [ページヘッダー]                                      │
│  タイトル: 目標・評価管理                              │
│  サブタイトル: 期間: {currentPeriod.name}            │
│  右側: [評価期間セレクト ▼] [+ 目標を追加]           │
├─────────────────────────────────────────────────────┤
│ [タブバー]                                           │
│  [目標一覧] [評価]                                   │
├─────────────────────────────────────────────────────┤
│ [タブコンテンツ]                                      │
│                                                     │
│  （目標一覧タブ）                                     │
│  ┌──────────────────────────────┐                  │
│  │ [業務目標] [進行中]           │  ← 目標カード     │
│  │ 売上120%達成                  │                  │
│  │ 前年比120%の売上目標達成       │                  │
│  │ 目標値: 120%  ウェイト: 60%  │                  │
│  │ [完了にする] [削除]           │                  │
│  └──────────────────────────────┘                  │
│                                                     │
│  （評価タブ）                                         │
│  ┌──────────────────────────────┐                  │
│  │ 2026年上期 評価   [自己評価中]│  ← 評価カード     │
│  │ ★☆☆☆☆ スコア選択           │                  │
│  │ [コメント入力欄]              │                  │
│  │ [自己評価を提出する]          │                  │
│  └──────────────────────────────┘                  │
└─────────────────────────────────────────────────────┘
```

### 1.2 項目定義

| 項目名 | 型 | 必須 | バリデーション | 備考 |
|---|---|---|---|---|
| 評価期間セレクト | select | - | - | 進行中の期間を初期選択 |
| 目標タイトル | text | ○ | 1〜100文字 | 空不可 |
| 目標カテゴリ | select | ○ | business/skill/behavior/other | デフォルト: business |
| 詳細説明 | textarea | - | 最大 500文字 | 任意 |
| 目標値 | text | - | 最大 100文字 | 定量目標の記述（任意） |
| ウェイト | number | ○ | 1〜100 の整数 | デフォルト: 100 |
| 自己評価スコア | star（1〜5） | ○（提出時） | 1〜5 の整数 | デフォルト: 3 |
| 自己評価コメント | textarea | ○（提出時） | 空不可（trim後） | - |
| 上長評価スコア | star（1〜5） | ○（確定時） | 1〜5 の整数 | - |
| 上長評価コメント | textarea | ○（確定時） | 空不可 | - |
| 最終評価ランク | select | ○（確定時） | S/A/B/C/D | - |

### 1.3 イベント処理

| イベント | 処理内容 |
|---|---|
| 評価期間セレクト変更 | `fetchGoals(employeeId, periodId)` と `fetchReviews(undefined, periodId)` を呼び出す |
| 「+ 目標を追加」ボタン押下 | 目標追加モーダルを表示 |
| 「完了にする」ボタン押下 | `updateGoalStatus(id, 'completed')` を呼び出し、一覧を再取得 |
| 「削除」ボタン押下 | confirm ダイアログ → `deleteGoal(id)` を呼び出し |
| 星ボタン押下 | `selfForm.self_score` または `managerForm.manager_score` を更新 |
| 「自己評価を提出する」押下 | `submitSelfReview()` → 評価を再取得 |
| 「評価を確定する」押下 | `submitManagerReview()` → 評価を再取得 |

---

## 2. 機能詳細設計（処理フロー）

### 2.1 目標登録フロー

```
[ユーザー] 「+ 目標を追加」クリック
    │
    ▼
モーダル表示（初期値設定）
    │
[入力]
    │
[追加するボタン] クリック
    │
バリデーション（title 空チェック）
    │ NG → エラー表示（return）
    │ OK
    ▼
usePerformance.createGoal(form)
    │
Supabase INSERT goals
    │ エラー → error.value にセット
    │ OK
    ▼
モーダルクローズ
    │
fetchGoals(employeeId, selectedPeriodId)
    │
一覧更新
```

### 2.2 自己評価フロー

```
[評価ステータス: self_review]
    │
[スコア選択・コメント入力]
    │
「自己評価を提出する」クリック
    │
submitSelfReview(reviewId, { self_score, self_comment })
    │
バリデーション（score: 1〜5, comment: 必須）
    │ NG → throw Error（呼び出し元でキャッチ）
    │ OK
    ▼
Supabase UPDATE performance_reviews
  SET self_score, self_comment, status='manager_review'
    │
評価レコード再取得 → UI 更新（上長評価フォームへ切り替え）
```

### 2.3 上長評価確定フロー

```
[評価ステータス: manager_review & isManagerOrAbove]
    │
[スコア・コメント・ランク入力]
    │
「評価を確定する」クリック
    │
submitManagerReview(reviewId, reviewerId, { manager_score, manager_comment, final_rank })
    │
バリデーション（score: 1〜5, comment: 必須）
    │ NG → throw Error
    │ OK
    ▼
Supabase UPDATE performance_reviews
  SET reviewer_id, manager_score, manager_comment,
      final_rank, status='completed', completed_at=now()
    │
評価レコード再取得 → UI 更新（完了サマリー表示）
```

---

## 3. モジュール設計

### 3.1 composable: `usePerformance`

| 関数名 | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `fetchPeriods()` | なし | `Promise<void>` | 全評価期間を取得 |
| `activePeriod()` | なし | `ReviewPeriod \| undefined` | `is_active=true` の期間を返す |
| `fetchGoals(employeeId, periodId?)` | `string, string?` | `Promise<void>` | 目標一覧を取得 |
| `createGoal(form)` | `GoalFormData` | `Promise<Goal>` | 目標を登録 |
| `updateGoalStatus(id, status)` | `string, GoalStatus` | `Promise<void>` | 目標ステータスを更新 |
| `deleteGoal(id)` | `string` | `Promise<void>` | 目標を削除 |
| `fetchReviews(employeeId?, periodId?)` | `string?, string?` | `Promise<void>` | 評価一覧を取得 |
| `startReview(employeeId, periodId)` | `string, string` | `Promise<PerformanceReview>` | 評価レコードを作成 |
| `submitSelfReview(reviewId, form)` | `string, SelfReviewFormData` | `Promise<void>` | 自己評価を提出 |
| `submitManagerReview(reviewId, reviewerId, form)` | `string, string, ManagerReviewFormData` | `Promise<void>` | 上長評価を確定 |

**バリデーションロジック（`submitSelfReview`）**:
```
if (form.self_score < 1 || form.self_score > 5) → throw Error('自己評価スコアは1〜5で入力してください')
if (!form.self_comment.trim()) → throw Error('自己評価コメントを入力してください')
```

**バリデーションロジック（`submitManagerReview`）**:
```
if (form.manager_score < 1 || form.manager_score > 5) → throw Error('評価スコアは1〜5で入力してください')
if (!form.manager_comment.trim()) → throw Error('評価コメントを入力してください')
```

---

## 4. データベース詳細設計

### 4.1 review_periods テーブル

| カラム名 | 型 | PK | NOT NULL | デフォルト | 制約 |
|---|---|---|---|---|---|
| id | UUID | ○ | ○ | gen_random_uuid() | - |
| name | TEXT | - | ○ | - | - |
| start_date | DATE | - | ○ | - | - |
| end_date | DATE | - | ○ | - | end_date > start_date |
| is_active | BOOLEAN | - | ○ | false | - |
| created_at | TIMESTAMPTZ | - | ○ | now() | - |

### 4.2 goals テーブル

| カラム名 | 型 | PK | FK | NOT NULL | デフォルト | 制約 |
|---|---|---|---|---|---|---|
| id | UUID | ○ | - | ○ | gen_random_uuid() | - |
| employee_id | UUID | - | employees(id) | ○ | - | ON DELETE CASCADE |
| review_period_id | UUID | - | review_periods(id) | ○ | - | ON DELETE CASCADE |
| title | TEXT | - | - | ○ | - | - |
| description | TEXT | - | - | - | - | nullable |
| category | TEXT | - | - | ○ | 'business' | IN ('business','skill','behavior','other') |
| target_value | TEXT | - | - | - | - | nullable |
| weight | INTEGER | - | - | ○ | 100 | BETWEEN 1 AND 100 |
| status | TEXT | - | - | ○ | 'draft' | IN ('draft','active','completed','cancelled') |
| created_at | TIMESTAMPTZ | - | - | ○ | now() | - |
| updated_at | TIMESTAMPTZ | - | - | ○ | now() | トリガー自動更新 |

### 4.3 performance_reviews テーブル

| カラム名 | 型 | PK | FK | NOT NULL | デフォルト | 制約 |
|---|---|---|---|---|---|---|
| id | UUID | ○ | - | ○ | gen_random_uuid() | - |
| employee_id | UUID | - | employees(id) | ○ | - | ON DELETE CASCADE |
| review_period_id | UUID | - | review_periods(id) | ○ | - | ON DELETE CASCADE |
| reviewer_id | UUID | - | profiles(id) | - | - | nullable |
| self_score | INTEGER | - | - | - | - | BETWEEN 1 AND 5, nullable |
| self_comment | TEXT | - | - | - | - | nullable |
| manager_score | INTEGER | - | - | - | - | BETWEEN 1 AND 5, nullable |
| manager_comment | TEXT | - | - | - | - | nullable |
| final_rank | TEXT | - | - | - | - | IN ('S','A','B','C','D'), nullable |
| status | TEXT | - | - | ○ | 'draft' | IN ('draft','self_review','manager_review','completed') |
| completed_at | TIMESTAMPTZ | - | - | - | - | nullable |
| created_at | TIMESTAMPTZ | - | - | ○ | now() | - |
| updated_at | TIMESTAMPTZ | - | - | ○ | now() | トリガー自動更新 |

**ユニーク制約**: `UNIQUE (employee_id, review_period_id)`

---

## 5. RLS ポリシー詳細

### goals テーブル

| 操作 | 許可条件 |
|---|---|
| SELECT | `is_admin_or_hr()` OR `is_manager_or_above()` OR 本人（`employee_id` が自分の従業員レコード） |
| INSERT | `is_admin_or_hr()` OR 本人 |
| UPDATE | `is_admin_or_hr()` OR 本人 |
| DELETE | `is_admin_or_hr()` のみ |

### performance_reviews テーブル

| 操作 | 許可条件 |
|---|---|
| SELECT | `is_admin_or_hr()` OR `reviewer_id = auth.uid()` OR 本人 |
| INSERT | `is_admin_or_hr()` OR `reviewer_id = auth.uid()` |
| UPDATE | `is_admin_or_hr()` OR `reviewer_id = auth.uid()` OR 本人 |
| DELETE | `is_admin_or_hr()` のみ |

---

## 6. セキュリティ設計

| 脅威 | 対策 |
|---|---|
| 他人の目標・評価閲覧 | RLS で employee_id 単位のアクセス制限 |
| 不正な自己評価スコア | Composable 側バリデーション（1〜5） + DB CHECK 制約 |
| 評価フェーズの不正スキップ | status カラムの遷移をアプリコードで制御（draft→self_review→manager_review→completed） |
| 上長でない者による評価確定 | Vue コンポーネントの `isManagerOrAbove` computed で UI 制御 |
