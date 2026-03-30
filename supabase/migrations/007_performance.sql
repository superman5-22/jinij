-- ============================================================
-- 007_performance.sql
-- 目標・評価管理テーブル
-- ============================================================

-- 評価期間マスタ
CREATE TABLE IF NOT EXISTS review_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,              -- 例: "2026年上期"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_periods_date_check CHECK (end_date > start_date)
);

-- 目標テーブル
CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  review_period_id UUID NOT NULL REFERENCES review_periods(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'business'
                    CHECK (category IN ('business', 'skill', 'behavior', 'other')),
  target_value    TEXT,                -- 定量目標（任意）
  weight          INT NOT NULL DEFAULT 100
                    CHECK (weight BETWEEN 1 AND 100),
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 評価テーブル
CREATE TABLE IF NOT EXISTS performance_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  review_period_id UUID NOT NULL REFERENCES review_periods(id) ON DELETE CASCADE,
  reviewer_id     UUID REFERENCES profiles(id),
  -- 自己評価 (1-5)
  self_score      INT CHECK (self_score BETWEEN 1 AND 5),
  self_comment    TEXT,
  -- 上長評価 (1-5)
  manager_score   INT CHECK (manager_score BETWEEN 1 AND 5),
  manager_comment TEXT,
  -- 総合評価ランク
  final_rank      TEXT CHECK (final_rank IN ('S', 'A', 'B', 'C', 'D')),
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'self_review', 'manager_review', 'completed')),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, review_period_id)
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'goals_updated_at') THEN
    CREATE TRIGGER goals_updated_at
      BEFORE UPDATE ON goals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'performance_reviews_updated_at') THEN
    CREATE TRIGGER performance_reviews_updated_at
      BEFORE UPDATE ON performance_reviews
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS 有効化
ALTER TABLE review_periods        ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews    ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー: review_periods（全員閲覧可、HR/Adminのみ変更可）
CREATE POLICY "review_periods_select" ON review_periods
  FOR SELECT USING (true);

CREATE POLICY "review_periods_insert" ON review_periods
  FOR INSERT WITH CHECK (is_admin_or_hr());

CREATE POLICY "review_periods_update" ON review_periods
  FOR UPDATE USING (is_admin_or_hr());

CREATE POLICY "review_periods_delete" ON review_periods
  FOR DELETE USING (is_admin_or_hr());

-- RLS ポリシー: goals（本人・上長・HR/Admin閲覧、本人作成・HR/Admin管理）
CREATE POLICY "goals_select" ON goals
  FOR SELECT USING (
    is_admin_or_hr()
    OR is_manager_or_above()
    OR employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "goals_insert" ON goals
  FOR INSERT WITH CHECK (
    is_admin_or_hr()
    OR employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "goals_update" ON goals
  FOR UPDATE USING (
    is_admin_or_hr()
    OR employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "goals_delete" ON goals
  FOR DELETE USING (is_admin_or_hr());

-- RLS ポリシー: performance_reviews（本人・上長・HR/Admin閲覧、HR/Admin管理）
CREATE POLICY "performance_reviews_select" ON performance_reviews
  FOR SELECT USING (
    is_admin_or_hr()
    OR reviewer_id = auth.uid()
    OR employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "performance_reviews_insert" ON performance_reviews
  FOR INSERT WITH CHECK (is_admin_or_hr() OR reviewer_id = auth.uid());

CREATE POLICY "performance_reviews_update" ON performance_reviews
  FOR UPDATE USING (
    is_admin_or_hr()
    OR reviewer_id = auth.uid()
    OR employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "performance_reviews_delete" ON performance_reviews
  FOR DELETE USING (is_admin_or_hr());

-- サンプルデータ（開発用）
INSERT INTO review_periods (name, start_date, end_date, is_active) VALUES
  ('2026年上期', '2026-04-01', '2026-09-30', true),
  ('2026年下期', '2026-10-01', '2027-03-31', false)
ON CONFLICT DO NOTHING;
