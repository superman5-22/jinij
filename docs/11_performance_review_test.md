# 人事評価機能 — テスト仕様書

**システム名**: jinij — 社内人事管理システム（追加機能）
**機能名**: 人事評価管理（Performance Review）
**バージョン**: 1.0
**作成日**: 2026-03-30

---

## Part 1: 単体テスト（Unit Test）

**テストファイル**: `frontend/src/composables/__tests__/usePerformanceReviews.test.ts`
**テストフレームワーク**: Vitest + @vue/test-utils
**実行コマンド**: `npm run test`（または `npx vitest run`）

---

### 1.1 テスト対象

`usePerformanceReviews` composable の各関数

---

### 1.2 テスト観点・テストケース一覧

#### グループ1: 初期状態

| TC# | テスト観点 | 入力 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|---|
| UT-01 | `reviews` 初期値 | - | 空配列 `[]` | 2026-03-30 | ✅ PASS |
| UT-02 | `current` 初期値 | - | `null` | 2026-03-30 | ✅ PASS |
| UT-03 | `isLoading` 初期値 | - | `false` | 2026-03-30 | ✅ PASS |
| UT-04 | `error` 初期値 | - | `null` | 2026-03-30 | ✅ PASS |

#### グループ2: fetchReview（単件取得）

| TC# | テスト観点 | 入力 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|---|
| UT-05 | 正常取得 | id='rev-001' | `current` が取得レコードで更新される | 2026-03-30 | ✅ PASS |
| UT-06 | ローディング後始末 | 正常取得後 | `isLoading` が `false` に戻る | 2026-03-30 | ✅ PASS |
| UT-07 | Supabaseエラー | error.message='権限エラー' | `error.value` が '権限エラー' | 2026-03-30 | ✅ PASS |
| UT-08 | 例外スロー | Error('ネットワークエラー') | `error.value` が 'ネットワークエラー' | 2026-03-30 | ✅ PASS |

#### グループ3: createReview（登録）

| TC# | テスト観点 | 入力 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|---|
| UT-09 | 正常登録 | 有効フォームデータ | PerformanceReview オブジェクトが返る | 2026-03-30 | ✅ PASS |
| UT-10 | reviewer_id の設定 | 認証ユーザー id='usr-001' | insert に `reviewer_id: 'usr-001'` が渡される | 2026-03-30 | ✅ PASS |
| UT-11 | quarterly でない場合の review_quarter | review_type='annual', review_quarter=2 | insert に `review_quarter: null` が渡される | 2026-03-30 | ✅ PASS |
| UT-12 | 空文字フィールドの null 変換 | goals_achievement='', strengths='' | insert に `goals_achievement: null, strengths: null` | 2026-03-30 | ✅ PASS |
| UT-13 | 未認証 | getUser → null | `null` が返り `error.value` に '認証情報がありません' | 2026-03-30 | ✅ PASS |
| UT-14 | Supabaseエラー | error.message='重複エラー' | `null` が返り `error.value` が '重複エラー' | 2026-03-30 | ✅ PASS |
| UT-15 | ローディング後始末 | 正常登録後 | `isLoading` が `false` に戻る | 2026-03-30 | ✅ PASS |

#### グループ4: updateReview（更新）

| TC# | テスト観点 | 入力 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|---|
| UT-16 | 正常更新 | id='rev-001', overall_rating=2 | `current` が更新レコードで上書きされる | 2026-03-30 | ✅ PASS |
| UT-17 | eq に正しい id | id='rev-target' | `.eq('id', 'rev-target')` が呼ばれる | 2026-03-30 | ✅ PASS |
| UT-18 | 空文字の null 変換 | reviewer_comment='' | update に `reviewer_comment: null` が渡される | 2026-03-30 | ✅ PASS |
| UT-19 | Supabaseエラー | error.message='更新エラー' | `null` が返り `error.value` が '更新エラー' | 2026-03-30 | ✅ PASS |

#### グループ5: changeStatus（ステータス変更）

| TC# | テスト観点 | 入力 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|---|
| UT-20 | draft→submitted | status='submitted' | `true` が返り `reviews[0].status` が 'submitted' | 2026-03-30 | ✅ PASS |
| UT-21 | submitted→acknowledged | status='acknowledged' | `true` が返り `reviews[0].status` が 'acknowledged' | 2026-03-30 | ✅ PASS |
| UT-22 | Supabaseエラー | error.message='ステータスエラー' | `false` が返り `error.value` に 'ステータスエラー' | 2026-03-30 | ✅ PASS |
| UT-23 | ローディング後始末 | 変更成功後 | `isLoading` が `false` に戻る | 2026-03-30 | ✅ PASS |

