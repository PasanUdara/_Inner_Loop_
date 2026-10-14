from fastapi import HTTPException, status
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models.task import Task
from ..models.project import Project
from ..models.intern_pod import InternPod
from ..models.user import User
from ..schemas.task_schema import TaskCreate, TaskSubmissionUpdate, TaskUpdate
from .project_service import intern_pod_ids, intern_project_ids


DONE_STATUSES = {"completed", "complete", "done", "closed", "approved"}


def refresh_project_progress(db: Session, project_ids: list[int | None]) -> None:
    """Recalculate each affected project's progress from its completed task count."""
    for project_id in {project_id for project_id in project_ids if project_id is not None}:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            continue
        tasks = db.query(Task.status).filter(Task.project_id == project_id).all()
        total = len(tasks)
        completed = sum((task_status or "").lower() in DONE_STATUSES for (task_status,) in tasks)
        project.progress_percentage = (
            (Decimal(completed * 100) / Decimal(total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if total else Decimal("0")
        )


def tasks_for_user(db: Session, user: User) -> list[Task]:
    query = db.query(Task)
    if user.role == "employee":
        responsible_project_ids = db.query(Project.id).filter(Project.responsible_employee_id == user.id)
        query = query.filter(or_(Task.assigned_user_id == user.id, Task.project_id.in_(responsible_project_ids)))
    elif user.role == "intern":
        pod_ids = intern_pod_ids(db, user.id)
        project_ids = intern_project_ids(db, user.id)
        conditions = [Task.assigned_user_id == user.id]
        if pod_ids:
            conditions.append(Task.assigned_intern_pod_id.in_(pod_ids))
        if project_ids:
            conditions.append(Task.project_id.in_(project_ids))
        query = query.filter(or_(*conditions))
    return query.order_by(Task.sequence_id.asc().nullslast(), Task.due_date.asc().nullslast(), Task.id.asc()).all()


def task_data(db: Session, task: Task) -> dict:
    project_name = db.query(Project.project_name).filter(Project.id == task.project_id).scalar() if task.project_id else None
    user_name = db.query(User.name).filter(User.id == task.assigned_user_id).scalar() if task.assigned_user_id else None
    pod_name = db.query(InternPod.pod_name).filter(InternPod.id == task.assigned_intern_pod_id).scalar() if task.assigned_intern_pod_id else None
    return {
        column.name: getattr(task, column.name)
        for column in Task.__table__.columns
    } | {
        "sequence_id": task.sequence_id if task.sequence_id is not None else 1,
        "project_name": project_name,
        "assigned_user_name": user_name,
        "assigned_intern_pod_name": pod_name,
        "submission_status": "Submitted" if task.completion_evidence_link or task.progress_note or task.progress_percentage > 0 else "Not submitted",
    }


def task_records_for_user(db: Session, user: User) -> list[dict]:
    return [task_data(db, task) for task in tasks_for_user(db, user)]


def task_options(db: Session) -> dict:
    return {
        "projects": [
            {"id": project.id, "project_name": project.project_name}
            for project in db.query(Project).order_by(Project.project_name.asc()).all()
        ],
        "assignees": [
            {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
            for user in db.query(User)
            .filter(User.status == "active", User.role.in_(["employee", "intern"]))
            .order_by(User.name.asc()).all()
        ],
        "interns": [
            {"id": user.id, "name": user.name, "email": user.email}
            for user in db.query(User)
            .filter(User.status == "active", User.role == "intern")
            .order_by(User.name.asc()).all()
        ],
        "pods": [
            {"id": pod.id, "pod_name": pod.pod_name}
            for pod in db.query(InternPod).order_by(InternPod.pod_name.asc()).all()
        ],
    }


def create_task(
    db: Session,
    payload: TaskCreate,
    default_assigned_user_id: int | None = None,
) -> dict:
    values = payload.model_dump()
    if values["assigned_user_id"] is None:
        values["assigned_user_id"] = default_assigned_user_id
    if values.get("sequence_id") is None:
        values["sequence_id"] = 1
    if payload.project_id is not None and not db.query(Project.id).filter(Project.id == payload.project_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected project does not exist.")
    if values["assigned_user_id"] is not None:
        assignee_exists = db.query(User.id).filter(
            User.id == values["assigned_user_id"],
            User.status == "active",
            User.role.in_(["employee", "intern"]),
        ).first()
        if not assignee_exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected assignee is not active or does not exist.")
    if payload.assigned_intern_pod_id is not None and not db.query(InternPod.id).filter(InternPod.id == payload.assigned_intern_pod_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected intern pod does not exist.")
    task = Task(**values)
    db.add(task)
    try:
        db.flush()
        refresh_project_progress(db, [task.project_id])
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more selected project, assignee, or pod records do not exist.") from error
    db.refresh(task)
    return task_data(db, task)


def _can_work_on_task(db: Session, task: Task, user: User) -> bool:
    if user.role == "management":
        return False
    if user.role == "employee":
        responsible = task.project_id and db.query(Project.id).filter(Project.id == task.project_id, Project.responsible_employee_id == user.id).first()
        return task.assigned_user_id == user.id or bool(responsible)
    pod_ids = intern_pod_ids(db, user.id)
    project_ids = intern_project_ids(db, user.id)
    return (
        task.assigned_user_id == user.id
        or task.assigned_intern_pod_id in pod_ids
        or task.project_id in project_ids
    )


def update_task(db: Session, task_id: int, user: User, payload: TaskUpdate) -> dict:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if not _can_work_on_task(db, task, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot update this task")
    values = payload.model_dump(exclude_unset=True)
    if user.role == "intern":
        allowed = {"status", "progress_note", "completion_evidence_link"}
        if set(values) - allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Interns can only update task progress and evidence")
    previous_project_id = task.project_id
    for field, value in values.items():
        setattr(task, field, value)
    try:
        refresh_project_progress(db, [previous_project_id, task.project_id])
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more selected project, assignee, or pod records do not exist.") from error
    db.refresh(task)
    return task_data(db, task)


def delete_task(db: Session, task_id: int, user: User) -> None:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    responsible = task.project_id and db.query(Project.id).filter(
        Project.id == task.project_id,
        Project.responsible_employee_id == user.id,
    ).first()
    if user.role != "employee" or (task.assigned_user_id != user.id and not responsible):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete tasks assigned to you")
    project_id = task.project_id
    db.delete(task)
    try:
        db.flush()
        refresh_project_progress(db, [project_id])
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to delete this task") from error


def update_task_submission(
    db: Session,
    task_id: int,
    user: User,
    payload: TaskSubmissionUpdate,
) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if not _can_work_on_task(db, task, user) or user.role == "management":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot update this task")

    for field, value in payload.model_dump(exclude_unset=True, exclude={"progress_percentage"}).items():
        setattr(task, field, value)
    refresh_project_progress(db, [task.project_id])
    db.commit()
    db.refresh(task)
    return task_data(db, task)
