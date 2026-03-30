# テスト仕様書 — お知らせ掲示板機能（F-90）

**ドキュメント番号**: jinij-TST-004
**対象機能**: お知らせ掲示板（Announcement Board）
**バージョン**: 1.0
**作成日**: 2026-03-30

---

# 4. 単体テスト（Unit Test）

## 4.1 テスト対象

| 対象ファイル | 対象関数 |
|-------------|---------|
| `src/composables/useAnnouncements.ts` | `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`, `markAsRead` |
| `src/composables/useAnnouncements.ts` | `buildPayload`（内部ロジック：trim / null 変換） |

**テストファイル**: `src/composables/__tests__/useAnnouncements.test.ts`
**テストフレームワーク**: Vitest 1.6.1 + Vue Test Utils

---

## 4.2 テストケース一覧

### 初期状態テスト

| TC-ID | テスト観点 | 入力 | 期待結果 |
|-------|----------|------|---------|
| UT-90-01 | 初期値: announcements | なし | 空配列 `[]` |
| UT-90-02 | 初期値: loading | なし | `false` |
| UT-90-03 | 初期値: error | なし | `null` |

### createAnnouncement テスト

| TC-ID | テスト観点 | 入力データ | 期待結果 |
|-------|----------|-----------|---------|
| UT-90-04 | 正常作成 | title='社内イベント', body='内容', category='event', is_pinned=false | 作成されたお知らせが返される（id='ann-new'） |
| UT-90-05 | title trim | title='  タイトル  ' | insert 呼び出し引数の title = 'タイトル' |
| UT-90-06 | published_at 空→null | published_at='' | insert 引数の published_at = null |
| UT-90-07 | expires_at 空→null | expires_at='' | insert 引数の expires_at = null |
| UT-90-08 | カテゴリ urgent | category='urgent', is_pinned=true | insert 引数に category='urgent', is_pinned=true |
| UT-90-09 | Supabase エラー | single() が error を返す | Error('作成失敗') を throw |

### updateAnnouncement テスト

| TC-ID | テスト観点 | 入力データ | 期待結果 |
|-------|----------|-----------|---------|
| UT-90-10 | 正常更新 | id='ann-001', title='更新後タイトル' | 更新されたお知らせが返される |
| UT-90-11 | eq 呼び出し確認 | id='ann-target' | eq('id', 'ann-target') が呼ばれる |
| UT-90-12 | Supabase エラー | single() が error を返す | Error('更新失敗') を throw |

### deleteAnnouncement テスト

| TC-ID | テスト観点 | 入力データ | 期待結果 |
|-------|----------|-----------|---------|
| UT-90-13 | 正常削除 | id='ann-001' | void（例外なし） |
| UT-90-14 | eq 呼び出し確認 | id='ann-target' | eq('id', 'ann-target') が呼ばれる |
| UT-90-15 | Supabase エラー | eq() が error を返す | Error('削除失敗') を throw |

### markAsRead テスト

| TC-ID | テスト観点 | 入力データ | 期待結果 |
|-------|----------|-----------|---------|
| UT-90-16 | 既読登録 + 状態更新 | is_read=false の ann を announcements にセット | upsert 呼ばれる + announcements[0].is_read = true |
| UT-90-17 | Supabase エラー | upsert() が error を返す | Error を throw |

---

## 4.3 テスト実施結果

```
実施日    : 2026-03-30
実施者    : Claude Code (自動)
実行コマンド: npx vitest run src/composables/__tests__/useAnnouncements.test.ts

結果:
  テストスイート: 1 passed (1)
  テストケース  : 16 passed (16)
  実行時間      : 12ms

全テスト合格 ✓
```

### 全体テスト（既存テスト含む）

```
テストスイート: 6 passed (6)
テストケース  : 129 passed (129)
（既存テスト影響なし）
```

---

# 5. 結合テスト（Integration Test）

## 5.1 テスト対象

| 結合対象 | 概要 |
|---------|------|
| AnnouncementView ↔ useAnnouncements | 画面操作 → Composable → Supabase の連携 |
| useAnnouncements ↔ Supabase RLS | 権限別データアクセス制御 |
| announcement_reads ↔ announcements | 既読管理の整合性 |

## 5.2 テストケース一覧

