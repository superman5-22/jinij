# 単体テスト設計書

**システム名**: jinij — 社内人事管理システム
**バージョン**: 1.0
**作成日**: 2026-03-29
**改訂履歴**:

| バージョン | 日付 | 変更内容 | 担当者 |
|---|---|---|---|
| 1.0 | 2026-03-29 | 初版作成（全コンポーザブル・コンポーネント） | - |

---

## 1. テスト方針

### 1.1 テストフレームワーク

| 項目 | 採用技術 |
|---|---|
| テストランナー | Vitest 1.x |
| コンポーネントテスト | @vue/test-utils 2.x |
| DOM 実装 | happy-dom |
| カバレッジ | @vitest/coverage-v8 |

### 1.2 モック戦略

Supabase クライアントは `vi.mock('@/lib/supabase')` で全体をモック化する。
チェーン可能なクエリビルダーは `vi.hoisted()` でホイスティング前に変数を確保し、各テストケースで `mockFrom` に差し替える。

### 1.3 テスト実行コマンド

```bash
# フロントエンドディレクトリへ移動
cd frontend

# 依存関係インストール（初回）
npm install

# 単体テスト一括実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート出力
npm run test:coverage
```

### 1.4 フォールバック動作の注意事項

Supabase が返すエラーオブジェクト `{ message: string }` は `instanceof Error` ではないため、
`fetchRequests` / `fetchEmployees` のような `catch(e)` ブロックでは `'取得に失敗しました'` にフォールバックする。
一方、`submitRequest` / `createEmployee` 等の CRUD 操作は `if (err) throw err` で `err` オブジェクトをそのまま throw するため、
テスト側では `.rejects.toMatchObject({ message: '...' })` で検証する。

---

## 2. テスト対象モジュール一覧

| # | ファイル | テスト対象 | テスト数 | 結果 |
|---|---|---|---|---|
| UT-01 | `useLeaves.test.ts` | `useLeaves` composable | 32 | ✅ PASS |
| UT-02 | `useEmployees.test.ts` | `useEmployees` composable | 40 | ✅ PASS |
| UT-03 | `useDepartments.test.ts` | `useDepartments` composable | 19 | ✅ PASS |
| UT-04 | `useAttendance.test.ts` | `useAttendance` composable | 35 | ✅ PASS |
| UT-05 | `useNotifications.test.ts` | `useNotifications` composable | 19 | ✅ PASS |
| UT-06 | `StatusBadge.test.ts` | `StatusBadge` コンポーネント | 17 | ✅ PASS |
| — | **合計** | — | **167** | **✅ 全件 PASS** |

---

## 3. UT-01: useLeaves

**ファイル**: `frontend/src/composables/__tests__/useLeaves.test.ts`
**対象**: `frontend/src/composables/useLeaves.ts`

### 3.1 テスト観点・テスト条件・期待結果

#### 初期状態

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| L-01 | requests は空配列 | 初期値 | 初期化直後 | `[]` |
| L-02 | loading は false | 初期値 | 初期化直後 | `false` |
| L-03 | error は null | 初期値 | 初期化直後 | `null` |
| L-04 | filters のデフォルト値 | 初期値 | 初期化直後 | `{ employee_id:'', status:'', leave_type:'', date_from:'', date_to:'' }` |

#### fetchRequests — 正常系・異常系

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| L-05 | 正常取得 | 正常系 | Supabase が data を返す | `requests.value` が取得データで更新される |
| L-06 | loading 復帰 | ローディング状態 | 取得完了後 | `loading.value === false` |
| L-07 | data が null | 正常系（データなし） | `data: null` | `requests.value === []` |
| L-08 | エラーオブジェクト返却 | 異常系 | `{ error: { message } }` が返る | `error.value === '取得に失敗しました'`（フォールバック） |
| L-09 | 例外スロー | 異常系 | `Error('ネットワークエラー')` が reject | `error.value === 'ネットワークエラー'` |

