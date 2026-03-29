# 詳細設計書

**システム名**: jinij — 社内人事管理システム
**バージョン**: 1.1
**作成日**: 2026-03-29
**改訂履歴**:

| バージョン | 日付 | 変更内容 | 担当者 |
|---|---|---|---|
| 1.0 | 2026-03-29 | 初版作成（部署管理機能） | - |
| 1.1 | 2026-03-29 | 勤怠管理機能追加（SCR-09、F-60〜F-66） | - |

---

## 1. 画面詳細設計

### SCR-08 部署管理画面（`/departments`）

#### 1.1 レイアウト概要

```
┌─────────────────────────────────────────────────┐
│  部署管理           [新規登録ボタン（admin のみ）] │
│  部署マスタの登録・編集・削除                      │
├─────────────────────────────────────────────────┤
│  [エラーメッセージ（条件付き表示）]               │
├──────────┬──────────┬────────────┬────┬─────────┤
│ 部署コード│  部署名  │    説明    │登録日│ 操作   │
├──────────┼──────────┼────────────┼────┼─────────┤
│ DEV      │ 開発部   │ ソフトウェア│2026…│[編集][削除]│
│ HR       │ 人事部   │ 人材管理   │2026…│[編集][削除]│
└──────────┴──────────┴────────────┴────┴─────────┘
```

**操作列は admin ロールのみ表示。**

#### 1.2 項目定義

| 項目 | 表示条件 | 型 | 備考 |
|---|---|---|---|
| 部署コード | 常時 | テキスト | `departments.code`。null の場合「—」表示 |
| 部署名 | 常時 | テキスト | `departments.name` |
| 説明 | 常時 | テキスト | `departments.description`。null の場合「—」表示 |
| 登録日 | 常時 | 日付 | `departments.created_at` を `YYYY-MM-DD` に整形 |
| 操作 | admin のみ | ボタン | 編集・削除ボタン |

#### 1.3 登録・編集モーダル項目定義

| フィールド | 必須 | 型 | バリデーション |
|---|---|---|---|
| 部署名 | ○ | text | 空文字不可 |
| 部署コード | — | text | 空可。入力時は `^[A-Za-z0-9-]+$` に一致すること |
| 説明 | — | textarea | 任意入力 |

#### 1.4 入力チェック仕様

| チェック | 条件 | エラーメッセージ |
|---|---|---|
| 部署名必須 | `name.trim() === ''` | 部署名は必須です |
| 部署コード形式 | `code` 入力あり かつ `^[A-Za-z0-9-]+$` に不一致 | 半角英数字・ハイフンのみ使用可能です |

#### 1.5 イベント処理

| イベント | ハンドラ | 処理概要 |
|---|---|---|
| [新規登録] クリック | `openCreateModal()` | フォームリセット → モーダル表示 |
| [編集] クリック | `openEditModal(dept)` | 選択行データをフォームにセット → モーダル表示 |
| [削除] クリック | `confirmDelete(dept)` | 削除対象を保持 → 確認ダイアログ表示 |
| フォーム送信 | `submitForm()` | バリデーション → create / update API 呼び出し |
| 削除確認 | `executeDelete()` | delete API 呼び出し → 一覧からレコード除去 |
| モーダル背景クリック | `closeModal()` | モーダルを閉じてフォームをリセット |

---

## 2. 機能詳細設計（処理フロー）

### 2.1 部署一覧取得フロー

```
DepartmentView mounted
    │
    ▼
fetchDepartments()
    │
    ├─[loading = true]
    │
    ▼
supabase.from('departments').select('*').order('name')
    │
    ├─[成功]─► departments.value = data
    │           loading = false
    │
    └─[失敗]─► error.value = extractMessage(e)
                loading = false
```

### 2.2 部署登録フロー

```
[新規登録ボタン]
    │
    ▼
openCreateModal() → フォームリセット → showModal = true
    │
[フォーム入力]
    │
    ▼
submitForm()
    │
    ├─[validate() = false] → formErrors に表示、処理中断
    │
    ├─[submitting = true]
    │
    ▼
createDepartment(form)
    │
    ├─[成功]─► departments.value に追加（名前順ソート）
    │           closeModal()
    │
    └─[失敗]─► formErrors.name にエラーメッセージ表示
```

