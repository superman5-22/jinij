-- ============================================================
-- 005_attendance.sql
-- jinij HR System — 勤怠管理テーブル
-- ============================================================

-- ============================================================
-- attendance_records (勤怠記録)
-- ============================================================
CREATE TABLE attendance_records (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date      DATE        NOT NULL,
  clock_in       TIMESTAMPTZ,
  clock_out      TIMESTAMPTZ,
  break_minutes  INTEGER     NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  status         TEXT        NOT NULL DEFAULT 'present'
                   CHECK (status IN ('present', 'absent', 'late', 'early_leave', 'holiday', 'remote')),
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, work_date)
);

CREATE INDEX idx_attendance_employee_id ON attendance_records(employee_id);
CREATE INDEX idx_attendance_work_date   ON attendance_records(work_date);
CREATE INDEX idx_attendance_user_id     ON attendance_records(user_id);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_attendance_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 本人は自分のレコードを参照可
CREATE POLICY "attendance_select_own"
  ON attendance_records FOR SELECT
  USING (user_id = auth.uid());

-- manager / hr / admin は全レコードを参照可
CREATE POLICY "attendance_select_privileged"
  ON attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('manager', 'hr', 'admin')
    )
  );

-- 本人は自分のレコードを挿入可
CREATE POLICY "attendance_insert_own"
  ON attendance_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 本人は自分のレコードを更新可
CREATE POLICY "attendance_update_own"
  ON attendance_records FOR UPDATE
  USING (user_id = auth.uid());

-- hr / admin は全レコードを管理可
CREATE POLICY "attendance_all_privileged"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('hr', 'admin')
    )
  );
