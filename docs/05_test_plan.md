# テスト計画書 — 目標・評価管理機能

**システム名**: jinij — 社内人事管理システム
**対象機能**: 目標・評価管理（F-80〜F-89）
**バージョン**: 1.0
**作成日**: 2026-03-30

---

## 1. 単体テスト（Unit Test）

### 1.1 テスト対象

| 対象 | ファイルパス |
|---|---|
| `usePerformance` composable | `frontend/src/composables/usePerformance.ts` |
| テストファイル | `frontend/src/composables/__tests__/usePerformance.test.ts` |

### 1.2 テスト観点・ケース一覧

#### 初期状態

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-01 | goals の初期値 | なし | 空配列 `[]` | ✅ PASS |
| U-02 | reviews の初期値 | なし | 空配列 `[]` | ✅ PASS |
| U-03 | periods の初期値 | なし | 空配列 `[]` | ✅ PASS |
| U-04 | loading の初期値 | なし | `false` | ✅ PASS |
| U-05 | error の初期値 | なし | `null` | ✅ PASS |

#### fetchPeriods

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-06 | 正常取得 | Supabase が 2件返す | `periods.value` が 2件 | ✅ PASS |
| U-07 | 取得後の loading | 正常レスポンス | `loading.value === false` | ✅ PASS |
| U-08 | 例外発生時 | reject | `error.value` にメッセージ | ✅ PASS |
| U-09 | data が null | `{data: null}` | `periods.value === []` | ✅ PASS |

#### activePeriod

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-10 | is_active=true が存在 | 2件（active/inactive） | active な期間を返す | ✅ PASS |
| U-11 | is_active=true が不在 | 1件（inactive） | `undefined` を返す | ✅ PASS |

#### fetchGoals

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-12 | employee_id で取得 | `employeeId='emp-001'` | `goals.value` に結果がセット | ✅ PASS |
| U-13 | 例外発生時 | reject | `error.value` にメッセージ | ✅ PASS |

#### createGoal

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-14 | 正常作成 | 正常フォームデータ | 作成した Goal オブジェクトを返す | ✅ PASS |
| U-15 | Supabase エラー | `{error:{message:'登録失敗'}}` | 例外を投げる（message: '登録失敗'） | ✅ PASS |

#### updateGoalStatus

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-16 | 正常更新 | id='goal-001', status='completed' | 例外なし | ✅ PASS |
| U-17 | Supabase エラー | `{error:{message:'更新失敗'}}` | 例外を投げる | ✅ PASS |

#### deleteGoal

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-18 | 正常削除 | id='goal-001' | 例外なし | ✅ PASS |
| U-19 | Supabase エラー | `{error:{message:'削除失敗'}}` | 例外を投げる | ✅ PASS |

#### submitSelfReview（バリデーション）

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-20 | スコア = 0（範囲外） | self_score: 0 | throw '自己評価スコアは1〜5で入力してください' | ✅ PASS |
| U-21 | スコア = 6（範囲外） | self_score: 6 | throw '自己評価スコアは1〜5で入力してください' | ✅ PASS |
| U-22 | コメント空 | self_comment: '   ' | throw '自己評価コメントを入力してください' | ✅ PASS |
| U-23 | 正常入力 | score: 4, comment: 'よく頑張った' | update が呼ばれる（status='manager_review'） | ✅ PASS |

#### submitManagerReview（バリデーション）

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-24 | スコア = 0（範囲外） | manager_score: 0 | throw '評価スコアは1〜5で入力してください' | ✅ PASS |
| U-25 | コメント空 | manager_comment: '' | throw '評価コメントを入力してください' | ✅ PASS |
| U-26 | 正常入力 | score: 4, comment: '達成', rank: 'A' | status='completed' で update が呼ばれる | ✅ PASS |
| U-27 | Supabase エラー | `{error:{message:'評価確定失敗'}}` | 例外を投げる | ✅ PASS |

#### startReview

