# 単体テスト仕様書

**システム名**: jinij — 社内人事管理システム
**バージョン**: 1.0
**作成日**: 2026-03-29
**改訂履歴**:

| バージョン | 日付 | 変更内容 | 担当者 |
|---|---|---|---|
| 1.0 | 2026-03-29 | 初版作成 | - |

---

## 1. 概要

### 1.1 テスト方針

| 項目 | 内容 |
|---|---|
| テストフレームワーク | Vitest v1.6 |
| テストランナー環境 | happy-dom（ブラウザ DOM エミュレーション） |
| テスト対象 | `src/composables/**` / `src/components/**` |
| カバレッジ測定 | `@vitest/coverage-v8`（lcov + text） |
| モック戦略 | `vi.mock('@/lib/supabase')` でSupabase クライアントを完全モック化し、外部依存を排除 |
| 実行コマンド | `npm test`（`vitest run`）/ `npm run test:watch`（Watch モード） |

### 1.2 テストファイル一覧

| ファイル | 対象モジュール | テスト数 |
|---|---|---|
| `src/composables/__tests__/useAttendance.test.ts` | `useAttendance` | 35 |
| `src/composables/__tests__/useEmployees.test.ts` | `useEmployees` | 42 |
| `src/composables/__tests__/useLeaves.test.ts` | `useLeaves` | 35 |
| `src/composables/__tests__/useDepartments.test.ts` | `useDepartments` | 19 |
| `src/composables/__tests__/useNotifications.test.ts` | `useNotifications` | 19 |
| `src/components/__tests__/StatusBadge.test.ts` | `StatusBadge.vue` | 17 |
| **合計** | | **167** |

---

## 2. テスト対象モジュール詳細

---

### 2.1 useAttendance（勤怠管理 Composable）

**ファイル**: `src/composables/useAttendance.ts`
**テストファイル**: `src/composables/__tests__/useAttendance.test.ts`

#### テスト観点と件数

| グループ | 観点 | 件数 |
|---|---|---|
| 初期状態 | 各 ref / computed の初期値 | 6 |
| isClockedIn / isClockedOut | clock_in・clock_out の組み合わせ | 2 |
| totalWorkMinutes | 実働時間の算出ロジック | 4 |
| fetchTodayRecord | 正常・null・isLoading・エラー | 5 |
| clockIn | 正常・引数検証・未認証・エラー | 6 |
| clockOut | 正常・todayRecord null・id 検証・負値クランプ・エラー | 5 |
| fetchMonthlyRecords | 正常・null・月末処理・エラー | 7 |

#### 主要テストケース

| # | テスト名 | 入力 | 期待結果 |
|---|---|---|---|
| 1 | totalWorkMinutes 複数レコード合計 | 2レコード（480分・420分） | 900 |
| 2 | totalWorkMinutes break超過クランプ | 10分稼働・休憩60分 | 0 |
| 3 | clockIn 未認証 | `getUser` が null を返す | `error = '認証情報がありません'`、insert 未呼び出し |
| 4 | clockOut todayRecord null | todayRecord = null のまま呼び出し | `error = '出勤記録がありません'`、update 未呼び出し |
| 5 | fetchMonthlyRecords 12月 | year=2026, month=12 | `gte('work_date','2026-12-01')` / `lt('work_date','2027-01-01')` |
| 6 | exportMonthlyCSV（新機能） | monthlyRecords に1件、year=2026, month=3 | Blob 生成 → `<a>` クリック → URL 解放 |

#### 新機能 exportMonthlyCSV テスト仕様

| 項目 | 内容 |
|---|---|
| テスト対象関数 | `exportMonthlyCSV(year, month, employeeName?)` |
| テスト観点 | 正常系（ファイル名・CSV ヘッダー・行データ）、break超過クランプ（workMin=0）、employeeName なしファイル名 |
| モック | `URL.createObjectURL`・`URL.revokeObjectURL`・`document.createElement`・`HTMLAnchorElement.click` |
| 正常系入力 | 1レコード（clock_in=09:00、clock_out=18:00、break=60分） |
| 正常系期待結果 | ヘッダー行: `"日付","ステータス","出勤時刻","退勤時刻","休憩(分)","実働時間","備考"` / データ行の実働時間: `"8:00"` |

---

### 2.2 useEmployees（従業員管理 Composable）

**ファイル**: `src/composables/useEmployees.ts`
**テストファイル**: `src/composables/__tests__/useEmployees.test.ts`

#### テスト観点と件数

