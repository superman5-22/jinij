-- ============================================================
-- 006_salary.sql
-- jinij HR System — 給与管理テーブル
-- ============================================================

-- ============================================================
-- salary_templates (給与テンプレート)
-- 従業員ごとの月次標準給与設定
-- ============================================================
CREATE TABLE salary_templates (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- 支給項目（円）
  basic_salary            INTEGER     NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  housing_allowance       INTEGER     NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
  commute_allowance       INTEGER     NOT NULL DEFAULT 0 CHECK (commute_allowance >= 0),
  family_allowance        INTEGER     NOT NULL DEFAULT 0 CHECK (family_allowance >= 0),
  position_allowance      INTEGER     NOT NULL DEFAULT 0 CHECK (position_allowance >= 0),
  overtime_unit_price     INTEGER     NOT NULL DEFAULT 0 CHECK (overtime_unit_price >= 0),

  -- 控除項目（円）
  health_insurance        INTEGER     NOT NULL DEFAULT 0 CHECK (health_insurance >= 0),
  pension_insurance       INTEGER     NOT NULL DEFAULT 0 CHECK (pension_insurance >= 0),
  employment_insurance    INTEGER     NOT NULL DEFAULT 0 CHECK (employment_insurance >= 0),
  income_tax              INTEGER     NOT NULL DEFAULT 0 CHECK (income_tax >= 0),
  resident_tax            INTEGER     NOT NULL DEFAULT 0 CHECK (resident_tax >= 0),

  -- メモ
  note                    TEXT,

  effective_from          DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_by              UUID        REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (employee_id)
);

CREATE INDEX idx_salary_templates_employee_id ON salary_templates(employee_id);

-- ============================================================
-- payslips (給与明細)
-- 月次確定給与明細
-- ============================================================
CREATE TABLE payslips (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_year                INTEGER     NOT NULL CHECK (pay_year >= 2000 AND pay_year <= 2100),
  pay_month               INTEGER     NOT NULL CHECK (pay_month >= 1 AND pay_month <= 12),

  -- 支給項目（円）
  basic_salary            INTEGER     NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  housing_allowance       INTEGER     NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
  commute_allowance       INTEGER     NOT NULL DEFAULT 0 CHECK (commute_allowance >= 0),
  family_allowance        INTEGER     NOT NULL DEFAULT 0 CHECK (family_allowance >= 0),
  position_allowance      INTEGER     NOT NULL DEFAULT 0 CHECK (position_allowance >= 0),
  overtime_pay            INTEGER     NOT NULL DEFAULT 0 CHECK (overtime_pay >= 0),
  other_allowance         INTEGER     NOT NULL DEFAULT 0 CHECK (other_allowance >= 0),

  -- 控除項目（円）
  health_insurance        INTEGER     NOT NULL DEFAULT 0 CHECK (health_insurance >= 0),
  pension_insurance       INTEGER     NOT NULL DEFAULT 0 CHECK (pension_insurance >= 0),
  employment_insurance    INTEGER     NOT NULL DEFAULT 0 CHECK (employment_insurance >= 0),
  income_tax              INTEGER     NOT NULL DEFAULT 0 CHECK (income_tax >= 0),
  resident_tax            INTEGER     NOT NULL DEFAULT 0 CHECK (resident_tax >= 0),
  other_deduction         INTEGER     NOT NULL DEFAULT 0 CHECK (other_deduction >= 0),

  -- 集計（Generated Column）
  total_payment           INTEGER     GENERATED ALWAYS AS (
    basic_salary + housing_allowance + commute_allowance +
    family_allowance + position_allowance + overtime_pay + other_allowance
  ) STORED,
  total_deduction         INTEGER     GENERATED ALWAYS AS (
    health_insurance + pension_insurance + employment_insurance +
    income_tax + resident_tax + other_deduction
  ) STORED,
  net_payment             INTEGER     GENERATED ALWAYS AS (
    (basic_salary + housing_allowance + commute_allowance +
     family_allowance + position_allowance + overtime_pay + other_allowance)
    -
    (health_insurance + pension_insurance + employment_insurance +
     income_tax + resident_tax + other_deduction)
  ) STORED,

  -- ステータス
  status                  TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'confirmed')),
  note                    TEXT,

  confirmed_by            UUID        REFERENCES auth.users(id),
  confirmed_at            TIMESTAMPTZ,
  created_by              UUID        REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同月・同従業員の重複を防ぐ
  UNIQUE (employee_id, pay_year, pay_month)
);

CREATE INDEX idx_payslips_employee_id ON payslips(employee_id);
CREATE INDEX idx_payslips_pay_year_month ON payslips(pay_year, pay_month);

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_salary_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_salary_templates_updated_at
  BEFORE UPDATE ON salary_templates
  FOR EACH ROW EXECUTE FUNCTION update_salary_templates_updated_at();

CREATE OR REPLACE FUNCTION update_payslips_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payslips_updated_at
  BEFORE UPDATE ON payslips
  FOR EACH ROW EXECUTE FUNCTION update_payslips_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE salary_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips          ENABLE ROW LEVEL SECURITY;

-- ---- salary_templates ----

-- hr / admin: 全件操作可
CREATE POLICY "salary_templates_hr_admin_all"
  ON salary_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('hr', 'admin')
    )
  );

-- manager: 自部署の従業員テンプレートのみ閲覧可
CREATE POLICY "salary_templates_manager_select"
  ON salary_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN employees mgr ON mgr.user_id = p.id
      JOIN employees emp ON emp.department_id = mgr.department_id
      WHERE p.id = auth.uid()
        AND p.role = 'manager'
        AND emp.id = salary_templates.employee_id
    )
  );

-- employee: 自身のテンプレートのみ閲覧可
CREATE POLICY "salary_templates_employee_select"
  ON salary_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = salary_templates.employee_id
        AND employees.user_id = auth.uid()
    )
  );

-- ---- payslips ----

-- hr / admin: 全件操作可
CREATE POLICY "payslips_hr_admin_all"
  ON payslips FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('hr', 'admin')
    )
  );

-- manager: 自部署の従業員給与明細のみ閲覧可
CREATE POLICY "payslips_manager_select"
  ON payslips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN employees mgr ON mgr.user_id = p.id
      JOIN employees emp ON emp.department_id = mgr.department_id
      WHERE p.id = auth.uid()
        AND p.role = 'manager'
        AND emp.id = payslips.employee_id
    )
  );

-- employee: 自身の給与明細のみ閲覧可（確定済みのみ）
CREATE POLICY "payslips_employee_select"
  ON payslips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = payslips.employee_id
        AND employees.user_id = auth.uid()
    )
    AND status = 'confirmed'
  );