#### グループ6: deleteReview（削除）

| TC# | テスト観点 | 入力 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|---|
| UT-24 | 正常削除 | id='rev-001'（2件中） | `true` が返り `reviews` から 'rev-001' が除去される | 2026-03-30 | ✅ PASS |
| UT-25 | eq に正しい id | id='rev-target' | `.eq('id', 'rev-target')` が呼ばれる | 2026-03-30 | ✅ PASS |
| UT-26 | Supabaseエラー | error.message='削除エラー' | `false` が返り `error.value` が '削除エラー' | 2026-03-30 | ✅ PASS |
| UT-27 | ローディング後始末 | 削除完了後 | `isLoading` が `false` に戻る | 2026-03-30 | ✅ PASS |

#### グループ7: 境界値テスト

| TC# | テスト観点 | 入力 | 期待結果 | 実施日 | 結果 |
|---|---|---|---|---|---|
| UT-28 | overall_rating=1 | rating=1 | insert に `overall_rating: 1` | 2026-03-30 | ✅ PASS |
| UT-29 | overall_rating=5 | rating=5 | insert に `overall_rating: 5` | 2026-03-30 | ✅ PASS |
| UT-30 | quarterly Q1 | review_type='quarterly', review_quarter=1 | insert に `review_quarter: 1` | 2026-03-30 | ✅ PASS |
| UT-31 | quarterly Q4 | review_type='quarterly', review_quarter=4 | insert に `review_quarter: 4` | 2026-03-30 | ✅ PASS |

**テスト結果サマリー**: 31/31 PASS（実行ファイル内テスト数は合計 149 のうち本機能関連 31）

---

## Part 2: 結合テスト（Integration Test）

### 2.1 テスト対象インターフェース

| 結合対象 | 概要 |
|---|---|
| `PerformanceReviewView.vue` ↔ `usePerformanceReviews` | 画面アクション → composable の呼び出し → 画面状態の更新 |
| `usePerformanceReviews` ↔ Supabase JS SDK | composable の Supabase クエリ → DB操作の正確な引数 |
| DB トリガー ↔ `notifications` テーブル | 評価提出時に通知が自動生成されること |
| `AppSidebar.vue` ↔ Vue Router | サイドバーのリンクからページが正しく遷移すること |

### 2.2 テストケース

| IT# | 結合対象 | テスト観点 | 手順 | 期待結果 | 使用環境 |
|---|---|---|---|---|---|
| IT-01 | View ↔ Composable | 新規登録フォーム → DB保存 → 一覧反映 | 1. 新規登録ボタンをクリック 2. フォーム入力 3. 保存 | モーダルが閉じ一覧に新レコードが追加 | 結合テスト環境 |
| IT-02 | View ↔ Composable | 提出ボタン → ステータス変更 → 一覧更新 | 1. draft レコードの提出アイコンクリック 2. 確認ダイアログでOK | テーブル行のバッジが「提出済み」に変更 | 結合テスト環境 |
| IT-03 | View ↔ Composable | 削除ボタン → 一覧から除去 | 1. draft レコードの削除アイコンクリック 2. 確認でOK | 該当行がテーブルから消える | 結合テスト環境 |
| IT-04 | DB Trigger ↔ notifications | 評価提出時の通知自動生成 | 1. draft レコードの status を 'submitted' に UPDATE | notifications テーブルに被評価者の user_id で通知レコードが作成される | Supabase本番/ステージング |
| IT-05 | Sidebar ↔ Router | 人事評価メニューリンク遷移 | 1. サイドバーの「人事評価」をクリック | `/performance-reviews` に遷移し PerformanceReviewView が表示される | 結合テスト環境 |
| IT-06 | RLS ↔ employee ロール | employee が draft を閲覧できないこと | 1. employee ロールでログイン 2. 評価一覧を表示 | draft ステータスのレコードが表示されない | Supabase本番/ステージング |
| IT-07 | RLS ↔ manager ロール | manager が他部署の評価を操作できないこと | 1. manager ロールでログイン 2. 他部署の評価へ操作リクエスト | RLS エラーが返り操作が失敗する | Supabase本番/ステージング |

### 2.3 前提条件

- テストユーザー（各ロール）がセットアップ済みであること
- `employees` テーブルにテストデータが存在すること
- `notifications` テーブルが存在すること（004_notifications.sql 適用済み）

