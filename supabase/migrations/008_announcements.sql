-- ============================================================
-- 008_announcements.sql  社内お知らせ機能
-- ============================================================

-- お知らせテーブル
CREATE TABLE IF NOT EXISTS announcements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  content      TEXT        NOT NULL,
  category     TEXT        NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'hr', 'it', 'management', 'other')),
  priority     TEXT        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_published BOOLEAN     NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_announcements_is_published ON announcements(is_published);
CREATE INDEX IF NOT EXISTS idx_announcements_category     ON announcements(category);
CREATE INDEX IF NOT EXISTS idx_announcements_priority     ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON announcements(published_at DESC);

-- updated_at 自動更新トリガー
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS ポリシー
-- ============================================================
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーが公開済みお知らせを参照可能
CREATE POLICY "announcements_select_published"
  ON announcements FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND is_published = true
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- HR / 管理者は全件（下書き含む）参照可能
CREATE POLICY "announcements_select_admin"
  ON announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- HR / 管理者のみ作成可能
CREATE POLICY "announcements_insert"
  ON announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- HR / 管理者のみ更新可能
CREATE POLICY "announcements_update"
  ON announcements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- HR / 管理者のみ削除可能
CREATE POLICY "announcements_delete"
  ON announcements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- ============================================================
-- シードデータ（動作確認用）
-- ============================================================
INSERT INTO announcements (title, content, category, priority, is_published, published_at)
VALUES
  (
    '2026年度 夏季休暇について',
    '2026年8月13日（木）〜8月16日（土）を夏季休暇期間とします。業務上の都合がある場合は事前に上長に相談してください。',
    'hr', 'normal', true, NOW() - INTERVAL '3 days'
  ),
  (
    '社内システムメンテナンスのお知らせ',
    '4月10日（土）23:00〜翌5:00 にシステムメンテナンスを実施します。この間、人事システムへのアクセスができませんのでご注意ください。',
    'it', 'high', true, NOW() - INTERVAL '1 day'
  ),
  (
    '健康診断の日程調整について',
    '今年度の定期健康診断を5月中に実施予定です。日程が決まり次第、個別にご連絡します。',
    'hr', 'normal', true, NOW()
  );
