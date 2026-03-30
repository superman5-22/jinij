-- ============================================================
-- Migration 006: 給与管理テーブル
-- ============================================================

-- ----------------------------------------------------------------
-- salary_records: 給与明細レコード
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year            INTEGER     NOT NULL CHECK (year >= 2000 AND year <= 2099),
  month           INTEGER     NOT NULL CHECK (month >= 1 AND month <= 12),
  base_salary     NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  overtime_pay    NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (overtime_pay >= 0),
  allowances      NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  deductions      NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_salary      NUMERIC(12, 0) GENERATED ALWAYS AS
                    (base_salary + overtime_pay + allowances - deductions) STORED,
  paid_at         DATE,
  notes           TEXT,
  created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, year, month)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_salary_records_employee_id
  ON salary_records (employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_year_month
  ON salary_records (year, month);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_salary_records_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_salary_records_updated_at
  BEFORE UPDATE ON salary_records
  FOR EACH ROW EXECUTE FUNCTION update_salary_records_updated_at();

-- ----------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------
ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;

-- 管理者・人事担当: 全レコード読み書き可
CREATE POLICY salary_admin_all ON salary_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'hr')
    )
  );

-- 一般従業員: 自身のレコードのみ参照可
CREATE POLICY salary_employee_self ON salary_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = salary_records.employee_id
        AND employees.user_id = auth.uid()
    )
  );

-- マネージャー: 配下の従業員レコードを参照可
-- （departments テーブルを通じた間接管理を想定。簡易実装として hr/admin に委ねる）
CREATE POLICY salary_manager_dept ON salary_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'manager'
    )
  );