#### fetchRequests — フィルター適用

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| L-10 | employee_id フィルター | フィルター | `employee_id = 'emp-999'` | `.eq('employee_id', 'emp-999')` が呼ばれる |
| L-11 | status フィルター | フィルター | `status = 'pending'` | `.eq('status', 'pending')` が呼ばれる |
| L-12 | leave_type フィルター | フィルター | `leave_type = 'annual'` | `.eq('leave_type', 'annual')` が呼ばれる |
| L-13 | date_from フィルター | フィルター | `date_from = '2026-04-01'` | `.gte('start_date', '2026-04-01')` が呼ばれる |
| L-14 | date_to フィルター | フィルター | `date_to = '2026-04-30'` | `.lte('end_date', '2026-04-30')` が呼ばれる |
| L-15 | フィルター全空 | 境界値 | すべて空文字 | `gte` / `lte` は呼ばれない |

#### submitRequest

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| L-16 | 正常申請 | 正常系 | 有効なフォームデータ | `LeaveRequest` オブジェクトが返る |
| L-17 | reason が trim される | sanitize | `reason = '  休養  '` | `insert` に `reason: '休養'` が渡される |
| L-18 | reason が空白のみ | sanitize | `reason = '   '` | `insert` に `reason: null` が渡される |
| L-19 | Supabase エラー | 異常系 | `{ error: { message } }` | 例外が throw される |

#### approveRequest

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| L-20 | 正常承認 | 正常系 | 有効な id / reviewerId | resolve(undefined) |
| L-21 | comment が trim される | sanitize | `comment = '  問題なし  '` | `update` に `review_comment: '問題なし'` が渡される |
| L-22 | comment 未指定 | 境界値 | `comment = undefined` | `update` に `review_comment: null` が渡される |
| L-23 | status: approved | 入力値検証 | 正常呼び出し | `update` に `status: 'approved'` が渡される |
| L-24 | eq に正しい id | 入力値検証 | `id = 'lr-target'` | `.eq('id', 'lr-target')` が呼ばれる |
| L-25 | Supabase エラー | 異常系 | `{ error: { message } }` | 例外が throw される |

#### rejectRequest

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| L-26 | 正常却下 | 正常系 | 有効なコメント | resolve(undefined) |
| L-27 | comment が空文字 | バリデーション | `comment = ''` | `Error('却下理由を入力してください')` が throw される |
| L-28 | comment が空白のみ | バリデーション | `comment = '   '` | `Error('却下理由を入力してください')` が throw される |
| L-29 | comment が trim される | sanitize | `comment = '  人員不足  '` | `update` に `review_comment: '人員不足'` が渡される |
| L-30 | status: rejected | 入力値検証 | 正常呼び出し | `update` に `status: 'rejected'` が渡される |
| L-31 | Supabase エラー | 異常系 | `{ error: { message } }` | 例外が throw される |

#### cancelRequest

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| L-32 | 正常キャンセル | 正常系 | 有効な id | resolve(undefined) |
| L-33 | status: cancelled | 入力値検証 | 正常呼び出し | `update` に `{ status: 'cancelled' }` が渡される |
| L-34 | eq に正しい id | 入力値検証 | `id = 'lr-target'` | `.eq('id', 'lr-target')` が呼ばれる |
| L-35 | Supabase エラー | 異常系 | `{ error: { message } }` | 例外が throw される |

---

## 4. UT-02: useEmployees

**ファイル**: `frontend/src/composables/__tests__/useEmployees.test.ts`
**対象**: `frontend/src/composables/useEmployees.ts`

### 4.1 テスト観点・テスト条件・期待結果

#### 初期状態

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-01 | employees は空配列 | 初期値 | 初期化直後 | `[]` |
| E-02 | departments は空配列 | 初期値 | 初期化直後 | `[]` |
| E-03 | loading は false | 初期値 | 初期化直後 | `false` |
| E-04 | error は null | 初期値 | 初期化直後 | `null` |
| E-05 | pagination のデフォルト値 | 初期値 | 初期化直後 | `{ page:1, per_page:20, total:0 }` |