| No | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| U-28 | 正常開始 | employeeId, periodId | status='self_review' の PerformanceReview | ✅ PASS |
| U-29 | Supabase エラー | `{error:{message:'評価開始失敗'}}` | 例外を投げる | ✅ PASS |

### 1.3 テスト実施記録

| 項目 | 内容 |
|---|---|
| **実施日** | 2026-03-30 |
| **実施者** | Claude Code |
| **実行コマンド** | `cd frontend && npx vitest run` |
| **テストファイル数** | 6 |
| **総テスト数** | 142 件（新規: 29 件） |
| **合格数** | 142 件 |
| **不合格数** | 0 件 |
| **所要時間** | 1.45 秒 |

---

## 2. 結合テスト（Integration Test）

### 2.1 テスト対象インターフェース

| テスト ID | 連携対象 | 観点 |
|---|---|---|
| IT-01 | PerformanceView ↔ usePerformance | 評価期間変更時に goals/reviews が正しく再取得される |
| IT-02 | usePerformance ↔ Supabase REST API | goals テーブルへの CRUD が RLS 込みで正常動作する |
| IT-03 | usePerformance ↔ Supabase REST API | performance_reviews の INSERT〜UPDATE が一貫して動作する |
| IT-04 | PerformanceView ↔ useAuthStore | isManagerOrAbove computed が role に応じて UI を切り替える |
| IT-05 | router ↔ AppSidebar ↔ PerformanceView | `/performance` へのルーティングが認証後のみ通過する |

### 2.2 テストケース

#### IT-01: 評価期間セレクト変更 → 再取得

| 項目 | 内容 |
|---|---|
| **前提条件** | Supabase に期間 A・B、各期間の目標・評価レコードが存在 |
| **テスト手順** | 1. SCR-11 を開く（期間 A が初期選択） → 目標一覧に期間Aの目標が表示される / 2. 評価期間セレクトで期間 B を選択 → watch が発火 → fetchGoals・fetchReviews が呼ばれる |
| **期待結果** | 目標一覧・評価カードが期間 B のデータに切り替わる |
| **使用環境** | ローカル Dev（Vite + Supabase ローカル） |

#### IT-02: 目標登録 → 一覧反映

| 項目 | 内容 |
|---|---|
| **前提条件** | 認証済みユーザー（employee ロール）、評価期間が選択済み |
| **テスト手順** | 1. 「+ 目標を追加」クリック → モーダル表示 / 2. タイトル・カテゴリ・ウェイトを入力して「追加する」 / 3. モーダルが閉じ、一覧に新しい目標カードが表示される |
| **期待結果** | `goals` テーブルにレコードが INSERT され、goals.value が更新される |
| **使用環境** | ローカル Dev |

#### IT-03: 自己評価 → 上長評価フロー

| 項目 | 内容 |
|---|---|
| **前提条件** | `performance_reviews.status = 'self_review'` のレコードが存在 |
| **テスト手順** | 1. 評価タブを開く / 2. スコア 4・コメント入力 → 「自己評価を提出する」 / 3. status が `manager_review` に変わり、上長評価フォームに切り替わる / 4. 上長ロールでログイン → スコア・コメント・ランク入力 → 「評価を確定する」 |
| **期待結果** | `status = 'completed'`、`final_rank` がセットされる。評価サマリーが表示される |
| **使用環境** | ローカル Dev（employee + manager 2ユーザー用意） |

#### IT-04: ロール制御

| 項目 | 内容 |
|---|---|
| **前提条件** | employee ロールユーザー |
| **テスト手順** | 上長評価フォームが `status = 'manager_review'` 中に表示されないことを確認 |
| **期待結果** | `isManagerOrAbove = false` のため、上長評価フォームが非表示 |
| **使用環境** | ローカル Dev |

#### IT-05: ルーティング認証ガード

