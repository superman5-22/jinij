# 単体テスト設計書 — お知らせ（掲示板）機能

| バージョン | 作成日 | 実施者 |
|---|---|---|
| 1.0 | 2026-03-30 | システムアーキテクト |

---

## 1. テスト対象モジュール

| ファイル | テスト対象 |
|---|---|
| `src/composables/useAnnouncements.ts` | `useAnnouncements()` composable の全関数 |
| `src/composables/__tests__/useAnnouncements.test.ts` | テストファイル（Vitest + Happy DOM） |

---

## 2. テスト環境

| 項目 | 内容 |
|---|---|
| テストフレームワーク | Vitest v1.6.1 |
| DOM 環境 | Happy DOM |
| モック | `vi.mock('@/lib/supabase')` でクライアントをスタブ化 |
| 実行コマンド | `npx vitest run src/composables/__tests__/useAnnouncements.test.ts` |

---

## 3. テストケース一覧

### 3.1 初期状態（4件）

| No | テスト名 | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| U-01 | `announcements` は空配列 | 初期値 | — | `[]` |
| U-02 | `current` は null | 初期値 | — | `null` |
| U-03 | `isLoading` は false | 初期値 | — | `false` |
| U-04 | `error` は null | 初期値 | — | `null` |

---

### 3.2 `fetchAnnouncements`（5件）

| No | テスト名 | 観点 | 入力データ | 期待結果 |
|---|---|---|---|---|
| U-05 | 正常取得: announcements が更新される | 正常系 | Supabase が 2 件返す | `announcements.value` が 2 件 |
| U-06 | data が null のとき announcements は空配列 | 境界値 | Supabase が `null` 返す | `[]` |
| U-07 | Supabase エラー時: error にメッセージ | 異常系 | `error.message = 'DB接続エラー'` | `error.value === 'DB接続エラー'` |
| U-08 | ネットワーク例外時: error にメッセージ | 例外 | `Promise.reject(new Error('ネットワーク障害'))` | `error.value === 'ネットワーク障害'` |
| U-09 | 取得完了後 isLoading は false | ローディング | 正常データ | `isLoading.value === false` |

---

### 3.3 `fetchAnnouncement`（2件）

| No | テスト名 | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| U-10 | 正常取得: current が更新される | 正常系 | `id = 'ann-001'` | `current.value.id === 'ann-001'` |
| U-11 | Supabase エラー時: error に message | 異常系 | `error.message = '取得失敗'` | `error.value === '取得失敗'` |

---

### 3.4 `createAnnouncement`（7件）

| No | テスト名 | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| U-12 | 正常登録: Announcement が返される | 正常系 | 有効なフォームデータ | `result.title === form.title` |
| U-13 | insert に正しいデータが渡される | 引数検証 | 全フィールド入力 | `insert(objectContaining({...}))` |
| U-14 | published_at 空文字 → null になる | 境界値 | `published_at = ''` | `insert({published_at: null})` |
| U-15 | expires_at 空文字 → null になる | 境界値 | `expires_at = ''` | `insert({expires_at: null})` |
| U-16 | 認証情報なし → null を返す | 異常系 | `getUser()` が user=null 返す | `result === null`, `error.value !== null` |
| U-17 | Supabase エラー時: null を返す | 異常系 | DB error | `result === null`, `error.value === '登録失敗'` |
| U-18 | 登録成功時: announcements 先頭に追加 | 副作用 | 既存 1 件の配列 | `announcements[0]` が新規データ |

---

### 3.5 `updateAnnouncement`（4件）

| No | テスト名 | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| U-19 | 正常更新: Announcement が返される | 正常系 | `id, {title: '更新後'}` | `result.title === '更新後'` |
| U-20 | current も更新される | 副作用 | — | `current.value.title === '更新後'` |
| U-21 | announcements 配列内の対象レコードも更新 | 副作用 | 配列に既存 1 件 | `announcements[0].title === '新タイトル'` |
| U-22 | Supabase エラー時: null を返す | 異常系 | DB error | `result === null`, `error.value === '更新失敗'` |

---

### 3.6 `deleteAnnouncement`（3件）

| No | テスト名 | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| U-23 | 正常削除: true が返される | 正常系 | `id = 'ann-001'` | `result === true` |
| U-24 | 削除後: 配列から除去される | 副作用 | 配列 2 件 → 1 件削除 | 残り 1 件、削除対象が存在しない |
| U-25 | Supabase エラー時: false を返す | 異常系 | DB error | `result === false`, `error.value === '削除失敗'` |

---

### 3.7 `publishAnnouncement`（1件）

| No | テスト名 | 観点 | 入力 | 期待結果 |
|---|---|---|---|---|
| U-26 | published_at に現在時刻をセットする | 正常系 | `id = 'ann-001'` | `update({published_at: <ISO string>})` |

---

## 4. テスト実施結果

| 実施日 | 実施者 | 合計 | 成功 | 失敗 |
|---|---|---|---|---|
| 2026-03-30 | CI (Vitest) | 26 | **26** | **0** |

```
 ✓ src/composables/__tests__/useAnnouncements.test.ts  (26 tests) 15ms
 Test Files  1 passed (1)
      Tests  26 passed (26)
   Duration  520ms
```

---

## 5. 合否判定

| 基準 | 結果 |
|---|---|
| 全テストケース成功 | **合格** |
| カバレッジ（主要分岐網羅） | 正常系・異常系・境界値・副作用すべて網羅 |