### 2.3 部署更新フロー

```
[編集ボタン]
    │
    ▼
openEditModal(dept) → フォームに既存値セット → showModal = true
    │
[フォーム編集]
    │
    ▼
submitForm()
    │
    ├─[validate() = false] → formErrors に表示、処理中断
    │
    ├─[submitting = true]
    │
    ▼
updateDepartment(editingId, form)
    │
    ├─[成功]─► departments.value[idx] を更新
    │           closeModal()
    │
    └─[失敗]─► formErrors.name にエラーメッセージ表示
```

### 2.4 部署削除フロー

```
[削除ボタン]
    │
    ▼
confirmDelete(dept) → deletingDept = dept → showDeleteConfirm = true
    │
[削除するボタン]
    │
    ▼
executeDelete()
    │
    ├─[submitting = true]
    │
    ▼
deleteDepartment(deletingDept.id)
    │
    ├─[成功]─► departments.value から該当レコードを除去
    │           showDeleteConfirm = false
    │
    └─[失敗]─► error.value にメッセージ表示
                showDeleteConfirm = false
              ※ 所属従業員が存在する場合は DB 外部キー制約エラー
```

---

## 3. モジュール設計

### 3.1 `useDepartments` composable

**ファイル**: `frontend/src/composables/useDepartments.ts`

#### 公開インターフェース

| メンバー | 型 | 説明 |
|---|---|---|
| `departments` | `Ref<Department[]>` | 部署一覧（取得後に更新） |
| `loading` | `Ref<boolean>` | データ取得中フラグ |
| `error` | `Ref<string \| null>` | エラーメッセージ（null = 正常） |
| `fetchDepartments()` | `() => Promise<void>` | 部署一覧を Supabase から取得 |
| `createDepartment(form)` | `(DepartmentFormData) => Promise<Department>` | 部署を新規登録 |
| `updateDepartment(id, form)` | `(string, DepartmentFormData) => Promise<Department>` | 部署情報を更新 |
| `deleteDepartment(id)` | `(string) => Promise<void>` | 部署を削除 |

#### 内部関数

| 関数 | 説明 |
|---|---|
| `sanitize(form)` | フォームデータをクリーニング（trim、空文字 → null 変換） |
| `extractMessage(e)` | `Error` / Supabase エラーオブジェクト / 不明 を統一してメッセージ文字列に変換 |

#### エラーハンドリング方針

- `fetchDepartments` はエラーを catch し `error.value` にメッセージをセット（例外は外に漏らさない）
- `createDepartment` / `updateDepartment` / `deleteDepartment` は例外をそのまま throw し、呼び出し側（View）で捕捉

---

## 4. データベース詳細設計

### 4.1 `departments` テーブル

| カラム名 | データ型 | 制約 | 説明 |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | 主キー |
| `name` | TEXT | NOT NULL | 部署名 |
| `code` | TEXT | NULL | 部署コード（任意）。例: DEV, HR |
| `description` | TEXT | NULL | 部署の説明 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 登録日時 |

**インデックス**:
- `idx_departments_name` ON `name`（一覧表示の ORDER BY 用）

**外部キー関連**:
- `employees.department_id` → `departments.id`（ON DELETE SET NULL）

### 4.2 RLS ポリシー（departments テーブル）

| ポリシー名 | 操作 | 対象ロール | 条件 |
|---|---|---|---|
| `departments_select_all` | SELECT | 全ロール（認証済み） | `auth.uid() IS NOT NULL` |
| `departments_insert_admin` | INSERT | admin | `profile.role = 'admin'` |
| `departments_update_admin` | UPDATE | admin | `profile.role = 'admin'` |
| `departments_delete_admin` | DELETE | admin | `profile.role = 'admin'` |

---

## 5. 型定義

### 5.1 `DepartmentFormData`（追加）

**ファイル**: `frontend/src/types/index.ts`

