
-- ============================================================
-- InnerLoop Database Schema
-- PostgreSQL
-- ============================================================

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    designation VARCHAR(150),
    department VARCHAR(150),
    assigned_supervisor_id BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_assigned_supervisor
        FOREIGN KEY (assigned_supervisor_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);


-- ============================================================
-- 2. PROJECTS
-- ============================================================

CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    project_category VARCHAR(100),
    project_description TEXT,
    project_type VARCHAR(100),

    responsible_employee_id BIGINT,
    assigned_intern_pod_id BIGINT,

    current_status VARCHAR(50),
    progress_percentage NUMERIC(5,2) DEFAULT 0,
    current_progress_update TEXT,
    next_activity TEXT,
    target_date DATE,
    blockers TEXT,
    related_links TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_project_employee
        FOREIGN KEY (responsible_employee_id)
        REFERENCES users(id)
);


-- ============================================================
-- 3. PROJECT UPDATES
-- ============================================================

CREATE TABLE project_updates (
    id BIGSERIAL PRIMARY KEY,

    project_id BIGINT NOT NULL,
    update_date DATE NOT NULL,
    updated_by BIGINT,

    progress_note TEXT,
    progress_percentage NUMERIC(5,2),
    next_action TEXT,
    target_date DATE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_project_update_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_project_update_user
        FOREIGN KEY (updated_by)
        REFERENCES users(id)
);


-- ============================================================
-- 4. TASKS
-- ============================================================

CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,

    task_title VARCHAR(255) NOT NULL,
    description TEXT,

    project_id BIGINT,
    assigned_user_id BIGINT,
    assigned_intern_pod_id BIGINT,

    priority VARCHAR(50),
    status VARCHAR(50),
    progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,

    due_date DATE,
    progress_note TEXT,
    created_source VARCHAR(100),
    completion_evidence_link TEXT,
    sequence_id INTEGER NOT NULL DEFAULT 1,
    parent_task_id BIGINT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_task_progress_percentage
        CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

    CONSTRAINT fk_task_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_task_user
        FOREIGN KEY (assigned_user_id)
        REFERENCES users(id),

    CONSTRAINT fk_task_parent
        FOREIGN KEY (parent_task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE
);




-- Projects, tasks, and intern pods form a circular relationship. Add these
-- constraints only after both referenced tables have been created.
ALTER TABLE projects
    ADD CONSTRAINT fk_project_intern_pod
    FOREIGN KEY (assigned_intern_pod_id)
    REFERENCES intern_pods(id)
    ON DELETE SET NULL;

ALTER TABLE tasks
    ADD CONSTRAINT fk_task_intern_pod
    FOREIGN KEY (assigned_intern_pod_id)
    REFERENCES intern_pods(id)
    ON DELETE SET NULL;


-- ============================================================
-- 6. INTERN POD MEMBERS
-- ============================================================

CREATE TABLE intern_pod_members (
    id BIGSERIAL PRIMARY KEY,

    pod_id BIGINT NOT NULL,
    intern_user_id BIGINT NOT NULL,

    status VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pod_member_pod
        FOREIGN KEY (pod_id)
        REFERENCES intern_pods(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pod_member_user
        FOREIGN KEY (intern_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_pod_member
        UNIQUE (pod_id, intern_user_id)
);


-- ============================================================
-- 7. MEETING ROOMS
-- ============================================================

CREATE TABLE meeting_rooms (
    id BIGSERIAL PRIMARY KEY,

    room_name VARCHAR(150) NOT NULL,
    location VARCHAR(255),
    capacity INTEGER,
    status VARCHAR(50),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 8. MEETINGS
-- ============================================================

CREATE TABLE meetings (
    id BIGSERIAL PRIMARY KEY,

    meeting_title VARCHAR(255) NOT NULL,
    meeting_type VARCHAR(100),

    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,

    meeting_room_id BIGINT,

    status VARCHAR(50),
    meeting_minutes TEXT,

    created_by BIGINT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_meeting_room
        FOREIGN KEY (meeting_room_id)
        REFERENCES meeting_rooms(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_meeting_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id),

    CONSTRAINT check_meeting_time
        CHECK (end_datetime > start_datetime)
);


-- ============================================================
-- 9. MEETING ATTENDEES
-- ============================================================

CREATE TABLE meeting_attendees (
    id BIGSERIAL PRIMARY KEY,

    meeting_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,

    attendance_status VARCHAR(50),
    invitation_notification_dismissed_at TIMESTAMP,
    acceptance_notification_dismissed_at TIMESTAMP,

    CONSTRAINT fk_attendee_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES meetings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_attendee_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_meeting_attendee
        UNIQUE (meeting_id, user_id)
);


-- ============================================================
-- 10. MEETING PROJECTS
-- ============================================================

CREATE TABLE meeting_projects (
    id BIGSERIAL PRIMARY KEY,

    meeting_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,

    CONSTRAINT fk_meeting_project_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES meetings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_meeting_project_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_meeting_project
        UNIQUE (meeting_id, project_id)
);


-- ============================================================
-- 11. ROOM BOOKINGS
-- ============================================================

CREATE TABLE room_bookings (
    id BIGSERIAL PRIMARY KEY,

    room_id BIGINT NOT NULL,
    meeting_id BIGINT,

    booked_by BIGINT,

    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,

    status VARCHAR(50),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_booking_room
        FOREIGN KEY (room_id)
        REFERENCES meeting_rooms(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_booking_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES meetings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_booking_user
        FOREIGN KEY (booked_by)
        REFERENCES users(id),

    CONSTRAINT check_booking_time
        CHECK (end_datetime > start_datetime)
);


-- ============================================================
-- 12. DOCUMENTS
-- ============================================================

CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,

    project_id BIGINT,
    meeting_id BIGINT,

    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100),

    uploaded_by BIGINT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_document_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_document_meeting
        FOREIGN KEY (meeting_id)
        REFERENCES meetings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_document_uploader
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
);


-- ============================================================
-- 13. AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT,

    action VARCHAR(100) NOT NULL,
    module VARCHAR(100),
    record_id BIGINT,
    description TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_projects_responsible_employee
    ON projects(responsible_employee_id);

CREATE INDEX idx_users_assigned_supervisor
    ON users(assigned_supervisor_id);

CREATE INDEX idx_project_updates_project
    ON project_updates(project_id);

CREATE INDEX idx_tasks_project
    ON tasks(project_id);

CREATE INDEX idx_tasks_assigned_user
    ON tasks(assigned_user_id);

CREATE INDEX idx_tasks_assigned_pod
    ON tasks(assigned_intern_pod_id);

CREATE INDEX idx_intern_pods_project
    ON intern_pods(assigned_project_id);

CREATE INDEX idx_intern_pod_members_pod
    ON intern_pod_members(pod_id);

CREATE INDEX idx_meetings_start_datetime
    ON meetings(start_datetime);

CREATE INDEX idx_meeting_attendees_meeting
    ON meeting_attendees(meeting_id);

CREATE INDEX idx_meeting_projects_meeting
    ON meeting_projects(meeting_id);

CREATE INDEX idx_room_bookings_room
    ON room_bookings(room_id);

CREATE INDEX idx_room_bookings_datetime
    ON room_bookings(start_datetime, end_datetime);

CREATE INDEX idx_documents_project
    ON documents(project_id);

CREATE INDEX idx_documents_meeting
    ON documents(meeting_id);

CREATE INDEX idx_audit_logs_user
    ON audit_logs(user_id);

CREATE INDEX idx_audit_logs_module
    ON audit_logs(module);
