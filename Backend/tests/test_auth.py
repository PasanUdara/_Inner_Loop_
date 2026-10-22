from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models.project import Project
from app.models.task import Task


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def register(payload):
    return client.post("/api/auth/register", json=payload)


def login(email):
    client.cookies.clear()
    return client.post("/api/auth/login", json={"email": email, "password": "Password123"})


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    client.cookies.clear()


def test_project_and_task_apis_support_direct_assignments():
    employee = register({
        "name": "Esha Employee", "email": "employee@example.com", "password": "Password123",
        "role": "employee", "designation": "Engineer", "department": "Digital Lab",
    })
    assert employee.status_code == 201
    assert login("employee@example.com").status_code == 200

    project = client.post("/api/projects", json={"project_name": "Delivery Project"})
    assert project.status_code == 201

    task = client.post("/api/tasks", json={"task_title": "Delivery Task", "project_id": project.json()["id"]})
    assert task.status_code == 201
    assert project.json()["id"] == task.json()["project_id"]


def test_intern_sees_only_directly_assigned_tasks_and_no_projects():
    employee = register({
        "name": "Esha Employee", "email": "employee@example.com", "password": "Password123",
        "role": "employee", "designation": "Engineer", "department": "Digital Lab",
    })
    intern = register({"name": "Ishan Intern", "email": "intern@example.com", "password": "Password123", "role": "intern"})
    assert employee.status_code == 201 and intern.status_code == 201

    with TestingSession() as db:
        project = Project(project_name="Private Project", responsible_employee_id=employee.json()["user"]["id"])
        db.add(project)
        db.flush()
        db.add_all([
            Task(task_title="Assigned Task", project_id=project.id, assigned_user_id=intern.json()["user"]["id"]),
            Task(task_title="Unassigned Task", project_id=project.id),
        ])
        db.commit()

    assert login("intern@example.com").status_code == 200
    assert client.get("/api/projects").json() == []
    assert [task["task_title"] for task in client.get("/api/tasks").json()] == ["Assigned Task"]
