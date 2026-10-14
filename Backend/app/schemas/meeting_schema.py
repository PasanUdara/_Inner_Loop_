from datetime import datetime
from typing import Literal
from pydantic import Field, model_validator

from pydantic import BaseModel, ConfigDict


class MeetingResponse(BaseModel):
    id: int
    meeting_title: str
    meeting_type: str | None = None
    start_datetime: datetime
    end_datetime: datetime
    meeting_room_id: int | None = None
    status: str | None = None
    meeting_minutes: str | None = None
    created_by: int | None = None
    attendee_user_ids: list[int] = Field(default_factory=list)
    accepted_attendee_count: int = 0
    current_user_attendance_status: str | None = None
    project_ids: list[int] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class MeetingCreate(BaseModel):
    meeting_title: str = Field(min_length=1, max_length=255)
    meeting_type: str | None = None
    start_datetime: datetime
    end_datetime: datetime
    meeting_room_id: int | None = None
    status: str = "Scheduled"
    meeting_minutes: str | None = None
    attendee_user_ids: list[int] = Field(default_factory=list)
    project_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_datetime <= self.start_datetime:
            raise ValueError("End time must be after start time")
        return self


class MeetingUpdate(MeetingCreate):
    pass


class MeetingAttendanceUpdate(BaseModel):
    attendance_status: Literal["Accepted", "Declined"]


class MeetingOptionsResponse(BaseModel):
    attendees: list[dict]
    projects: list[dict]
    rooms: list[dict]
