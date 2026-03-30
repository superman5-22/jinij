-- ============================================================
-- 008_overtime_requests.sql
-- jinij HR System — 残業申請テーブル
-- ============================================================

-- ============================================================
-- overtime_requests (残業申請)
-- ============================================================
CREATE TABLE overtime_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date       DATE        NOT NULL,
  planned_end     TIME        NOT NULL,                            -- 予定退社時刻
  actual_end      TIME,                                            -- 実際の退社時刻（事後入力）
  overtime_hours  NUMERIC(4,2) NOT NULL CHECK (overtime_hours > 0),
  reason          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by     UUID        REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  review_comment  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_overtime_employee_id ON overtime_requests(employee_id);
CREATE INDEX idx_overtime_work_date   ON overtime_requests(work_date);
CREATE INDEX idx_overtime_status      ON overtime_requests(status);
CREATE INDEX idx_overtime_user_id     ON overtime_requests(user_id);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_overtime_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_overtime_updated_at
  BEFORE UPDATE ON overtime_requests
  FOR EACH ROW EXECUTE FUNCTION update_overtime_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;

-- 本人は自分の申請を参照可
CREATE POLICY "overtime_select_own"
  ON overtime_requests FOR SELECT
  USING (user_id = auth.uid());

-- manager / hr / admin は全レコードを参照可
CREATE POLICY "overtime_select_privileged"
  ON overtime_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('manager', 'hr', 'admin')
    )
  );

-- 本人は自分の申請を作成可
CREATE POLICY "overtime_insert_own"
  ON overtime_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 本人は pending の自分の申請をキャンセル可
CREATE POLICY "overtime_update_own"
  ON overtime_requests FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending');

-- manager / hr / admin は全レコードを管理可（承認・却下）
CREATE POLICY "overtime_all_privileged"
  ON overtime_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('manager', 'hr', 'admin')
    )
  );
