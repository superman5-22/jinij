-- ============================================================
-- 001_initial_schema.sql
-- jinij HR System — Initial Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- profiles (auth.users の拡張)
-- ============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'employee'
                  CHECK (role IN ('employee', 'manager', 'hr', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- departments (部署)
-- ============================================================
CREATE TABLE departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  code          TEXT UNIQUE,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- employees (従業員)
-- ============================================================
CREATE TABLE employees (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code            TEXT NOT NULL UNIQUE,
  full_name                TEXT NOT NULL,
  full_name_kana           TEXT,
  email                    TEXT NOT NULL UNIQUE,
  phone                    TEXT,
  department_id            UUID REFERENCES departments(id) ON DELETE SET NULL,
  position                 TEXT NOT NULL,
  employment_type          TEXT NOT NULL DEFAULT 'full_time'
                             CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary')),
  hire_date                DATE NOT NULL,
  birth_date               DATE,
  address                  TEXT,
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  status                   TEXT NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'inactive', 'on_leave')),
  annual_leave_balance     INTEGER NOT NULL DEFAULT 20,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_department   ON employees(department_id);
CREATE INDEX idx_employees_status       ON employees(status);
CREATE INDEX idx_employees_hire_date    ON employees(hire_date);
CREATE INDEX idx_employees_user_id      ON employees(user_id);

-- ============================================================
-- leave_requests (休暇申請)
-- ============================================================
CREATE TABLE leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type      TEXT NOT NULL
                    CHECK (leave_type IN ('annual', 'sick', 'personal', 'bereavement', 'other')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days_count      NUMERIC(4,1) NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  review_comment  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT positive_days    CHECK (days_count > 0)
);

CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status   ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates    ON leave_requests(start_date, end_date);

-- ============================================================
-- audit_logs (Rust Webhook 経由で書き込む監査ログ)
-- ============================================================
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name    TEXT NOT NULL,
  record_id     UUID NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data      JSONB,
  new_data      JSONB,
  performed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address    INET,
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_performed_at ON audit_logs(performed_at DESC);

-- ============================================================
-- Triggers: updated_at 自動更新
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leave_requests_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Trigger: 新規ユーザー登録時に profiles を自動作成
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