```typescript
export interface DepartmentFormData {
  name: string        // 部署名（必須）
  code: string        // 部署コード（任意、sanitize で空文字 → null）
  description: string // 説明（任意、sanitize で空文字 → null）
}
```

---

## 6. セキュリティ設計

### 6.1 部署管理の権限制御

| レイヤー | 制御内容 |
|---|---|
| **Vue Router** | `/departments` ルートに `meta: { requiresAdmin: true }` を付与。`router.beforeEach` で `auth.isAdmin` を検証し、非 admin は `/` にリダイレクト |
| **View 層** | `auth.isAdmin` が false の場合、[新規登録] ボタン・操作列を非表示 |
| **Supabase RLS** | `departments` テーブルの INSERT / UPDATE / DELETE は admin プロファイルのみ許可 |

### 6.2 バリデーション

- フロントエンドで部署コードの形式チェック（正規表現 `^[A-Za-z0-9-]+$`）を実施
- DB 側での制約は現時点では未定義（将来的に CHECK 制約を追加予定）
- 所属従業員が存在する部署の削除は `employees.department_id` の外部キー制約でエラーとなり、エラーメッセージをユーザーに表示

---

## 7. 単体テスト設計（useDepartments）

**ファイル**: `frontend/src/composables/__tests__/useDepartments.test.ts`

### 7.1 テスト対象

`useDepartments` composable の全公開関数

### 7.2 テスト観点・テスト条件・期待結果

#### 初期状態

| # | テスト観点 | 条件 | 期待結果 |
|---|---|---|---|
| T-01 | departments 初期値 | 初期化直後 | 空配列 `[]` |
| T-02 | loading 初期値 | 初期化直後 | `false` |
| T-03 | error 初期値 | 初期化直後 | `null` |

#### fetchDepartments

| # | テスト観点 | 条件 | 期待結果 |
|---|---|---|---|
| T-04 | 正常取得 | Supabase が data を返す | `departments.value` が取得データで更新される |
| T-05 | loading 復帰 | 正常取得完了後 | `loading.value === false` |
| T-06 | エラー（例外） | Promise が reject される | `error.value` にメッセージがセットされる |
| T-07 | エラー（オブジェクト） | `{ data: null, error: { message } }` が返る | `error.value` に `message` がセットされる |
| T-08 | data が null | Supabase が null を返す | `departments.value` が空配列 |

#### createDepartment

| # | テスト観点 | 条件 | 期待結果 |
|---|---|---|---|
| T-09 | 正常作成 | Supabase が作成済みデータを返す | Department オブジェクトが返る |
| T-10 | sanitize: trim | name に前後スペース | insert に trim 済み name が渡される |
| T-11 | sanitize: 空コード | code が空白文字のみ | insert に `code: null` が渡される |
| T-12 | sanitize: 空説明 | description が空白文字のみ | insert に `description: null` が渡される |
| T-13 | エラー | Supabase がエラー返却 | 例外が throw される |

#### updateDepartment

| # | テスト観点 | 条件 | 期待結果 |
|---|---|---|---|
| T-14 | 正常更新 | Supabase が更新済みデータを返す | 更新後 Department オブジェクトが返る |
| T-15 | id の受け渡し | id 指定で呼び出し | `.eq('id', <id>)` に正しい id が渡される |
| T-16 | エラー | Supabase がエラー返却 | 例外が throw される |

#### deleteDepartment

| # | テスト観点 | 条件 | 期待結果 |
|---|---|---|---|
| T-17 | 正常削除 | Supabase が error: null を返す | resolve(undefined)、例外なし |
| T-18 | id の受け渡し | id 指定で呼び出し | `.eq('id', <id>)` に正しい id が渡される |
| T-19 | エラー | Supabase がエラー返却 | 例外が throw される |

### 7.3 テスト実施コマンド

```bash
cd frontend
npm install
npx --no vitest run
```

### 7.4 テスト実施記録

