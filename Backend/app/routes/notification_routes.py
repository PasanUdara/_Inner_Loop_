from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.notification_schema import NotificationResponse
from ..services.notification_service import notifications_for_user
from ..utils.permissions import get_current_user


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(user=Depends(get_current_user), db: Session = Depends(get_db)):
    return notifications_for_user(db, user)
