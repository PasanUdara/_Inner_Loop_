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