| 実施日 | テストファイル | 件数 | 結果 |
|---|---|---|---|
| 2026-03-29 | useDepartments.test.ts | 19 | ✅ 全件 PASS |
| 2026-03-29 | useNotifications.test.ts | 19 | ✅ 全件 PASS |
| 2026-03-29 | StatusBadge.test.ts | 17 | ✅ 全件 PASS |
| — | **合計** | **55** | **✅ 全件 PASS** |

---

## 勤怠管理機能 詳細設計（SCR-09）

### SCR-09 勤怠管理画面（`/attendance`）

#### 画面レイアウト概要

```
┌─────────────────────────────────────────────────────────┐
│  勤怠管理                  [◄ 2026年3月 ►]              │
│  出退勤の打刻・勤怠実績の確認                            │
├─────────────────────────────────────────────────────────┤
│ 本日の打刻状況（カード）                                 │
│  2026年3月29日（土）                                     │
│  出勤: 09:00   退勤: —   実働: —                        │
│  [出勤ボタン（緑）] [退勤ボタン（赤）]                  │
├─────────────────────────────────────────────────────────┤
│ サマリーカード × 4                                       │
│  [出勤日数: 18日] [合計実働: 136h0m]                    │
│  [欠勤日数:  0日] [遅刻日数:  1日]                      │
├─────────────────────────────────────────────────────────┤
│ 2026年3月の勤怠実績 テーブル                            │
│  日付    ステータス  出勤   退勤   休憩  実働   備考     │
│  3/2（月） 出勤     09:01  18:03  60分  8h2m  —        │
│  3/3（火） 遅刻     10:15  18:00  60分  6h45m —        │
└─────────────────────────────────────────────────────────┘
```

#### 項目定義

| 項目 | 表示条件 | 型 | 備考 |
|---|---|---|---|
| 本日の打刻カード | 従業員レコードが存在する場合 | カード | `myEmployee` が null の場合は非表示 |
| 出勤時刻 | 常時 | 文字列 | `HH:mm` 形式。未打刻は「—」 |
| 退勤時刻 | 常時 | 文字列 | `HH:mm` 形式。未打刻は「—」 |
| 実働時間 | 常時 | 文字列 | `Xh Ym` 形式。未完了は「—」 |
| 出勤ボタン | 常時 | ボタン | 出勤打刻済み or ローディング中は disabled |
| 退勤ボタン | 常時 | ボタン | 未出勤 or 退勤済み or ローディング中は disabled |

#### 退勤モーダル項目定義

| フィールド | 必須 | 型 | デフォルト | バリデーション |
|---|---|---|---|---|
| 休憩時間（分） | — | number | 60 | 0以上の整数 |
| 備考 | — | text | '' | 任意入力 |

#### 入力チェック仕様

| チェック | 条件 | 動作 |
|---|---|---|
| 出勤重複防止 | 当日に出勤レコードが存在する | 出勤ボタンを disabled にする（UI 側）/ DB の UNIQUE 制約（DB 側） |
| 退勤前提チェック | 退勤ボタン押下時に todayRecord が null | `error.value = '出勤記録がありません'` をセット |
| 休憩時間下限 | break_minutes が負の値 | `Math.max(0, breakMinutes)` でクランプ |

#### イベント処理

| イベント | ハンドラ | 処理概要 |
|---|---|---|
| [出勤] クリック | `handleClockIn()` | `clockIn(employeeId)` を呼び出す |
| [退勤] クリック | `showClockOutModal = true` | 退勤モーダルを表示 |
| モーダル [退勤する] クリック | `handleClockOut()` | `clockOut(employeeId, break, note)` を呼び出す |
| [◄][►] クリック | `prevMonth()` / `nextMonth()` | 月を変更し `fetchMonthlyRecords` を再実行 |

---

### useAttendance コンポーザブル設計

#### 公開インターフェース