| TC-ID | テスト観点 | 前提条件 | 操作手順 | 期待結果 |
|-------|----------|---------|---------|---------|
| IT-90-01 | 一覧表示（employee ロール） | employee ユーザーでログイン済み。公開済みお知らせ 3 件 + 下書き 1 件 | `/announcements` にアクセス | 公開済み 3 件のみ表示。下書きは非表示 |
| IT-90-02 | 一覧表示（hr ロール・全件） | hr ユーザーでログイン済み | 「下書き含む」トグルを ON | 下書き含む 4 件表示 |
| IT-90-03 | カテゴリフィルター | hr / urgent の各 1 件 | カテゴリ「人事」を選択 | hr カテゴリのみ表示 |
| IT-90-04 | キーワード検索 | タイトルに「夏季」を含む 1 件 | 「夏季」と入力（300ms 待機） | 該当 1 件のみ表示 |
| IT-90-05 | 詳細表示・既読登録 | 未読お知らせ 1 件（NEW バッジあり） | カードをクリック | モーダルが開く。再クリック後 NEW バッジ消える |
| IT-90-06 | お知らせ作成（hr） | hr ユーザーログイン済み | 「新規作成」→フォーム入力→「作成」 | 一覧に追加される。下書き時はトグル ON で確認可能 |
| IT-90-07 | お知らせ作成権限なし | employee ユーザー | 「新規作成」ボタン | ボタンが表示されない（v-if=auth.isHR） |
| IT-90-08 | お知らせ削除（admin） | admin ユーザー。削除対象 1 件 | ゴミ箱アイコン → 確認モーダル「削除する」 | 一覧から消える。DB からも削除確認 |
| IT-90-09 | RLS: employee が直接 INSERT | employee JWT を使い PostgREST POST | curl で直接 INSERT リクエスト | HTTP 403 / RLS エラーで拒否 |
| IT-90-10 | 有効期限切れ非表示 | expires_at = 過去日時のお知らせ 1 件 | `/announcements` 表示 | 有効期限切れは一覧に表示されない |

## 5.3 使用環境

| 項目 | 内容 |
|------|------|
| フロントエンド | Vite dev server (localhost:5173) |
| バックエンド DB | Supabase（ステージング環境） |
| ブラウザ | Chrome 最新版 |
| テストユーザー | employee / manager / hr / admin 各 1 アカウント |

---

# 6. 総合テスト（System Test / Acceptance Test）

## 6.1 テスト対象

| 対象範囲 | 内容 |
|---------|------|
| お知らせ機能全体 | F-90-01〜F-90-14 全機能 |
| 既存機能との干渉 | ダッシュボード・従業員・休暇・勤怠・給与・部署管理が影響を受けないこと |
| 権限・認証 | ロール別アクセス制御が全機能で正しく機能すること |
| 非機能要件 | 性能・セキュリティ・ユーザビリティ |

## 6.2 テストケース一覧

### 業務シナリオテスト

| TC-ID | シナリオ名 | 操作手順 | 期待結果 |
|-------|----------|---------|---------|
| ST-90-01 | HR によるお知らせ公開フロー | ① hr ログイン → ② 新規作成（下書き保存）→ ③ 編集で公開日時設定 → ④ employee でログインして確認 | employee 側にお知らせが表示される |
| ST-90-02 | 緊急お知らせの優先表示 | ① urgent + is_pinned=true で作成 → ② 全ロールで一覧確認 | ピン留めお知らせが常に最上位表示 |
| ST-90-03 | 有効期限による自動非表示 | ① expires_at = 1分後に設定して公開 → ② 1分後に再表示 | 有効期限後は一覧から消える |
| ST-90-04 | 既読管理の整合性確認 | ① 3件のお知らせを順番にクリック → ② 一覧に戻り NEW バッジ確認 | 3件すべて NEW バッジが消える |
| ST-90-05 | 権限分離確認 | ① employee で作成試行（直接 URL 操作） → ② manager でも同様 | 作成ボタン非表示・RLS で DB 拒否 |
| ST-90-06 | 既存機能への影響なし | 全既存メニューを一通り操作 | ダッシュボード・従業員・休暇・勤怠・給与・部署が正常動作 |

### 非機能テスト

| TC-ID | テスト観点 | 条件 | 合否基準 |
|-------|----------|------|---------|
| ST-90-07 | **性能**: 一覧表示速度 | お知らせ 50 件登録済み | ページ表示 1 秒以内 |
| ST-90-08 | **性能**: 検索応答速度 | 50 件中キーワード検索 | debounce 含め 1 秒以内 |
| ST-90-09 | **セキュリティ**: XSS 耐性 | タイトル・本文に `<script>alert(1)</script>` を含む内容を作成・表示 | スクリプトが実行されない（テキスト表示のみ） |
| ST-90-10 | **ユーザビリティ**: レスポンシブ | スマートフォン幅（375px）で表示 | レイアウト崩れなし・操作可能 |
| ST-90-11 | **ユーザビリティ**: モーダル操作 | 背景クリックでモーダルが閉じるか | モーダル外クリックで閉じる |

## 6.3 合否判定基準

| 区分 | 定義 | 合否ライン |
|------|------|-----------|
| 重大欠陥 | データ破損・権限バイパス・クラッシュ | 0 件で合格 |
| 軽微欠陥 | UI の軽微なずれ・文言誤り | リリース判断は PM 裁量 |
| 性能 | 一覧表示 1 秒超過 | 1 件以内かつ恒常的でなければ合格 |

## 6.4 テスト環境

| 項目 | 内容 |
|------|------|
| フロントエンド | Vercel Preview 環境（本番ビルド） |
| DB | Supabase ステージングプロジェクト |
| テストデータ | お知らせ 50 件（各カテゴリ均等）、ユーザー 4 ロール各 1 名 |
| ブラウザ | Chrome 最新 / Firefox 最新 / Safari 最新 |
| モバイル | Chrome DevTools 375px / 768px エミュレーション |
| テスト実施者 | QA 担当者 1 名 + HR 担当者（受け入れテスト） |
