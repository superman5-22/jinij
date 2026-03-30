# 単体テスト仕様書

**システム名**: jinij — 社内人事管理システム
**バージョン**: 1.0
**作成日**: 2026-03-30
**対象機能**: 人事評価管理（F-80〜F-88）

---

## 1. テスト方針

| 項目 | 内容 |
|---|---|
| テストフレームワーク | Vitest 1.6 + Vue Test Utils 2.4 |
| テスト対象 | `useEvaluations` Composable（`src/composables/useEvaluations.ts`） |
| テストファイル | `src/composables/__tests__/useEvaluations.test.ts` |
| 外部依存 | Supabase クライアントを `vi.mock` でモック化 |
| 実行コマンド | `npm test`（`npx vitest run --reporter=verbose`） |

---

## 2. テスト対象モジュール

### 2.1 `useEvaluations()`

| エクスポート | 種別 | 説明 |
|---|---|---|
| `records` | `Ref<EvaluationRecord[]>` | 評価レコード一覧 |
| `current` | `Ref<EvaluationRecord \| null>` | 単件取得結果 |
| `isLoading` | `Ref<boolean>` | ローディング状態 |
| `error` | `Ref<string \| null>` | エラーメッセージ |
| `fetchRecords(filters?)` | `async` | 評価一覧取得 |
| `fetchRecord(id)` | `async` | 単件取得 |
| `createRecord(form)` | `async → EvaluationRecord \| null` | 評価登録 |
| `updateRecord(id, form)` | `async → EvaluationRecord \| null` | 評価更新 |
| `changeStatus(id, status)` | `async → boolean` | ステータス変更 |
| `deleteRecord(id)` | `async → boolean` | 評価削除 |

---

## 3. テストケース一覧

### 3.1 初期状態

| TC# | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| UT-01 | `records` 初期値 | - | `[]`（空配列） | ✅ PASS |
| UT-02 | `current` 初期値 | - | `null` | ✅ PASS |
| UT-03 | `isLoading` 初期値 | - | `false` | ✅ PASS |
| UT-04 | `error` 初期値 | - | `null` | ✅ PASS |

### 3.2 `fetchRecord`（単件取得）

| TC# | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| UT-05 | 正常取得 | id='eval-001', Supabase正常応答 | `current` が取得データに更新される | ✅ PASS |
| UT-06 | ローディング管理 | 取得完了後 | `isLoading === false` | ✅ PASS |
| UT-07 | Supabase エラー | `{ error: { message: '権限エラー' } }` | `error.value === '権限エラー'` | ✅ PASS |
| UT-08 | 例外スロー | `Promise.reject(new Error('ネットワークエラー'))` | `error.value === 'ネットワークエラー'` | ✅ PASS |

### 3.3 `createRecord`（登録）

| TC# | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| UT-09 | 正常登録 | 正常フォームデータ | 返り値が `EvaluationRecord` | ✅ PASS |
| UT-10 | employee_id 伝達 | `employee_id: 'emp-999'` | `insert` に `employee_id: 'emp-999'` が渡される | ✅ PASS |
| UT-11 | evaluator_id 自動設定 | `auth.uid = 'evaluator-uuid'` | `insert` に `evaluator_id: 'evaluator-uuid'` が渡される | ✅ PASS |
| UT-12 | 空コメント正規化 | `comment: '   '`（空白のみ） | `insert` に `comment: null` が渡される | ✅ PASS |
| UT-13 | 未認証エラー | `getUser → user: null` | `null` を返し `error` に '認証情報がありません' | ✅ PASS |
| UT-14 | 重複キーエラー | DB UNIQUE 違反応答 | `null` を返し `error` に '同一期間の評価が既に存在します' | ✅ PASS |
| UT-15 | ローディング管理 | 登録完了後 | `isLoading === false` | ✅ PASS |

### 3.4 `updateRecord`（更新）