| グループ | 観点 | 件数 |
|---|---|---|
| 初期状態 | 各 ref / computed の初期値 | 5 |
| totalPages（computed） | 切り上げ・0件 | 3 |
| fetchDepartments | 正常・null | 2 |
| fetchEmployees | 正常・ローディング・null・count null・エラー・フィルター分岐・ページネーション | 9 |
| fetchEmployee | 正常・id 検証・エラー | 3 |
| createEmployee | 正常・sanitize（email/phone/address/birth_date/notes/balance）・エラー | 8 |
| updateEmployee | 正常・id 検証・エラー | 3 |
| deleteEmployee | 正常・id 検証・論理削除確認・エラー | 4 |
| setPage | ページ変更後の pagination.page | 1 |
| applyFilters | page リセット確認 | 1 |

#### 主要テストケース

| # | テスト名 | 入力 | 期待結果 |
|---|---|---|---|
| 1 | totalPages 切り上げ | total=21, per_page=20 | 2 |
| 2 | fetchEmployees search フィルタ | search='山田' | `or()` 呼び出し1回 |
| 3 | fetchEmployees search なし | search='' | `or()` 未呼び出し |
| 4 | fetchEmployees ページネーション | page=2, per_page=20 | `range(20, 39)` |
| 5 | createEmployee email 小文字化 | email='SUZUKI@EXAMPLE.COM' | insert に email='suzuki@example.com' |
| 6 | createEmployee phone 空→null | phone='  ' | insert に phone=null |
| 7 | deleteEmployee 論理削除 | id='emp-001' | `update({status:'inactive'})` 呼び出し |
| 8 | Supabase error object | error: {message:'権限エラー'} | `'取得に失敗しました'`（instanceof Error 非該当） |

#### sanitize 関数の境界値テスト

| フィールド | 入力 | 期待値 |
|---|---|---|
| `email` | `'SUZUKI@EXAMPLE.COM'` | `'suzuki@example.com'` |
| `full_name_kana` | `''`（空） | `null` |
| `phone` | `'  '`（空白） | `null` |
| `birth_date` | `''`（空） | `null` |
| `address` | `'  大阪府  '` | `'大阪府'`（trim） |
| `notes` | `'  '`（空白） | `null` |
| `annual_leave_balance` | `'15'`（string） | `15`（number） |
| `department_id` | `''`（空） | `null` |

---

### 2.3 useLeaves（休暇管理 Composable）

**ファイル**: `src/composables/useLeaves.ts`
**テストファイル**: `src/composables/__tests__/useLeaves.test.ts`

#### テスト観点と件数

| グループ | 観点 | 件数 |
|---|---|---|
| 初期状態 | 各 ref の初期値 | 4 |
| fetchRequests | 正常・null・ローディング・エラー・各フィルター分岐 | 9 |
| submitRequest | 正常・reason trim・reason 空→null・エラー | 4 |
| approveRequest | 正常・update 内容・comment trim・comment 空→null・id 検証・エラー | 6 |
| rejectRequest | 正常・update 内容・comment 空例外・comment 空白例外・エラー | 5 |
| cancelRequest | 正常・update 内容・id 検証・エラー | 4 |
| applyFilters | fetchRequests 呼び出し確認 | 1 |

#### 主要テストケース

| # | テスト名 | 入力 | 期待結果 |
|---|---|---|---|
| 1 | fetchRequests フィルターなし | 全フィルター空 | `eq/gte/lte` 未呼び出し |
| 2 | fetchRequests date_from | date_from='2026-04-01' | `gte('start_date','2026-04-01')` |
| 3 | submitRequest reason 空白 | reason='   ' | insert に reason=null |
| 4 | rejectRequest comment 空 | comment='' | `Error('却下理由を入力してください')` |
| 5 | rejectRequest comment 空白のみ | comment='   ' | `Error('却下理由を入力してください')` |
| 6 | approveRequest comment trim | comment='  問題なし  ' | review_comment='問題なし' |
| 7 | cancelRequest update 内容 | id='lr-001' | `update({status:'cancelled'})` |

---

### 2.4 useDepartments（部署管理 Composable）

**ファイル**: `src/composables/useDepartments.ts`
**テストファイル**: `src/composables/__tests__/useDepartments.test.ts`

#### テスト観点と件数

| グループ | 観点 | 件数 |
|---|---|---|
| 初期状態 | 各 ref の初期値 | 3 |
| fetchDepartments | 正常・ローディング・エラー・null | 4 |
| createDepartment | 正常・name trim・code 空→null・description 空→null・エラー | 5 |
| updateDepartment | 正常・id 検証・エラー | 3 |
| deleteDepartment | 正常・id 検証・エラー | 3 |

---

### 2.5 useNotifications（通知 Composable）

**ファイル**: `src/composables/useNotifications.ts`
**テストファイル**: `src/composables/__tests__/useNotifications.test.ts`