---

## Part 3: 総合テスト（System Test）

### 3.1 テスト対象機能・画面

- 人事評価一覧画面（SCR-80）
- 評価登録・編集モーダル（SCR-81）
- 評価詳細モーダル（SCR-82）
- 通知ベル（評価提出時の通知表示）

### 3.2 テスト観点

| 観点 | 内容 |
|---|---|
| 業務フロー全体 | 評価登録から本人確認まで一連のフローが完結すること |
| ロール別アクセス | 各ロールで閲覧・操作できる範囲が要件通りであること |
| 通知連携 | 評価提出時に被評価者の通知ベルに通知が表示されること |
| バリデーション | フォームの必須項目・制約が正しく機能すること |
| データ整合性 | 同一評価期間の重複登録がブロックされること |
| UI/UX | ローディング表示、エラー表示、ページレイアウトが正常であること |

### 3.3 テストシナリオ

#### シナリオ ST-01: 年次評価の完全ワークフロー

| ステップ | 操作 | 期待結果 |
|---|---|---|
| 1 | hr ロールでログイン | ダッシュボードが表示される |
| 2 | サイドバー「人事評価」をクリック | 人事評価一覧が表示される |
| 3 | 「新規登録」をクリック | 登録モーダルが表示される |
| 4 | 従業員選択・2026年・年次評価・各スコア3・コメント入力後「保存」 | モーダルが閉じ一覧に draft レコードが追加される |
| 5 | 追加したレコードの「目」アイコンをクリック | 詳細モーダルが開き入力内容が表示される |
| 6 | 「送信」アイコンをクリック → 確認ダイアログOK | ステータスが「提出済み」に変更される |
| 7 | 被評価者ロール（employee）でログイン | - |
| 8 | 通知ベルを確認 | 「人事評価が提出されました」通知が表示される |
| 9 | 「人事評価」一覧を開く | 自身の提出済み評価が表示される |
| 10 | 「確認済み」チェックアイコンをクリック → OK | ステータスが「確認済み」に変更される |

#### シナリオ ST-02: 四半期評価の登録

| ステップ | 操作 | 期待結果 |
|---|---|---|
| 1 | manager ロールでログイン | - |
| 2 | 評価一覧から新規登録 | モーダルが表示される |
| 3 | 種別「四半期評価」を選択 | 四半期セレクトボックスが表示される |
| 4 | Q1を選択して保存 | `review_quarter=1` のレコードが作成される |
| 5 | 同一従業員・年度・種別・Q1 で再登録を試みる | 重複エラーが表示されて登録失敗 |

#### シナリオ ST-03: アクセス制御検証

| ステップ | 操作 | 期待結果 |
|---|---|---|
| 1 | employee ロールでログイン | - |
| 2 | 評価一覧を表示 | 自身のレコードのみ（submitted/acknowledged）が表示される |
| 3 | 新規登録ボタン | 表示されない |
| 4 | 削除・編集・提出ボタン | 表示されない |
| 5 | 他者の評価 URL へ直接アクセス | 表示されない（RLS でブロック） |

### 3.4 テスト条件

| 条件 | 内容 |
|---|---|
| データ量 | 各ロール2〜3ユーザー、従業員10名以上、評価レコード20件以上 |
| ブラウザ | Chrome 最新版、Firefox 最新版 |
| 画面サイズ | デスクトップ（1280×800以上）、モバイル（375px想定） |

### 3.5 合否判定基準

| 区分 | 基準 |
|---|---|
| 致命的欠陥（必ず修正） | 他ユーザーのデータが閲覧・操作できる。データが消失・破損する。ページがクラッシュする |
| 重大欠陥（リリース前修正） | 正規操作で業務フローが完結しない。バリデーションが機能しない |
| 軽微欠陥（次バージョン対応可） | 表示の乱れ。ラベルの誤字。非本質的な操作感の問題 |

**リリース合否**: 致命的欠陥 0 件、重大欠陥 0 件 を合格条件とする。

### 3.6 テスト環境

| 項目 | 内容 |
|---|---|
| フロントエンド | Vue 3 + Vite（開発サーバー または Vercel プレビュー） |
| バックエンド | Supabase クラウド（ステージングプロジェクト） |
| DB | Supabase PostgreSQL（007_performance_reviews.sql 適用済み） |
| 認証 | Supabase Auth（各ロールのテストユーザー） |
| テスト日 | 2026-03-30 |