| 名前 | 種別 | 型 | 説明 |
|---|---|---|---|
| `todayRecord` | ref | `AttendanceRecord \| null` | 本日の打刻レコード |
| `monthlyRecords` | ref | `AttendanceRecord[]` | 月次レコード一覧 |
| `isLoading` | ref | `boolean` | 通信中フラグ |
| `error` | ref | `string \| null` | エラーメッセージ |
| `isClockedIn` | computed | `boolean` | 出勤打刻済みか |
| `isClockedOut` | computed | `boolean` | 退勤打刻済みか |
| `totalWorkMinutes` | computed | `number` | 月次合計実働時間（分） |
| `fetchTodayRecord(employeeId)` | async fn | `Promise<void>` | 本日レコード取得 |
| `clockIn(employeeId, note?)` | async fn | `Promise<void>` | 出勤打刻 |
| `clockOut(employeeId, break?, note?)` | async fn | `Promise<void>` | 退勤打刻 |
| `fetchMonthlyRecords(employeeId, year, month)` | async fn | `Promise<void>` | 月次レコード取得 |

#### totalWorkMinutes 算出ロジック

```
totalWorkMinutes = Σ max(0, floor((clock_out - clock_in) / 60000) - break_minutes)
                   ※ clock_in または clock_out が null のレコードは除外
```

---

### バックエンド API 詳細設計

#### POST /api/v1/attendance/clock-in

| 項目 | 内容 |
|---|---|
| 認証 | JWT 必須 |
| リクエストボディ | `{ employee_id: UUID, note?: string }` |
| 正常レスポンス | 200 `{ message: "出勤しました", record: AttendanceRecord }` |
| エラー: 重複 | 400 `{ error: "本日はすでに出勤打刻済みです" }` |
| 処理フロー | ① 同日レコード存在チェック → ② INSERT attendance_records |

#### POST /api/v1/attendance/clock-out

| 項目 | 内容 |
|---|---|
| 認証 | JWT 必須 |
| リクエストボディ | `{ employee_id: UUID, break_minutes?: i32, note?: string }` |
| 正常レスポンス | 200 `{ message: "退勤しました", record: AttendanceRecord }` |
| エラー: 出勤なし | 400 `{ error: "本日の出勤記録が見つかりません..." }` |
| 処理フロー | ① `clock_out IS NULL` の当日レコードを UPDATE |

#### GET /api/v1/attendance/today?employee_id=xxx

| 項目 | 内容 |
|---|---|
| 認証 | JWT 必須 |
| クエリパラメーター | `employee_id: UUID` |
| 正常レスポンス | 200 `{ record: AttendanceRecord \| null }` |

#### GET /api/v1/attendance/:employee_id/monthly?year=&month=

| 項目 | 内容 |
|---|---|
| 認証 | JWT 必須 |
| パスパラメーター | `employee_id: UUID` |
| クエリパラメーター | `year: i32, month: u32` |
| 正常レスポンス | 200 `MonthlySummary` |
| エラー: 無効な年月 | 400 `{ error: "無効な年月です" }` |
| 処理フロー | ① start_date/end_date を算出 → ② SELECT where work_date in [start, end) |

---

### データベース詳細設計 — attendance_records

| カラム | 型 | NULL | デフォルト | 制約 | 説明 |
|---|---|---|---|---|---|
| `id` | UUID | NOT NULL | gen_random_uuid() | PK | 主キー |
| `employee_id` | UUID | NOT NULL | — | FK employees(id) CASCADE | 従業員 ID |
| `user_id` | UUID | NOT NULL | — | FK auth.users(id) CASCADE | 打刻ユーザー（RLS 用） |
| `work_date` | DATE | NOT NULL | — | UNIQUE(employee_id, work_date) | 勤務日 |
| `clock_in` | TIMESTAMPTZ | NULL | NULL | — | 出勤時刻 |
| `clock_out` | TIMESTAMPTZ | NULL | NULL | — | 退勤時刻 |
| `break_minutes` | INTEGER | NOT NULL | 0 | CHECK >= 0 | 休憩時間（分） |
| `status` | TEXT | NOT NULL | 'present' | CHECK in enum | 勤怠ステータス |
| `note` | TEXT | NULL | NULL | — | 備考 |
| `created_at` | TIMESTAMPTZ | NOT NULL | NOW() | — | 作成日時 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | NOW() | トリガー自動更新 | 更新日時 |

