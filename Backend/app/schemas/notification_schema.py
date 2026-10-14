from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    notification_type: str
    title: str
    message: str
    meeting_id: int
    start_datetime: datetime
    created_at: datetime