#### テスト観点と件数

| グループ | 観点 | 件数 |
|---|---|---|
| 初期状態 | 各 ref / computed の初期値 | 4 |
| unreadCount（computed） | 未読カウント・全既読・0件 | 3 |
| fetchNotifications | 正常・userId 空スキップ・エラー | 3 |
| markAsRead | 正常・存在しない id・エラー | 3 |
| markAllAsRead | 未読0件スキップ・全既読化・エラー | 3 |
| subscribeRealtime / unsubscribeRealtime | userId 空スキップ・チャネル削除・2重解除 | 3 |

---

### 2.6 StatusBadge.vue（共通コンポーネント）

**ファイル**: `src/components/common/StatusBadge.vue`
**テストファイル**: `src/components/__tests__/StatusBadge.test.ts`

#### テスト観点と件数

| グループ | 観点 | 件数 |
|---|---|---|
| employee-status | 各ステータスのラベル・クラス・未知値フォールバック | 4 |
| leave-status | 各ステータスのラベル・クラス | 4 |
| leave-type | 各タイプのラベル・クラス | 5 |
| showDot prop | true・省略・false | 3 |
| 共通 | badge クラス付与 | 1 |

#### テストケース詳細

| # | type | value | 期待ラベル | 期待クラス |
|---|---|---|---|---|
| 1 | `employee-status` | `active` | 在職 | `badge-active` |
| 2 | `employee-status` | `inactive` | 退職 | `badge-inactive` |
| 3 | `employee-status` | `on_leave` | 休職中 | `badge-on-leave` |
| 4 | `employee-status` | `unknown_xyz` | unknown_xyz | `badge-inactive`（フォールバック） |
| 5 | `leave-status` | `pending` | 承認待ち | `badge-pending` |
| 6 | `leave-status` | `approved` | 承認済み | `badge-approved` |
| 7 | `leave-status` | `rejected` | 却下 | `badge-rejected` |
| 8 | `leave-status` | `cancelled` | キャンセル | `badge-cancelled` |
| 9 | `leave-type` | `annual` | 年次有給休暇 | `badge-annual` |
| 10 | `leave-type` | `sick` | 病気休暇 | `badge-sick` |

---

## 3. モック設計

### 3.1 Supabase クライアントモック

全テストファイルで `vi.mock('@/lib/supabase')` を使用し、実際の Supabase への通信を遮断する。

```
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from:          mockFrom,      // テーブル操作
    auth:          { getUser: mockGetUser },  // 認証（useAttendance のみ）
    channel:       vi.fn(...),    // Realtime（useNotifications のみ）
    removeChannel: vi.fn(),
  },
}))
```

### 3.2 チェーンモックパターン

Supabase の fluent API チェーンは以下のパターンで構築する。

```typescript
// 例: SELECT → eq → order（最終が Promise）
function buildSelectMock(resolvedValue) {
  const chain = {}
  chain['select'] = vi.fn().mockReturnValue(chain)
  chain['eq']     = vi.fn().mockReturnValue(chain)
  chain['order']  = vi.fn().mockResolvedValue(resolvedValue)
  return chain
}
```

各操作タイプ別チェーン構成：

| 操作 | チェーン末尾 | 戻り値型 |
|---|---|---|
| SELECT（一覧） | `order()` または `range()` | `{ data, count?, error }` |
| SELECT（単件） | `single()` または `maybeSingle()` | `{ data, error }` |
| INSERT | `single()` | `{ data, error }` |
| UPDATE | `eq()` または `in()` | `{ error }` |
| DELETE | `eq()` | `{ error }` |

---

## 4. テスト実施記録

### 4.1 最新実施結果

| 実施日 | テストファイル数 | 総テスト数 | PASS | FAIL | 実施環境 |
|---|---|---|---|---|---|
| 2026-03-29 | 6 | 167 | 167 | 0 | Node.js + happy-dom |

### 4.2 実施コマンド

```bash
# 全テスト一括実行
cd frontend && npm test

# Watch モード（開発中）
npm run test:watch

# カバレッジ計測
npm run test:coverage
```

---

## 5. 今後のテスト拡張計画

| 優先度 | 対象 | 内容 |
|---|---|---|
| 高 | `exportMonthlyCSV` | DOM API（Blob / URL / anchor click）のモックテスト追加 |
| 高 | `useAttendance` 新機能 | 勤怠修正申請機能追加時のテスト |
| 中 | `useDashboard` | ダッシュボード集計ロジックのテスト追加 |
| 中 | Vue コンポーネント | `AttendanceView`・`LeaveManagementView` の結合レベルテスト |
| 低 | E2E テスト | Playwright による画面操作テストの導入（Phase 2） |