**インデックス**:
- `idx_attendance_employee_id` on `employee_id`
- `idx_attendance_work_date` on `work_date`
- `idx_attendance_user_id` on `user_id`

---

### セキュリティ設計

| 対象 | 方針 |
|---|---|
| フロント → Supabase 直接操作 | RLS により `user_id = auth.uid()` のレコードのみ SELECT/INSERT/UPDATE 可 |
| manager / hr / admin の全件参照 | `profiles.role IN ('manager','hr','admin')` を条件とする SELECT ポリシー追加 |
| hr / admin の全件管理 | `profiles.role IN ('hr','admin')` を条件とする ALL ポリシー追加 |
| フロント → Rust API | `require_auth` ミドルウェアで JWT 検証。clock-in/out は自分の employee_id に対してのみ操作可能とする |

---

## 単体テスト設計 — useAttendance

### テスト対象

`frontend/src/composables/useAttendance.ts`

### テストファイル

`frontend/src/composables/__tests__/useAttendance.test.ts`

### テスト実施結果（2026-03-29）

| 日付 | ファイル | テスト数 | 結果 |
|---|---|---|---|
| 2026-03-29 | useAttendance.test.ts | 35 | ✅ 全件 PASS |

### テストケース一覧

| # | テストグループ | テストケース | テスト観点 | 期待結果 |
|---|---|---|---|---|
| 1 | 初期状態 | todayRecord は null | 初期値 | `null` |
| 2 | 初期状態 | monthlyRecords は空配列 | 初期値 | `[]` |
| 3 | 初期状態 | isLoading は false | 初期値 | `false` |
| 4 | 初期状態 | error は null | 初期値 | `null` |
| 5 | 初期状態 | isClockedIn は false | 初期値（computed） | `false` |
| 6 | 初期状態 | isClockedOut は false | 初期値（computed） | `false` |
| 7 | isClockedIn/Out | clock_in のみある場合 | 正常系 | `true / false` |
| 8 | isClockedIn/Out | clock_in と clock_out 両方 | 正常系 | `true / true` |
| 9 | totalWorkMinutes | 揃っているレコードのみ集計 | 正常系 | `480` |
| 10 | totalWorkMinutes | レコードが空のとき 0 | 境界値 | `0` |
| 11 | totalWorkMinutes | break > 実働 → 0 クランプ | 異常系・境界値 | `0` |
| 12 | totalWorkMinutes | 複数レコード合計 | 正常系 | `900` |
| 13 | fetchTodayRecord | 正常取得 | 正常系 | レコードがセットされる |
| 14 | fetchTodayRecord | data が null | 正常系（データなし） | `null` |
| 15 | fetchTodayRecord | isLoading が false に戻る | ローディング状態 | `false` |
| 16 | fetchTodayRecord | Supabase エラーオブジェクト | 異常系 | error にメッセージ |
| 17 | fetchTodayRecord | 例外スロー | 異常系 | error にメッセージ |
| 18 | clockIn | 正常打刻 | 正常系 | todayRecord が更新される |
| 19 | clockIn | employee_id が正しく渡る | 入力値検証 | insert に正しい id |
| 20 | clockIn | note が渡された場合 | 入力値検証 | note が insert に含まれる |
| 21 | clockIn | note 未指定 → null | 入力値検証 | `note: null` |
| 22 | clockIn | 未認証 | 異常系 | error セット・insert 非実行 |
| 23 | clockIn | Supabase エラー | 異常系 | error にメッセージ |
| 24 | clockIn | isLoading が false に戻る | ローディング状態 | `false` |
| 25 | clockOut | 正常退勤 | 正常系 | todayRecord が更新される |
| 26 | clockOut | todayRecord が null | 異常系 | error セット・update 非実行 |
| 27 | clockOut | eq に正しい id が渡る | 入力値検証 | eq('id', 'rec-target') |
| 28 | clockOut | break_minutes が負 → 0 | 境界値 | `break_minutes: 0` |
| 29 | clockOut | isLoading が false に戻る | ローディング状態 | `false` |
| 30 | fetchMonthlyRecords | 正常取得 | 正常系 | monthlyRecords が更新される |
| 31 | fetchMonthlyRecords | data が null → 空配列 | 正常系（データなし） | `[]` |
| 32 | fetchMonthlyRecords | 12月の年跨ぎ範囲 | 境界値 | gte='2026-12-01', lt='2027-01-01' |
| 33 | fetchMonthlyRecords | 1月の範囲 | 境界値 | gte='2026-01-01', lt='2026-02-01' |
| 34 | fetchMonthlyRecords | Supabase エラー | 異常系 | error にメッセージ |
| 35 | fetchMonthlyRecords | isLoading が false に戻る | ローディング状態 | `false` |

