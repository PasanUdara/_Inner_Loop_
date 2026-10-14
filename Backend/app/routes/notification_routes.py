from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.notification_schema import NotificationResponse
from ..services.notification_service import dismiss_notification, notifications_for_user
from ..utils.permissions import get_current_user, require_roles


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(user=Depends(get_current_user), db: Session = Depends(get_db)):
    return notifications_for_user(db, user)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: str,
    user=Depends(require_roles("intern", "employee")),
    db: Session = Depends(get_db),
):
    dismiss_notification(db, user, notification_id)
