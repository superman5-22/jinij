-- ============================================================
-- 007_performance_reviews.sql
-- jinij HR System — 人事評価テーブル
-- ============================================================

-- ============================================================
-- performance_reviews (人事評価)
-- 従業員の定期評価レコード（四半期・半期・年次）
-- ============================================================
CREATE TABLE performance_reviews (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id         UUID        REFERENCES auth.users(id),

  -- 評価期間
  review_year         INTEGER     NOT NULL CHECK (review_year >= 2000 AND review_year <= 2100),
  review_type         TEXT        NOT NULL DEFAULT 'annual'
                        CHECK (review_type IN ('quarterly', 'semi_annual', 'annual')),
  review_quarter      INTEGER     CHECK (review_quarter >= 1 AND review_quarter <= 4),
                        -- quarterly の場合のみ 1〜4、それ以外は NULL

  -- 総合評価（1〜5）
  overall_rating      INTEGER     NOT NULL DEFAULT 3
                        CHECK (overall_rating >= 1 AND overall_rating <= 5),

  -- 評価項目（各 1〜5）
  performance_score   INTEGER     NOT NULL DEFAULT 3
                        CHECK (performance_score >= 1 AND performance_score <= 5),
                        -- 業績評価
  behavior_score      INTEGER     NOT NULL DEFAULT 3
                        CHECK (behavior_score >= 1 AND behavior_score <= 5),
                        -- 行動評価
  skill_score         INTEGER     NOT NULL DEFAULT 3
                        CHECK (skill_score >= 1 AND skill_score <= 5),
                        -- スキル評価

  -- コメント・記述欄
  goals_achievement   TEXT,   -- 目標達成状況
  strengths           TEXT,   -- 強み・よかった点
  improvements        TEXT,   -- 改善点・課題
  next_goals          TEXT,   -- 次期目標
  self_comment        TEXT,   -- 本人コメント（従業員が記入）
  reviewer_comment    TEXT,   -- 評価者コメント

  -- ステータス
  status              TEXT    NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'acknowledged')),
                        -- draft: 作成中, submitted: 提出済み, acknowledged: 本人確認済み

  submitted_at        TIMESTAMPTZ,
  acknowledged_at     TIMESTAMPTZ,
  created_by          UUID    REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同一従業員・同一評価期間の重複を防ぐ
  UNIQUE (employee_id, review_year, review_type, review_quarter)
);

CREATE INDEX idx_performance_reviews_employee_id
  ON performance_reviews(employee_id);
CREATE INDEX idx_performance_reviews_reviewer_id
  ON performance_reviews(reviewer_id);
CREATE INDEX idx_performance_reviews_year_type
  ON performance_reviews(review_year, review_type);
CREATE INDEX idx_performance_reviews_status
  ON performance_reviews(status);

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_performance_reviews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_performance_reviews_updated_at
  BEFORE UPDATE ON performance_reviews
  FOR EACH ROW EXECUTE FUNCTION update_performance_reviews_updated_at();

-- ============================================================
-- 評価提出時に被評価者へ通知を生成するトリガー
-- ============================================================
CREATE OR REPLACE FUNCTION notify_review_submitted()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_emp_name TEXT;
BEGIN
  -- status が draft → submitted に変わった時のみ実行
  IF OLD.status = 'draft' AND NEW.status = 'submitted' THEN
    -- 被評価者の user_id を取得
    SELECT e.user_id, e.full_name
      INTO v_user_id, v_emp_name
      FROM employees e
     WHERE e.id = NEW.employee_id;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (
        v_user_id,
        'system',
        '人事評価が提出されました',
        format('%s年度の人事評価が提出されました。内容をご確認ください。', NEW.review_year),
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_review_submitted
  AFTER UPDATE ON performance_reviews
  FOR EACH ROW EXECUTE FUNCTION notify_review_submitted();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;

-- hr / admin: 全件操作可
CREATE POLICY "perf_reviews_hr_admin_all"
  ON performance_reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('hr', 'admin')
    )
  );

-- manager: 自部署の従業員評価のみ閲覧・編集可（draft 含む）
CREATE POLICY "perf_reviews_manager_all"
  ON performance_reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN employees mgr ON mgr.user_id = p.id
      JOIN employees emp ON emp.department_id = mgr.department_id
      WHERE p.id = auth.uid()
        AND p.role = 'manager'
        AND emp.id = performance_reviews.employee_id
    )
  );

-- employee: 自身の評価のみ閲覧可（submitted / acknowledged のみ）
CREATE POLICY "perf_reviews_employee_select"
  ON performance_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = performance_reviews.employee_id
        AND employees.user_id = auth.uid()
    )
    AND status IN ('submitted', 'acknowledged')
  );

-- employee: 自身の評価の acknowledged への更新のみ可（本人確認）
CREATE POLICY "perf_reviews_employee_acknowledge"
  ON performance_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = performance_reviews.employee_id
        AND employees.user_id = auth.uid()
    )
    AND status = 'submitted'
  )
  WITH CHECK (status = 'acknowledged');
