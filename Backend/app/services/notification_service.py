from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.meeting import Meeting, MeetingAttendee
from ..models.user import User


def notifications_for_user(db: Session, user: User) -> list[dict]:
    if user.role == "intern":
        invitations = (
            db.query(MeetingAttendee, Meeting)
            .join(Meeting, Meeting.id == MeetingAttendee.meeting_id)
            .filter(
                MeetingAttendee.user_id == user.id,
                func.lower(func.coalesce(MeetingAttendee.attendance_status, "invited")) == "invited",
                MeetingAttendee.invitation_notification_dismissed_at.is_(None),
            )
            .order_by(Meeting.created_at.desc(), Meeting.start_datetime.asc())
            .all()
        )
        return [
            {
                "id": f"meeting-invitation-{attendee.id}",
                "notification_type": "meeting_invitation",
                "title": "New meeting invitation",
                "message": f'You were added to "{meeting.meeting_title}".',
                "meeting_id": meeting.id,
                "start_datetime": meeting.start_datetime,
                "created_at": meeting.created_at,
            }
            for attendee, meeting in invitations
        ]

    if user.role == "employee":
        accepted_invitations = (
            db.query(MeetingAttendee, Meeting, User)
            .join(Meeting, Meeting.id == MeetingAttendee.meeting_id)
            .join(User, User.id == MeetingAttendee.user_id)
            .filter(
                Meeting.created_by == user.id,
                User.role == "intern",
                func.lower(func.coalesce(MeetingAttendee.attendance_status, "")) == "accepted",
                MeetingAttendee.acceptance_notification_dismissed_at.is_(None),
            )
            .order_by(Meeting.created_at.desc(), Meeting.start_datetime.asc())
            .all()
        )
        return [
            {
                "id": f"meeting-accepted-{attendee.id}",
                "notification_type": "meeting_invitation_accepted",
                "title": "Meeting invitation accepted",
                "message": f'{intern.name} accepted the invitation to "{meeting.meeting_title}".',
                "meeting_id": meeting.id,
                "start_datetime": meeting.start_datetime,
                "created_at": meeting.created_at,
            }
            for attendee, meeting, intern in accepted_invitations
        ]

    return []


def dismiss_notification(db: Session, user: User, notification_id: str) -> None:
    attendee = None
    dismissed_field = None

    if user.role == "intern" and notification_id.startswith("meeting-invitation-"):
        attendee_id = _notification_attendee_id(notification_id, "meeting-invitation-")
        attendee = db.query(MeetingAttendee).filter(
            MeetingAttendee.id == attendee_id,
            MeetingAttendee.user_id == user.id,
        ).first()
        dismissed_field = "invitation_notification_dismissed_at"
    elif user.role == "employee" and notification_id.startswith("meeting-accepted-"):
        attendee_id = _notification_attendee_id(notification_id, "meeting-accepted-")
        attendee = (
            db.query(MeetingAttendee)
            .join(Meeting, Meeting.id == MeetingAttendee.meeting_id)
            .join(User, User.id == MeetingAttendee.user_id)
            .filter(
                MeetingAttendee.id == attendee_id,
                Meeting.created_by == user.id,
                User.role == "intern",
            )
            .first()
        )
        dismissed_field = "acceptance_notification_dismissed_at"

    if not attendee or not dismissed_field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    setattr(attendee, dismissed_field, datetime.now(UTC).replace(tzinfo=None))
    db.commit()


def _notification_attendee_id(notification_id: str, prefix: str) -> int:
    try:
        return int(notification_id.removeprefix(prefix))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found") from exc
