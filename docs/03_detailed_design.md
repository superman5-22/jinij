# 詳細設計書

**システム名**: jinij — 社内人事管理システム
**バージョン**: 1.0
**作成日**: 2026-03-29
**改訂履歴**:

| バージョン | 日付 | 変更内容 | 担当者 |
|---|---|---|---|
| 1.0 | 2026-03-29 | 初版作成（部署管理機能） | - |

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