| 項目 | 内容 |
|---|---|
| **前提条件** | 未認証状態 |
| **テスト手順** | `/performance` に直接アクセス |
| **期待結果** | `/login` にリダイレクトされる |
| **使用環境** | ローカル Dev |

---

## 3. 総合テスト（System Test）

### 3.1 テスト対象機能・画面

- SCR-11 目標・評価管理画面（全操作）
- 全ロール（employee / manager / hr / admin）での動作
- 評価フロー全体（目標登録 → 評価開始 → 自己評価 → 上長評価 → 完了）

### 3.2 テストシナリオ

#### シナリオ ST-01: 従業員が目標を設定し、評価サイクルを完了する

| ステップ | 操作 | 期待結果 |
|---|---|---|
| 1 | employee ロールでログイン → サイドバー「目標・評価」クリック | SCR-11 が表示される。進行中の評価期間が自動選択される |
| 2 | 「+ 目標を追加」→ 業務目標「売上120%達成」ウェイト60%で登録 | 目標カードが一覧に追加される |
| 3 | 「+ 目標を追加」→ スキル目標「データ分析資格取得」ウェイト40%で登録 | 2件の目標カードが表示される |
| 4 | 「評価」タブを開く → 「評価を開始する」クリック | 評価カードが表示され、status が self_review になる |
| 5 | 自己評価スコア 4・コメントを入力 → 「自己評価を提出する」 | status が manager_review に変わる。上長評価待ちの状態が表示される |
| 6 | manager ロールでログイン → SCR-11 を開く | employee の評価レコードが表示される（manager_review 状態） |
| 7 | スコア 4・コメント・ランク「A」を選択 → 「評価を確定する」 | status が completed になる。評価サマリー（自己評価・上長評価・ランク A）が表示される |
| 8 | employee ロールで再ログイン → SCR-11 評価タブ確認 | 最終評価「A（優秀）」が評価カードに表示される |

#### シナリオ ST-02: バリデーションエラー確認

| ステップ | 操作 | 期待結果 |
|---|---|---|
| 1 | 目標追加モーダルでタイトルを空のまま「追加する」 | 処理が中断される（title 空チェック） |
| 2 | 自己評価スコアを選択せず（初期値 3）、コメント空のまま「提出」 | エラー: 「自己評価コメントを入力してください」 |
| 3 | 上長評価でコメント空のまま「確定」 | エラー: 「評価コメントを入力してください」 |

#### シナリオ ST-03: 非機能要件確認

| 確認項目 | 基準 | 確認方法 |
|---|---|---|
| 画面表示速度 | 3秒以内 | ブラウザ DevTools Network タブで確認 |
| 他ユーザーのデータ非閲覧 | RLS による遮断 | 別ユーザーで `/rest/v1/goals` を直接クエリ |
| 期間未選択時の空状態 | 空状態 UI が表示される | 評価期間セレクトをクリアして確認 |

### 3.3 合否判定基準

| カテゴリ | 基準 |
|---|---|
| **必須合格** | シナリオ ST-01 の全ステップが期待結果通りに動作する |
| **必須合格** | シナリオ ST-02 の全バリデーションエラーが適切に表示される |
| **重大欠陥（リリース不可）** | 他ユーザーの評価データが閲覧できる RLS 不備 |
| **重大欠陥（リリース不可）** | 評価フロー（draft→completed）が飛ばしてステータス変更できる |
| **軽微（次フェーズ対応可）** | UI レイアウトの崩れ（デザイン微調整） |

### 3.4 テスト環境

| 項目 | 仕様 |
|---|---|
| フロントエンド | Vite Dev Server（port 5173）または Vercel Preview |
| データベース | Supabase ローカル または Staging プロジェクト |
| ブラウザ | Chrome 最新版（主） / Firefox 最新版（確認用） |
| テストデータ | `003_seed_data.sql` のサンプルデータ + `007_performance.sql` のサンプル期間 |
| ユーザー | employee / manager / hr / admin 各ロール 1名ずつ用意 |