---

## テスト実施記録（累計）

| 日付 | ファイル | テスト数 | 結果 |
|---|---|---|---|
| 2026-03-29 | useDepartments.test.ts | 19 | ✅ 全件 PASS |
| 2026-03-29 | useNotifications.test.ts | 19 | ✅ 全件 PASS |
| 2026-03-29 | StatusBadge.test.ts | 17 | ✅ 全件 PASS |
| 2026-03-29 | useAttendance.test.ts | 35 | ✅ 全件 PASS |
| 2026-03-29 | useLeaves.test.ts | 32 | ✅ 全件 PASS |
| 2026-03-29 | useEmployees.test.ts | 45 | ✅ 全件 PASS |
| — | **合計** | **167** | **✅ 全件 PASS** |

---

## 休暇管理機能 詳細設計（SCR-07 / useLeaves）

### useLeaves コンポーザブル設計

**ファイル**: `frontend/src/composables/useLeaves.ts`

#### 公開インターフェース

| 名前 | 種別 | 型 | 説明 |
|---|---|---|---|
| `requests` | ref | `LeaveRequest[]` | 申請一覧 |
| `loading` | ref | `boolean` | 通信中フラグ |
| `error` | ref | `string \| null` | エラーメッセージ |
| `filters` | ref | `LeaveFilters` | 絞り込み条件（employee_id / status / leave_type / date_from / date_to） |
| `fetchRequests()` | async fn | `Promise<void>` | フィルターを適用して申請一覧を取得 |
| `submitRequest(form)` | async fn | `Promise<LeaveRequest>` | 新規申請を登録 |
| `approveRequest(id, reviewerId, comment?)` | async fn | `Promise<void>` | 申請を承認（有給残日数控除は Rust Backend 側） |
| `rejectRequest(id, reviewerId, comment)` | async fn | `Promise<void>` | 申請を却下（コメント必須） |
| `cancelRequest(id)` | async fn | `Promise<void>` | 申請をキャンセル |
| `applyFilters()` | fn | `void` | フィルターを適用して `fetchRequests` を再実行 |

#### sanitize ロジック

| フィールド | 処理 |
|---|---|
| `reason` | `.trim()` → 空文字の場合 `null` |

#### エラーハンドリング方針

- `fetchRequests`: try/catch で包み、エラーを `error.value` にセット（例外は外に漏らさない）
- `submitRequest` / `approveRequest` / `rejectRequest` / `cancelRequest`: 例外をそのまま throw（呼び出し側の View で捕捉）
- `rejectRequest`: コメントが空の場合は Supabase 呼び出し前に `throw new Error('却下理由を入力してください')`

---

### 処理フロー

#### fetchRequests フロー

```
fetchRequests()
  │
  ├─[loading = true]
  ├─[error = null]
  │
  ▼
supabase.from('leave_requests')
  .select('*, employee:employees(...), reviewer:profiles(...)')
  [if employee_id] .eq('employee_id', ...)
  [if status]      .eq('status', ...)
  [if leave_type]  .eq('leave_type', ...)
  [if date_from]   .gte('start_date', ...)
  [if date_to]     .lte('end_date', ...)
  .order('created_at', { ascending: false })
  │
  ├─[成功]─► requests.value = data ?? []
  │           loading = false
  │
  └─[失敗]─► error.value = e.message | '取得に失敗しました'
              loading = false
```

