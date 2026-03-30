-- ============================================================
-- 007_announcements.sql
-- jinij HR System — Announcement / Notice Board
-- ============================================================

-- ============================================================
-- announcements テーブル
-- ============================================================
CREATE TABLE announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body          TEXT NOT NULL CHECK (char_length(body) >= 1),
  category      TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('general', 'hr', 'event', 'urgent')),
  is_pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  published_at  TIMESTAMPTZ,            -- NULL = 下書き
  expires_at    TIMESTAMPTZ,            -- NULL = 有効期限なし
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 自動更新トリガー
CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス
CREATE INDEX idx_announcements_published_at ON announcements(published_at DESC NULLS LAST);
CREATE INDEX idx_announcements_category     ON announcements(category);
CREATE INDEX idx_announcements_is_pinned    ON announcements(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_announcements_expires_at   ON announcements(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- RLS ポリシー
-- ============================================================
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザー全員が公開済みお知らせを参照可能
-- （published_at が NULL でない かつ 有効期限内）
CREATE POLICY "announcements_authenticated_select" ON announcements
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND published_at IS NOT NULL
    AND published_at <= NOW()
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- HR / admin は下書き含む全件参照可能
CREATE POLICY "announcements_hr_select_all" ON announcements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- HR / admin のみ作成可能
CREATE POLICY "announcements_hr_insert" ON announcements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- HR / admin のみ更新可能
CREATE POLICY "announcements_hr_update" ON announcements
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- HR / admin のみ削除可能
CREATE POLICY "announcements_hr_delete" ON announcements
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- ============================================================
-- announcement_reads テーブル（既読管理）
-- ============================================================
CREATE TABLE announcement_reads (
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX idx_announcement_reads_user ON announcement_reads(user_id);

ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- 本人の既読レコードのみ参照・操作可能
CREATE POLICY "announcement_reads_owner" ON announcement_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- サンプルデータ（開発用）
-- ============================================================
-- ※ 実際の created_by は auth.users に存在する UUID が必要なため
--    本番環境では手動で INSERT してください。
-- INSERT INTO announcements (title, body, category, is_pinned, published_at, created_by) VALUES
--   ('2026年 夏季休暇のお知らせ', '今年の夏季休暇期間は8月13日（水）〜8月15日（金）です。', 'hr', true, NOW(), '<admin_user_id>'),
--   ('社内研修のご案内', '4月10日にコンプライアンス研修を実施します。全員参加必須です。', 'event', false, NOW(), '<admin_user_id>');
