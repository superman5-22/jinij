-- ============================================================
-- 002_rls_policies.sql
-- jinij HR System — Row Level Security
-- ============================================================

-- RLS を有効化
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ヘルパー関数
-- ============================================================

-- 現在ユーザーのロールを取得（STABLE キャッシュ付き）
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- HR または Admin か
CREATE OR REPLACE FUNCTION is_admin_or_hr()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() IN ('admin', 'hr')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Manager 以上か (manager / hr / admin)
CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() IN ('manager', 'hr', 'admin')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- profiles ポリシー
-- ============================================================

-- 自分のプロフィール / HR・Admin は全件参照
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT
  USING (id = auth.uid() OR is_admin_or_hr());

-- 自分のプロフィールのみ更新
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Admin のみ削除（通常は不使用）
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE
  USING (get_my_role() = 'admin');

-- ============================================================
-- departments ポリシー
-- ============================================================

-- 認証済みユーザーは全件参照
CREATE POLICY "departments_select" ON departments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- HR / Admin のみ作成・更新
CREATE POLICY "departments_insert" ON departments
  FOR INSERT
  WITH CHECK (is_admin_or_hr());

CREATE POLICY "departments_update" ON departments
  FOR UPDATE
  USING (is_admin_or_hr());

-- Admin のみ削除
CREATE POLICY "departments_delete" ON departments
  FOR DELETE
  USING (get_my_role() = 'admin');

-- ============================================================
-- employees ポリシー
-- ============================================================

-- 認証済みユーザーは全件参照（基本情報の閲覧は許可）
CREATE POLICY "employees_select" ON employees
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- HR / Admin のみ登録・更新
CREATE POLICY "employees_insert" ON employees
  FOR INSERT
  WITH CHECK (is_admin_or_hr());

CREATE POLICY "employees_update" ON employees
  FOR UPDATE
  USING (is_admin_or_hr());

-- Admin のみ削除（論理削除を推奨）
CREATE POLICY "employees_delete" ON employees
  FOR DELETE
  USING (get_my_role() = 'admin');

-- ============================================================
-- leave_requests ポリシー
-- ============================================================

-- 参照ルール:
--   1. 自分の申請は常に見える
--   2. HR / Admin は全件見える
--   3. Manager は自部署の従業員の申請が見える
CREATE POLICY "leave_requests_select" ON leave_requests
  FOR SELECT
  USING (
    -- 自分の申請
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    -- HR / Admin
    OR is_admin_or_hr()
    -- Manager: 同じ部署の従業員の申請
    OR (
      get_my_role() = 'manager'
      AND employee_id IN (
        SELECT e.id
        FROM employees e
        WHERE e.department_id IN (
          SELECT me.department_id
          FROM employees me
          WHERE me.user_id = auth.uid()
        )
      )
    )
  );

-- 自分自身 / HR・Admin が申請作成できる
CREATE POLICY "leave_requests_insert" ON leave_requests
  FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    OR is_admin_or_hr()
  );

-- 更新ルール:
--   - 自分の pending 申請はキャンセル可能
--   - Manager 以上は承認・却下操作可能
CREATE POLICY "leave_requests_update" ON leave_requests
  FOR UPDATE
  USING (
    (
      employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
      AND status = 'pending'
    )
    OR is_manager_or_above()
  );

-- HR / Admin のみ削除
CREATE POLICY "leave_requests_delete" ON leave_requests
  FOR DELETE
  USING (is_admin_or_hr());

-- ============================================================
-- audit_logs ポリシー
-- ============================================================

-- HR / Admin のみ参照
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT
  USING (is_admin_or_hr());

-- 書き込みは Rust バックエンド (service_role) 経由のみ
-- → RLS ポリシーなし = service_role キーで bypass
