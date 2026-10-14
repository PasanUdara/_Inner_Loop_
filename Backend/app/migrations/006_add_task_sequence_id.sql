ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS sequence_id INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_project_sequence ON tasks(project_id, sequence_id);