| TC# | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| UT-16 | 正常更新 | `{ score_performance: 5 }` | 返り値と `current` が更新データに一致 | ✅ PASS |
| UT-17 | id 伝達 | `id: 'eval-target'` | `eq('id', 'eval-target')` が呼ばれる | ✅ PASS |
| UT-18 | 空コメント正規化 | `{ comment: '' }` | `update` に `comment: null` が渡される | ✅ PASS |
| UT-19 | Supabase エラー | `{ error: { message: '更新エラー' } }` | `null` を返し `error` に '更新エラー' | ✅ PASS |
| UT-20 | ローディング管理 | 更新完了後 | `isLoading === false` | ✅ PASS |

### 3.5 `changeStatus`（ステータス変更）

| TC# | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| UT-21 | submitted への変更 | `status: 'submitted'` | `true` を返す | ✅ PASS |
| UT-22 | finalized への変更 | `status: 'finalized'` | `true` を返す | ✅ PASS |
| UT-23 | records 内部更新 | `records` に draft レコードを事前セット | `records[0].status === 'submitted'` に変更される | ✅ PASS |
| UT-24 | Supabase エラー | `{ error: { message: 'ステータス変更エラー' } }` | `false` を返し `error` にメッセージセット | ✅ PASS |
| UT-25 | ローディング管理 | 変更完了後 | `isLoading === false` | ✅ PASS |

### 3.6 `deleteRecord`（削除）

| TC# | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| UT-26 | 正常削除 | `id: 'eval-001'`、records に2件 | `true` を返し `records` から除去 | ✅ PASS |
| UT-27 | id 伝達 | `id: 'eval-target'` | `eq('id', 'eval-target')` が呼ばれる | ✅ PASS |
| UT-28 | Supabase エラー | `{ error: { message: '削除エラー' } }` | `false` を返し `error` に '削除エラー' | ✅ PASS |
| UT-29 | ローディング管理 | 削除完了後 | `isLoading === false` | ✅ PASS |

### 3.7 境界値テスト

| TC# | テスト観点 | 入力データ | 期待結果 | 実施結果 |
|---|---|---|---|---|
| UT-30 | スコア最小値 | 全スコア `1` | 正常登録、`insert` に `score_performance: 1` | ✅ PASS |
| UT-31 | スコア最大値 | 全スコア `5` | 正常登録、`insert` に `score_performance: 5` | ✅ PASS |
| UT-32 | 四半期下限 | `quarter: 1` | `insert` に `quarter: 1` が渡される | ✅ PASS |
| UT-33 | 四半期上限 | `quarter: 4` | `insert` に `quarter: 4` が渡される | ✅ PASS |

---

## 4. テスト実施記録

| 項目 | 内容 |
|---|---|
| 実施日 | 2026-03-30 |
| 実施者 | 自動テスト（Vitest CI） |
| テスト総数 | 37（`useEvaluations` のみ）/ 146（全テストスイート） |
| 合格数 | 37 / 37 |
| 失敗数 | 0 |
| 実行時間 | 約 2.45秒（全テストスイート） |

---

## 5. テスト実行コマンド

```bash
# 全テスト実行
cd frontend && npm test

# verbose モード（テスト名表示）
npx vitest run --reporter=verbose

# カバレッジ取得
npm run test:coverage
```

---

## 6. テスト設計根拠

### 正常系カバレッジ
各 CRUD 操作の正常フローを必ずテスト。返り値・状態変化の両方を検証。

### 異常系カバレッジ
- Supabase からエラーオブジェクトが返る場合（`{ error: { message } }`）
- Promise がリジェクトされる場合（例外スロー）
- 認証情報が取得できない場合（`createRecord` のみ）

### ローディング管理
全非同期操作について、完了後に `isLoading === false` となることを確認。これにより、例外発生時の `finally` ブロックが必ず実行されることを保証。

### モック設計
Supabase クライアントを `vi.hoisted` + `vi.mock` で完全置換し、テストの外部依存を排除。クエリビルダーチェーン（`.from().insert().select().single()` 等）はメソッドチェーンをモックで再現。