#### totalPages (computed)

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-06 | total=0 のとき 0 | 境界値 | `total=0` | `0` |
| E-07 | total=20 のとき 1 | 正常系 | `total=20, per_page=20` | `1` |
| E-08 | total=21 のとき 2 | 境界値（切り上げ） | `total=21, per_page=20` | `2` |

#### fetchDepartments

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-09 | 正常取得 | 正常系 | Supabase が data を返す | `departments.value` が更新される |
| E-10 | data が null | 正常系（データなし） | `data: null` | `departments.value === []` |

#### fetchEmployees

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-11 | 正常取得 | 正常系 | data と count を返す | `employees.value` と `pagination.total` が更新される |
| E-12 | loading 復帰 | ローディング状態 | 取得完了後 | `loading.value === false` |
| E-13 | data が null | 正常系（データなし） | `data: null` | `employees.value === []` |
| E-14 | Supabase エラー | 異常系 | `{ error: { message } }` | `error.value === '取得に失敗しました'`（フォールバック） |

#### fetchEmployees — フィルター適用

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-15 | search フィルター | フィルター | `search = '山田'` | `.or(...)` が呼ばれる |
| E-16 | department_id フィルター | フィルター | `department_id = 'dept-001'` | `.eq('department_id', 'dept-001')` が呼ばれる |
| E-17 | status フィルター | フィルター | `status = 'active'` | `.eq('status', 'active')` が呼ばれる |
| E-18 | employment_type フィルター | フィルター | `employment_type = 'full_time'` | `.eq('employment_type', 'full_time')` が呼ばれる |
| E-19 | フィルター全空 | 境界値 | すべて空文字 | `.or` は呼ばれない |

#### fetchEmployee

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-20 | 正常取得 | 正常系 | 有効な id | `Employee` オブジェクトが返る |
| E-21 | eq に正しい id | 入力値検証 | `id = 'emp-target'` | `.eq('id', 'emp-target')` が呼ばれる |
| E-22 | Supabase エラー | 異常系 | `{ error: { message } }` | 例外が throw される |

#### createEmployee

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-23 | 正常登録 | 正常系 | 有効なフォームデータ | `Employee` オブジェクトが返る |
| E-24 | sanitize: full_name trim | sanitize | `full_name = '  田中 花子  '` | `insert` に `full_name: '田中 花子'` が渡される |
| E-25 | sanitize: email 小文字化 | sanitize | `email = 'TANAKA@EXAMPLE.COM'` | `insert` に `email: 'tanaka@example.com'` が渡される |
| E-26 | sanitize: phone 空 → null | sanitize | `phone = '   '` | `insert` に `phone: null` が渡される |
| E-27 | sanitize: birth_date 空 → null | sanitize | `birth_date = ''` | `insert` に `birth_date: null` が渡される |
| E-28 | sanitize: department_id 空 → null | sanitize | `department_id = ''` | `insert` に `department_id: null` が渡される |
| E-29 | sanitize: leave_balance 数値変換 | sanitize | `annual_leave_balance = 15` | `insert` に `annual_leave_balance: 15` が渡される |
| E-30 | Supabase エラー | 異常系 | `{ error: { message } }` | 例外が throw される |

#### updateEmployee

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-31 | 正常更新 | 正常系 | 有効な id とフォームデータ | 更新済み `Employee` が返る |
| E-32 | eq に正しい id | 入力値検証 | `id = 'emp-target'` | `.eq('id', 'emp-target')` が呼ばれる |
| E-33 | Supabase エラー | 異常系 | `{ error: { message } }` | 例外が throw される |

#### deleteEmployee（論理削除）

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-34 | 正常削除 | 正常系 | 有効な id | resolve(undefined) |
| E-35 | status: inactive（論理削除） | 入力値検証 | 正常呼び出し | `update` に `{ status: 'inactive' }` が渡される |
| E-36 | eq に正しい id | 入力値検証 | `id = 'emp-target'` | `.eq('id', 'emp-target')` が呼ばれる |
| E-37 | Supabase エラー | 異常系 | `{ error: { message } }` | 例外が throw される |

