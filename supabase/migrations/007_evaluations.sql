-- ============================================================
-- 007_evaluations.sql
-- 人事評価テーブル
-- ============================================================

-- 評価ステータス型
CREATE TYPE evaluation_status AS ENUM ('draft', 'submitted', 'finalized');

-- 人事評価レコードテーブル
CREATE TABLE IF NOT EXISTS evaluation_records (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  evaluator_id          UUID        NOT NULL REFERENCES profiles(id)  ON DELETE RESTRICT,
  year                  INTEGER     NOT NULL CHECK (year >= 2000 AND year <= 2100),
  quarter               INTEGER     NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  score_performance     INTEGER     NOT NULL CHECK (score_performance BETWEEN 1 AND 5),
  score_teamwork        INTEGER     NOT NULL CHECK (score_teamwork    BETWEEN 1 AND 5),
  score_communication   INTEGER     NOT NULL CHECK (score_communication BETWEEN 1 AND 5),
  score_leadership      INTEGER     NOT NULL CHECK (score_leadership  BETWEEN 1 AND 5),
  score_growth          INTEGER     NOT NULL CHECK (score_growth      BETWEEN 1 AND 5),
  overall_score         NUMERIC(3,2) GENERATED ALWAYS AS (
    (score_performance + score_teamwork + score_communication + score_leadership + score_growth)::NUMERIC / 5
  ) STORED,
  comment               TEXT,
  status                evaluation_status NOT NULL DEFAULT 'draft',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同一従業員・同一年・同一四半期の評価は1件のみ
  UNIQUE (employee_id, year, quarter)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_evaluation_records_employee_id   ON evaluation_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_records_evaluator_id  ON evaluation_records(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_records_year_quarter  ON evaluation_records(year, quarter);
CREATE INDEX IF NOT EXISTS idx_evaluation_records_status        ON evaluation_records(status);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_evaluation_records_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_evaluation_records_updated_at
  BEFORE UPDATE ON evaluation_records
  FOR EACH ROW EXECUTE FUNCTION update_evaluation_records_updated_at();

-- ============================================================
-- RLS ポリシー
-- ============================================================
ALTER TABLE evaluation_records ENABLE ROW LEVEL SECURITY;

-- ヘルパー（既存のものを再利用; なければ再定義）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_my_role'
  ) THEN
    CREATE FUNCTION get_my_role() RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS
      'SELECT role FROM profiles WHERE id = auth.uid()';
  END IF;
END $$;

-- 閲覧ポリシー
--   本人は自分の評価を参照可
--   manager/hr/admin は全件参照可
CREATE POLICY "evaluation_select" ON evaluation_records
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM employees WHERE id = employee_id)
    OR get_my_role() IN ('manager', 'hr', 'admin')
  );

-- 作成ポリシー: manager/hr/admin のみ
CREATE POLICY "evaluation_insert" ON evaluation_records
  FOR INSERT WITH CHECK (
    get_my_role() IN ('manager', 'hr', 'admin')
  );

-- 更新ポリシー: 自分が作成した評価のみ（finalized は不可）、hr/admin は全件
CREATE POLICY "evaluation_update" ON evaluation_records
  FOR UPDATE USING (
    (evaluator_id = auth.uid() AND status != 'finalized')
    OR get_my_role() IN ('hr', 'admin')
  );

-- 削除ポリシー: hr/admin のみ（finalized 以外）
CREATE POLICY "evaluation_delete" ON evaluation_records
  FOR DELETE USING (
    get_my_role() IN ('hr', 'admin') AND status != 'finalized'
  );
