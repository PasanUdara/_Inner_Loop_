BEGIN;

ALTER TABLE meeting_attendees
    ADD COLUMN IF NOT EXISTS invitation_notification_dismissed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS acceptance_notification_dismissed_at TIMESTAMP;

COMMIT;
