-- ============================================================
-- 004_notifications.sql
-- jinij HR System — In-App Notification System
-- ============================================================

-- ============================================================
-- notifications テーブル
-- ============================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
                CHECK (type IN ('leave_approved', 'leave_rejected', 'leave_submitted', 'system')),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  related_id  UUID,           -- 関連レコードの ID (例: leave_requests.id)
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX idx_notifications_unread     ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================
-- RLS ポリシー
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 本人のみ参照・更新可能
CREATE POLICY "notifications_owner_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_owner_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- system / trigger による INSERT は SECURITY DEFINER 関数経由なので
-- 一般ユーザーからの直接 INSERT は禁止
CREATE POLICY "notifications_no_direct_insert" ON notifications
  FOR INSERT WITH CHECK (FALSE);

-- ============================================================
-- Trigger 関数: 休暇申請ステータス変化 → 通知生成
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_leave_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_title   TEXT;
  v_message TEXT;
  v_type    TEXT;
BEGIN
  -- ステータスが変化していない場合はスキップ
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- 従業員に紐づく auth ユーザー ID を取得
  SELECT user_id INTO v_user_id
  FROM employees
  WHERE id = NEW.employee_id;

  -- ユーザー紐付けがない従業員の場合はスキップ
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 通知内容を決定
  IF NEW.status = 'approved' THEN
    v_type    := 'leave_approved';
    v_title   := '休暇申請が承認されました';
    v_message := format(
      '%s から %s の休暇申請が承認されました。',
      to_char(NEW.start_date, 'YYYY年MM月DD日'),
      to_char(NEW.end_date,   'YYYY年MM月DD日')
    );

  ELSIF NEW.status = 'rejected' THEN
    v_type    := 'leave_rejected';
    v_title   := '休暇申請が却下されました';
    v_message := format(
      '%s から %s の休暇申請が却下されました。',
      to_char(NEW.start_date, 'YYYY年MM月DD日'),
      to_char(NEW.end_date,   'YYYY年MM月DD日')
    );
    IF NEW.review_comment IS NOT NULL AND NEW.review_comment <> '' THEN
      v_message := v_message || ' 理由: ' || NEW.review_comment;
    END IF;

  ELSE
    -- approved / rejected 以外の変化は通知不要
    RETURN NEW;
  END IF;

  -- 通知レコードを挿入（SECURITY DEFINER により RLS をバイパス）
  INSERT INTO notifications (user_id, type, title, message, related_id)
  VALUES (v_user_id, v_type, v_title, v_message, NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER leave_request_status_notify
  AFTER UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_leave_status_change();
