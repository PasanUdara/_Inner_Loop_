from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas.task_schema import TaskCreate, TaskOptionsResponse, TaskResponse, TaskSubmissionUpdate, TaskUpdate
from ..services.task_service import create_task, delete_task, task_options, task_records_for_user, update_task, update_task_submission
from ..utils.permissions import get_current_user, require_roles


router = APIRouter(prefix="/api/tasks", tags=["tasks"])
employee_only = require_roles("employee")


@router.get("", response_model=list[TaskResponse])
def list_tasks(user=Depends(get_current_user), db: Session = Depends(get_db)):
    return task_records_for_user(db, user)


@router.get("/options", response_model=TaskOptionsResponse)
def options(user=Depends(employee_only), db: Session = Depends(get_db)):
    return task_options(db, user)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create(payload: TaskCreate, user=Depends(employee_only), db: Session = Depends(get_db)):
    return create_task(db, payload, user)


@router.patch("/{task_id}", response_model=TaskResponse)
def update(task_id: int, payload: TaskUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return update_task(db, task_id, user, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(task_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    delete_task(db, task_id, user)


@router.patch("/{task_id}/submission", response_model=TaskResponse)
def submit_task(
    task_id: int,
    payload: TaskSubmissionUpdate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_task_submission(db, task_id, user, payload)
