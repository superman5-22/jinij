-- ============================================================
-- 008_announcements.sql
-- お知らせ（掲示板）機能
-- ============================================================

-- カテゴリ ENUM
CREATE TYPE announcement_category AS ENUM ('general', 'important', 'event', 'hr');

-- お知らせテーブル
CREATE TABLE IF NOT EXISTS announcements (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT        NOT NULL,
  content       TEXT        NOT NULL,
  category      announcement_category NOT NULL DEFAULT 'general',
  is_pinned     BOOLEAN     NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,               -- NULL = 下書き
  expires_at    TIMESTAMPTZ,               -- NULL = 無期限
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();

-- インデックス
CREATE INDEX idx_announcements_published_at  ON announcements (published_at DESC);
CREATE INDEX idx_announcements_is_pinned      ON announcements (is_pinned);
CREATE INDEX idx_announcements_expires_at     ON announcements (expires_at);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは公開済みお知らせを閲覧可能
CREATE POLICY "announcements_select_published" ON announcements
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND published_at IS NOT NULL
    AND published_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
  );

-- HR・管理者は下書き含む全件閲覧可能
CREATE POLICY "announcements_select_hr_admin" ON announcements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- HR・管理者のみ作成可能
CREATE POLICY "announcements_insert_hr_admin" ON announcements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- HR・管理者のみ更新可能
CREATE POLICY "announcements_update_hr_admin" ON announcements
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- HR・管理者のみ削除可能
CREATE POLICY "announcements_delete_hr_admin" ON announcements
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('hr', 'admin')
    )
  );

-- ============================================================
-- サンプルデータ
-- ============================================================
INSERT INTO announcements (title, content, category, is_pinned, published_at) VALUES
  ('システムメンテナンスのお知らせ', '3月31日（月）22:00〜翌0:00 の間、定期メンテナンスを実施します。この間システムをご利用いただけません。', 'important', true,  now() - interval '1 day'),
  ('健康診断のご案内', '今年度の定期健康診断を4月15日〜30日に実施します。詳細は別途配布の案内書をご確認ください。', 'hr',        false, now() - interval '2 days'),
  ('社内勉強会開催のお知らせ', '4月10日（木）18:00より、第1会議室でセキュリティに関する勉強会を開催します。奮ってご参加ください。', 'event', false, now() - interval '3 days');