#### submitRequest フロー

```
submitRequest(form)
  │
  ▼
supabase.from('leave_requests')
  .insert({ employee_id, leave_type, start_date, end_date, days_count, reason: trim||null })
  .select('*, employee:employees(...)')
  .single()
  │
  ├─[成功]─► LeaveRequest を返す
  └─[失敗]─► throw err（View 側でハンドリング）
```

---

## 従業員管理機能 詳細設計（SCR-03〜06 / useEmployees）

### useEmployees コンポーザブル設計

**ファイル**: `frontend/src/composables/useEmployees.ts`

#### 公開インターフェース

| 名前 | 種別 | 型 | 説明 |
|---|---|---|---|
| `employees` | ref | `Employee[]` | 従業員一覧（ページネーション分） |
| `departments` | ref | `Department[]` | 部署一覧（フィルター用） |
| `loading` | ref | `boolean` | 通信中フラグ |
| `error` | ref | `string \| null` | エラーメッセージ |
| `pagination` | ref | `Pagination` | ページネーション情報（page / per_page=20 / total） |
| `filters` | ref | `EmployeeFilters` | 絞り込み条件 |
| `totalPages` | computed | `number` | `ceil(total / per_page)` |
| `fetchDepartments()` | async fn | `Promise<void>` | 部署一覧を取得（フィルター用） |
| `fetchEmployees()` | async fn | `Promise<void>` | フィルター・ページネーション付き一覧取得 |
| `fetchEmployee(id)` | async fn | `Promise<Employee \| null>` | 1件取得 |
| `createEmployee(form)` | async fn | `Promise<Employee>` | 新規登録 |
| `updateEmployee(id, form)` | async fn | `Promise<Employee>` | 情報更新 |
| `deleteEmployee(id)` | async fn | `Promise<void>` | 論理削除（status: inactive に更新） |
| `setPage(page)` | fn | `void` | ページを変更して再取得 |
| `applyFilters()` | fn | `void` | ページを 1 にリセットして再取得 |

#### sanitize ロジック（createEmployee / updateEmployee 共通）

| フィールド | 処理 |
|---|---|
| `employee_code` | `.trim()` |
| `full_name` | `.trim()` |
| `full_name_kana` | `.trim()` → 空文字 → `null` |
| `email` | `.trim().toLowerCase()` |
| `phone` | `.trim()` → 空文字 → `null` |
| `department_id` | 空文字 → `null` |
| `position` | `.trim()` |
| `birth_date` | 空文字 → `null` |
| `address` | `.trim()` → 空文字 → `null` |
| `emergency_contact_name` | `.trim()` → 空文字 → `null` |
| `emergency_contact_phone` | `.trim()` → 空文字 → `null` |
| `annual_leave_balance` | `Number(...)` で数値変換 |
| `notes` | `.trim()` → 空文字 → `null` |

#### deleteEmployee の論理削除

物理削除は行わず `status: 'inactive'` に更新することで退職処理とする。
これにより休暇申請履歴・勤怠記録との参照整合性を維持する。

#### ページネーション計算

```
from = (page - 1) * per_page   // 取得開始インデックス
to   = from + per_page - 1      // 取得終了インデックス
```

Supabase の `.range(from, to)` に渡し、`count: 'exact'` で総件数を取得する。

---

## テスト実施記録（最終）

| 日付 | ファイル | テスト数 | 結果 |
|---|---|---|---|
| 2026-03-29 | useDepartments.test.ts | 19 | ✅ 全件 PASS |
| 2026-03-29 | useNotifications.test.ts | 19 | ✅ 全件 PASS |
| 2026-03-29 | StatusBadge.test.ts | 17 | ✅ 全件 PASS |
| 2026-03-29 | useAttendance.test.ts | 35 | ✅ 全件 PASS |
| 2026-03-29 | useLeaves.test.ts | 32 | ✅ 全件 PASS |
| 2026-03-29 | useEmployees.test.ts | 45 | ✅ 全件 PASS |
| — | **合計** | **167** | **✅ 全件 PASS** |
