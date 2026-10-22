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
