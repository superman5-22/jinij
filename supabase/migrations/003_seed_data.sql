-- ============================================================
-- 003_seed_data.sql
-- jinij HR System — 開発用シードデータ
-- ※ 本番環境では実行しないこと
-- ============================================================

-- 部署
INSERT INTO departments (id, name, code, description) VALUES
  ('d1000000-0000-0000-0000-000000000001', '開発部',     'DEV',  'プロダクト開発・エンジニアリング'),
  ('d1000000-0000-0000-0000-000000000002', '営業部',     'SAL',  '国内外の営業活動'),
  ('d1000000-0000-0000-0000-000000000003', 'マーケティング部', 'MKT', 'ブランド・プロモーション'),
  ('d1000000-0000-0000-0000-000000000004', '人事部',     'HR',   '採用・労務管理'),
  ('d1000000-0000-0000-0000-000000000005', '総務部',     'GA',   '施設・経費・法務');

-- 従業員サンプル（Supabase Auth ユーザーなしで動作確認可能）
INSERT INTO employees (
  employee_code, full_name, full_name_kana, email, phone,
  department_id, position, employment_type,
  hire_date, birth_date, status, annual_leave_balance
) VALUES
  ('EMP001', '田中 太郎',   'タナカ タロウ',   'tanaka.t@example.co.jp',  '090-1234-5678',
   'd1000000-0000-0000-0000-000000000001', 'シニアエンジニア', 'full_time', '2020-04-01', '1988-07-15', 'active', 18),
  ('EMP002', '鈴木 花子',   'スズキ ハナコ',   'suzuki.h@example.co.jp',  '090-2345-6789',
   'd1000000-0000-0000-0000-000000000001', 'フロントエンドエンジニア', 'full_time', '2021-10-01', '1993-03-22', 'active', 20),
  ('EMP003', '佐藤 健一',   'サトウ ケンイチ', 'sato.k@example.co.jp',    '080-3456-7890',
   'd1000000-0000-0000-0000-000000000002', '営業マネージャー', 'full_time', '2018-07-16', '1985-11-30', 'active', 15),
  ('EMP004', '山本 美咲',   'ヤマモト ミサキ', 'yamamoto.m@example.co.jp', '070-4567-8901',
   'd1000000-0000-0000-0000-000000000003', 'マーケティングスペシャリスト', 'full_time', '2022-01-11', '1995-06-08', 'active', 20),
  ('EMP005', '伊藤 直樹',   'イトウ ナオキ',   'ito.n@example.co.jp',     '090-5678-9012',
   'd1000000-0000-0000-0000-000000000004', 'HRビジネスパートナー', 'full_time', '2019-04-01', '1990-02-14', 'active', 16),
  ('EMP006', '渡辺 あかり', 'ワタナベ アカリ', 'watanabe.a@example.co.jp', '080-6789-0123',
   'd1000000-0000-0000-0000-000000000001', 'バックエンドエンジニア', 'full_time', '2023-04-03', '1998-09-25', 'active', 20),
  ('EMP007', '中村 剛',     'ナカムラ ゴウ',   'nakamura.g@example.co.jp', '090-7890-1234',
   'd1000000-0000-0000-0000-000000000005', '総務担当', 'part_time', '2021-06-01', '1980-12-03', 'active', 10),
  ('EMP008', '小林 さやか', 'コバヤシ サヤカ', 'kobayashi.s@example.co.jp','070-8901-2345',
   'd1000000-0000-0000-0000-000000000002', '営業担当', 'full_time', '2022-10-17', '1996-04-19', 'on_leave', 20);

-- 休暇申請サンプル（EMP001 の employee id を利用）
INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, status)
SELECT
  e.id,
  'annual',
  CURRENT_DATE + 3,
  CURRENT_DATE + 5,
  3,
  '家族旅行のため',
  'pending'
FROM employees e WHERE e.employee_code = 'EMP001';

INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, status)
SELECT
  e.id,
  'sick',
  CURRENT_DATE - 2,
  CURRENT_DATE - 1,
  2,
  '発熱のため',
  'approved'
FROM employees e WHERE e.employee_code = 'EMP002';

INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, status)
SELECT
  e.id,
  'personal',
  CURRENT_DATE + 10,
  CURRENT_DATE + 10,
  1,
  '私用のため',
  'pending'
FROM employees e WHERE e.employee_code = 'EMP004';