#### setPage / applyFilters

| # | テストケース | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| E-38 | setPage で page が変わる | 正常系 | `setPage(3)` | `pagination.page === 3` |
| E-39 | setPage で fetchEmployees が実行される | 正常系 | `setPage(2)` | `mockFrom('employees')` が呼ばれる |
| E-40 | applyFilters で page が 1 にリセット | 正常系 | `page=5` → `applyFilters()` | `pagination.page === 1` |
| E-41 | applyFilters で fetchEmployees が実行される | 正常系 | `applyFilters()` | `mockFrom('employees')` が呼ばれる |

---

## 5. UT-03: useDepartments

**ファイル**: `frontend/src/composables/__tests__/useDepartments.test.ts`
**対象**: `frontend/src/composables/useDepartments.ts`

詳細テスト設計は `docs/03_detailed_design.md` §7 に記載。

| テスト数 | 結果 |
|---|---|
| 19 | ✅ 全件 PASS |

---

## 6. UT-04: useAttendance

**ファイル**: `frontend/src/composables/__tests__/useAttendance.test.ts`
**対象**: `frontend/src/composables/useAttendance.ts`

詳細テスト設計は `docs/03_detailed_design.md` §「単体テスト設計 — useAttendance」に記載。

| テスト数 | 結果 |
|---|---|
| 35 | ✅ 全件 PASS |

---

## 7. UT-05: useNotifications

**ファイル**: `frontend/src/composables/__tests__/useNotifications.test.ts`
**対象**: `frontend/src/composables/useNotifications.ts`

### 7.1 テストケース概要

| # | テストグループ | テスト観点 |
|---|---|---|
| N-01〜03 | 初期状態 | notifications=[], loading=false, error=null, unreadCount=0 |
| N-04〜06 | unreadCount computed | 未読数カウント、全既読、0件 |
| N-07〜09 | fetchNotifications | 正常取得、userId 空時スキップ、エラー時 |
| N-10〜12 | markAsRead | 対象 id 既読化、存在しない id、エラー時 |
| N-13〜15 | markAllAsRead | 0件スキップ、全件既読化、エラー時 |
| N-16〜19 | subscribeRealtime / unsubscribeRealtime | userId 空時スキップ、チャンネル削除、二重削除防止 |

| テスト数 | 結果 |
|---|---|
| 19 | ✅ 全件 PASS |

---

## 8. UT-06: StatusBadge コンポーネント

**ファイル**: `frontend/src/components/__tests__/StatusBadge.test.ts`
**対象**: `frontend/src/components/common/StatusBadge.vue`

### 8.1 テストケース概要

| # | テストグループ | テスト観点 |
|---|---|---|
| S-01〜04 | type=employee-status | active/inactive/on_leave/未知値のラベルとクラス |
| S-05〜08 | type=leave-status | pending/approved/rejected/cancelled のラベルとクラス |
| S-09〜13 | type=leave-type | annual/sick/personal/bereavement/other のラベル |
| S-14〜16 | showDot prop | true/false/省略時の .dot 要素表示 |
| S-17 | 共通クラス | span.badge クラスが常に付与される |

| テスト数 | 結果 |
|---|---|
| 17 | ✅ 全件 PASS |

---

## 9. テスト実施記録（累計）

| 実施日 | テストファイル | テスト数 | 結果 |
|---|---|---|---|
| 2026-03-29 | useDepartments.test.ts | 19 | ✅ 全件 PASS |
| 2026-03-29 | useNotifications.test.ts | 19 | ✅ 全件 PASS |
| 2026-03-29 | StatusBadge.test.ts | 17 | ✅ 全件 PASS |
| 2026-03-29 | useAttendance.test.ts | 35 | ✅ 全件 PASS |
| 2026-03-29 | useLeaves.test.ts | 32 | ✅ 全件 PASS |
| 2026-03-29 | useEmployees.test.ts | 45 | ✅ 全件 PASS |
| — | **合計** | **167** | **✅ 全件 PASS** |

> **テスト実行コマンド**: `cd frontend && npm test`
