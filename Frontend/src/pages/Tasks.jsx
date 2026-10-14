import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle, ArrowRight, ArrowUpDown, CalendarClock, Check, CheckCircle2, Circle, Clock3, ExternalLink,
  ChevronDown, Flag, FolderKanban, LayoutList, LoaderCircle, RefreshCw, Search,
  Send, SlidersHorizontal, Sparkles, Plus, UserPlus, UserRound, X,
} from "lucide-react";

import { listProjects } from "../api/projectApi";
import { createTask, getTaskOptions, listTasks, submitTask, updateTask } from "../api/taskApi";
import { useAuth } from "../context/AuthContext";
import { canCreateTasks } from "../utils/rolePermissions";

const DONE = new Set(["completed", "complete", "done", "closed", "approved"]);
const DOING = new Set(["in progress", "in-progress", "active", "review", "in review"]);
const emptyTaskForm = { task_title: "", description: "", project_id: "", assigned_user_id: "", assigned_intern_pod_id: "", priority: "Medium", status: "To do", due_date: "", progress_note: "", sequence_id: 1, parent_task_id: "" };

function normalized(value) { return String(value || "").trim().toLowerCase(); }
function isDone(task) { return DONE.has(normalized(task.status)); }
function taskStatusValue(task) {
  if (isDone(task)) return "Completed";
  if (DOING.has(normalized(task.status))) return "In progress";
  return "To do";
}
function isOverdue(task) { return Boolean(task.due_date && !isDone(task) && new Date(`${task.due_date}T23:59:59`) < new Date()); }
function formatDate(value) { return value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "No due date"; }

function priorityTone(priority) {
  const value = normalized(priority);
  if (["urgent", "critical", "high"].includes(value)) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (["medium", "normal"].includes(value)) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function Metric({ icon: Icon, label, value, detail, tone = "blue" }) {
  const color = tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "rose" ? "bg-rose-50 text-rose-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-[#075fae]";
  return <article className="stat-card"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${color}`}><Icon size={20} /></span><div><p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-[#10233f]">{value}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div></article>;
}

function projectTone(status) {
  const value = normalized(status);
  if (["completed", "complete", "done", "closed"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["blocked", "delayed", "at risk", "at-risk"].includes(value)) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (["active", "on track", "in progress"].includes(value)) return "bg-blue-50 text-[#075fae] ring-blue-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function TaskModal({ options, currentProjectId, projects, tasks, submitting, onSubmit, onClose }) {
  // Existing tasks for selected project
  const initialProjectId = currentProjectId || "";
  const projectTasks = useMemo(() => {
    if (!initialProjectId || !tasks) return [];
    return tasks.filter((t) => Number(t.project_id) === Number(initialProjectId));
  }, [tasks, initialProjectId]);

  const existingSequences = useMemo(() => {
    const seqSet = new Set(projectTasks.map((t) => t.sequence_id || 1));
    return Array.from(seqSet).sort((a, b) => a - b);
  }, [projectTasks]);

  const defaultNextSeq = existingSequences.length ? Math.max(...existingSequences) + 1 : 1;

  const [form, setForm] = useState({
    ...emptyTaskForm,
    project_id: initialProjectId,
    assigned_user_id: "",
    sequence_id: defaultNextSeq,
  });
  const [showInternPicker, setShowInternPicker] = useState(false);
  const [internSearch, setInternSearch] = useState("");

  const interns = useMemo(() => {
    const list = options.interns?.length ? options.interns : options.assignees?.filter((u) => u.role === "intern") || [];
    if (!internSearch.trim()) return list;
    const q = internSearch.toLowerCase();
    return list.filter((i) => i.name?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q));
  }, [options, internSearch]);

  const selectedIntern = useMemo(() => {
    const list = options.interns?.length ? options.interns : options.assignees?.filter((u) => u.role === "intern") || [];
    return list.find((i) => Number(i.id) === Number(form.assigned_user_id));
  }, [options, form.assigned_user_id]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const optional = (value) => (value && String(value).trim()) || null;

  function handleSelectIntern(internId) {
    setForm((current) => ({
      ...current,
      assigned_user_id: internId,
    }));
    setShowInternPicker(false);
  }

  function handleRemoveIntern() {
    setForm((current) => ({
      ...current,
      assigned_user_id: "",
    }));
  }

  function save(event) {
    event.preventDefault();
    const chosenProject = projects?.find((p) => Number(p.id) === Number(form.project_id));
    onSubmit({
      ...form,
      task_title: form.task_title.trim(),
      description: optional(form.description),
      sequence_id: Math.max(1, parseInt(form.sequence_id, 10) || 1),
      parent_task_id: form.parent_task_id ? Number(form.parent_task_id) : null,
      project_id: form.project_id ? Number(form.project_id) : null,
      assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : null,
      assigned_intern_pod_id: form.assigned_intern_pod_id
        ? Number(form.assigned_intern_pod_id)
        : chosenProject?.assigned_intern_pod_id
        ? Number(chosenProject.assigned_intern_pod_id)
        : null,
      due_date: form.due_date || null,
      progress_note: optional(form.progress_note),
      created_source: "Employee workspace",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-lg rounded-[28px] border border-slate-200/90 bg-white p-6 shadow-2xl shadow-slate-900/20 sm:p-7 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="eyebrow text-[#0871c6]">New Task</span>
            <h3 className="section-title mt-1">Add task</h3>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close pop-up"
          >
            <X size={18} />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={save}>
          <div>
            <label className="field-label">
              Task name <span className="text-rose-500">*</span>
            </label>
            <input
              className="field-input mt-1.5"
              value={form.task_title}
              onChange={update("task_title")}
              placeholder="e.g. Design wireframes for mobile login"
              required
              autoFocus
              maxLength={255}
            />
          </div>

          <div>
            <label className="field-label">
              Description
            </label>
            <textarea
              className="field-input mt-1.5 min-h-24 resize-y"
              value={form.description}
              onChange={update("description")}
              placeholder="Describe the task expectations, scope, and deliverables..."
            />
          </div>

          {/* Intern Assignment Section */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Intern assignment
              </span>
              {selectedIntern && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                  Intern assigned
                </span>
              )}
            </div>

            {!selectedIntern && !showInternPicker && (
              <button
                type="button"
                onClick={() => setShowInternPicker(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#20b51d]/40 bg-[#edfbed] px-4 py-3 text-sm font-extrabold text-[#168f18] transition hover:border-[#20b51d] hover:bg-[#e2f8e2]"
              >
                <UserPlus size={18} />
                <span>+ Add Intern</span>
              </button>
            )}

            {showInternPicker && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">Choose an intern:</span>
                  <button
                    type="button"
                    onClick={() => setShowInternPicker(false)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                {options.interns?.length > 4 && (
                  <input
                    type="text"
                    value={internSearch}
                    onChange={(e) => setInternSearch(e.target.value)}
                    placeholder="Search intern name or email..."
                    className="field-input py-1.5 text-xs"
                  />
                )}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {interns.length ? (
                    interns.map((intern) => (
                      <button
                        key={intern.id}
                        type="button"
                        onClick={() => handleSelectIntern(intern.id)}
                        className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-slate-50 ${
                          Number(form.assigned_user_id) === intern.id ? "bg-emerald-50 ring-1 ring-emerald-400" : ""
                        }`}
                      >
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-[#daf3d8] text-xs font-extrabold text-[#159c18] shrink-0">
                          {intern.name?.slice(0, 2).toUpperCase() || "IN"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800">{intern.name}</p>
                          <p className="truncate text-[11px] text-slate-400">{intern.email}</p>
                        </div>
                        {Number(form.assigned_user_id) === intern.id && (
                          <Check size={16} className="text-emerald-600 shrink-0" />
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="py-3 text-center text-xs text-slate-400">No active interns found.</p>
                  )}
                </div>
              </div>
            )}

            {selectedIntern && !showInternPicker && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#daf3d8] text-xs font-extrabold text-[#159c18]">
                    {selectedIntern.name?.slice(0, 2).toUpperCase() || "IN"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{selectedIntern.name}</p>
                    <p className="truncate text-xs text-slate-400">{selectedIntern.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => setShowInternPicker(true)}
                    className="text-xs font-bold text-emerald-700 hover:underline px-2 py-1"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveIntern}
                    className="icon-button h-7 w-7 text-slate-400 hover:text-rose-600"
                    aria-label="Remove assigned intern"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="field-label">
              Project
            </label>
            <select
              className="field-input mt-1.5"
              value={form.project_id}
              onChange={update("project_id")}
            >
              <option value="">No project (Independent task)</option>
              {options.projects?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_name}
                </option>
              ))}
            </select>
          </div>

          {/* Workflow Sequence / Stage configuration */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                Workflow Sequence / Stage
              </span>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black text-[#075fae]">
                Stage #{form.sequence_id || 1}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500">
                  Sequence number
                </label>
                <input
                  type="number"
                  min="1"
                  className="field-input mt-1 text-sm font-black text-[#075fae]"
                  value={form.sequence_id}
                  onChange={update("sequence_id")}
                  required
                />
              </div>

              {existingSequences.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500">
                    Join stage (as sub-task)
                  </label>
                  <select
                    className="field-input mt-1 text-xs"
                    value={existingSequences.includes(Number(form.sequence_id)) ? form.sequence_id : ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        setForm((curr) => ({ ...curr, sequence_id: Number(e.target.value) }));
                      }
                    }}
                  >
                    <option value="">Select existing stage...</option>
                    {existingSequences.map((seq) => {
                      const count = projectTasks.filter((t) => (t.sequence_id || 1) === seq).length;
                      return (
                        <option key={seq} value={seq}>
                          Stage #{seq} ({count} existing task{count > 1 ? "s" : ""})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 Tasks with the same Sequence ID run together as sub-tasks in that stage. If there are 3 tasks for Sequence #2, management will see all 3 tasks under the project's current running stage.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Due date</label>
              <input
                className="field-input mt-1.5"
                type="date"
                value={form.due_date}
                onChange={update("due_date")}
              />
            </div>
            <div>
              <label className="field-label">Priority</label>
              <select
                className="field-input mt-1.5"
                value={form.priority}
                onChange={update("priority")}
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting}
            >
              {submitting ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Check size={17} />
              )}
              <span>{submitting ? "Saving..." : "Save task"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function SubmissionForm({ task, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    completion_evidence_link: task.completion_evidence_link || "",
    progress_note: task.progress_note || "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (event) =>
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const updated = await submitTask(task.id, form);
      onSubmitted(updated);
      setOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Unable to save submission.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <div className="flex justify-end">
        <button
          className="secondary-button min-h-10 px-4"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={15} /> : <Send size={15} />}
          {open ? "Close" : "Submit work"}
        </button>
      </div>

      {open && (
        <form className="mt-4 space-y-4" onSubmit={save}>
          <label className="field-label">
            Evidence link
            <input
              className="field-input"
              type="url"
              placeholder="https://..."
              value={form.completion_evidence_link}
              onChange={update("completion_evidence_link")}
            />
          </label>

          <label className="field-label">
            Progress note
            <textarea
              className="field-input min-h-24 resize-y"
              value={form.progress_note}
              onChange={update("progress_note")}
              placeholder="Summarize what you completed..."
            />
          </label>

          {error && (
            <p className="text-xs font-semibold text-rose-600">{error}</p>
          )}

          <button
            className="primary-button w-full justify-center"
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}

            {saving ? "Saving..." : "Save submission"}
          </button>
        </form>
      )}
    </div>
  );
}

function TaskCard({ task, compact = false, currentUser, onStatusChange, onSubmitted }) {
  const overdue = isOverdue(task);
  const isIntern = currentUser?.role === "intern";
  const canUpdateTask = currentUser?.role === "employee" || (isIntern && Number(task.assigned_user_id) === Number(currentUser?.id));
  return (
    <article className={`flex min-w-0 flex-col border bg-white shadow-[0_10px_35px_rgba(15,45,75,.045)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(15,45,75,.09)] ${compact ? "rounded-[22px] p-3.5 sm:p-4" : "rounded-[26px] p-5"} ${overdue ? "border-rose-200" : "border-slate-200/80"}`}>
      <div className={`flex items-start ${compact ? "gap-2" : "gap-3"}`}>
        <button
          type="button"
          onClick={() => canUpdateTask && onStatusChange && onStatusChange(task, isDone(task) ? "In progress" : "Completed")}
          disabled={!canUpdateTask}
          className={`mt-0.5 grid shrink-0 place-items-center transition ${canUpdateTask ? "hover:scale-105" : "cursor-not-allowed opacity-55"} ${compact ? "h-8 w-8 rounded-xl" : "h-10 w-10 rounded-2xl"} ${isDone(task) ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-blue-50 text-[#075fae] hover:bg-blue-100"}`}
          title={canUpdateTask ? (isDone(task) ? "Click to set in progress" : "Click to mark completed") : "Only the assigned intern can update this task"}
        >
          {isDone(task) ? <CheckCircle2 size={compact ? 16 : 18} /> : <Circle size={compact ? 16 : 18} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`flex flex-wrap items-center ${compact ? "gap-1" : "gap-1.5"}`}>
            <span className={`rounded-md border border-blue-200/80 bg-blue-50 py-0.5 font-black uppercase tracking-wider text-[#075fae] ${compact ? "px-1.5 text-[8px]" : "px-2 text-[9px]"}`}>
              Seq #{task.sequence_id || 1}
            </span>
            <span className={`rounded-full py-0.5 font-black uppercase tracking-wide ring-1 ${compact ? "px-2 text-[8px]" : "px-2.5 text-[9px]"} ${priorityTone(task.priority)}`}>
              <Flag className="mr-1 inline" size={compact ? 9 : 10} />{task.priority || "No priority"}
            </span>
            {overdue && <span className={`rounded-full bg-rose-600 py-0.5 font-black uppercase tracking-wide text-white ${compact ? "px-2 text-[8px]" : "px-2.5 text-[9px]"}`}>Overdue</span>}
            {isIntern && !canUpdateTask && <span className={`rounded-full bg-slate-100 py-0.5 font-black uppercase tracking-wide text-slate-500 ring-1 ring-slate-200 ${compact ? "px-2 text-[8px]" : "px-2.5 text-[9px]"}`}>Read only</span>}
          </div>
          <h3 className={`break-words font-black text-[#10233f] [overflow-wrap:anywhere] ${compact ? "mt-2 text-sm leading-5" : "mt-2.5 text-base leading-snug"}`}>{task.task_title}</h3>
        </div>
      </div>
      <p className={`line-clamp-2 flex-1 text-slate-500 ${compact ? "mt-2.5 text-xs leading-5" : "mt-3 text-sm leading-6"}`}>{task.description || "No task description has been added."}</p>
      <div className={`border-t border-slate-100 ${compact ? "mt-3 space-y-2 pt-3 text-[11px]" : "mt-5 space-y-2.5 pt-4 text-xs"}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <UserRound size={compact ? 13 : 14} className="shrink-0 text-[#075fae]" />
          <span className="truncate"><span className="font-semibold">Assignee:</span> {task.assigned_user_name || "No direct assignee"}</span>
        </div>
        <div className={`flex items-center gap-2 ${overdue ? "font-bold text-rose-600" : "text-slate-500"}`}>
          <CalendarClock className="shrink-0" size={compact ? 13 : 14} /><span>{formatDate(task.due_date)}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <Clock3 size={compact ? 13 : 14} className="shrink-0 text-[#20a91e]" />
          {canUpdateTask ? (
            <select
              className="min-w-0 max-w-full bg-transparent font-semibold capitalize text-slate-700 outline-none hover:text-[#075fae]"
              value={taskStatusValue(task)}
              onChange={(e) => onStatusChange && onStatusChange(task, e.target.value)}
              aria-label="Change status"
            >
              <option value="To do">To do</option>
              <option value="In progress">In progress</option>
              <option value="Completed">Completed</option>
            </select>
          ) : (
            <span className="font-semibold text-slate-600">{taskStatusValue(task)}</span>
          )}
        </div>
      </div>
      {task.progress_note && <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">{task.progress_note}</div>}
      {task.completion_evidence_link && <a className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#075fae] hover:underline" href={task.completion_evidence_link} target="_blank" rel="noreferrer">View evidence <ExternalLink size={13} /></a>}
      {isIntern && canUpdateTask && <SubmissionForm task={task} onSubmitted={onSubmitted} />}
    </article>
  );
}

function TaskLaneHeader({ title, accent, count }) {
  return (
    <div className="flex items-center justify-between rounded-[22px] bg-slate-100/80 px-5 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        <h3 className="text-sm font-black text-[#10233f]">{title}</h3>
      </div>
      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">{count}</span>
    </div>
  );
}

function SequenceCell({ title, accent, tasks, currentUser, onStatusChange, onSubmitted }) {
  const compact = tasks.length > 2;
  return (
    <div className="min-h-24 rounded-[24px] bg-slate-100/70 p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2 px-1 xl:hidden">
        <span className={`h-2 w-2 rounded-full ${accent}`} />
        <span className="text-xs font-black text-[#10233f]">{title}</span>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500">{tasks.length}</span>
      </div>
      <div className={compact ? "grid grid-cols-2 items-start gap-3" : "space-y-3"}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            compact={compact}
            currentUser={currentUser}
            onStatusChange={onStatusChange}
            onSubmitted={onSubmitted}
          />
        ))}
      </div>
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const canCreate = canCreateTasks(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlProjectId = searchParams.get("projectId") || searchParams.get("project");
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId && urlProjectId !== "all" ? urlProjectId : "");

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("all");
  const [sequenceOrder, setSequenceOrder] = useState("asc");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState({ projects: [], assignees: [], interns: [], pods: [] });

  useEffect(() => {
    if (urlProjectId && urlProjectId !== "all") {
      setSelectedProjectId(urlProjectId);
    }
  }, [urlProjectId]);

  function handleSelectProject(projId) {
    setSelectedProjectId(projId);
    const next = new URLSearchParams(searchParams);
    if (projId) {
      next.set("projectId", projId);
    } else {
      next.delete("projectId");
      next.delete("project");
    }
    setSearchParams(next);
  }

  async function load() {
    setLoading(true); setError("");
    try {
      const requests = [listTasks(), listProjects()];
      if (canCreate) requests.push(getTaskOptions());
      const [taskData, projectData, optionData] = await Promise.all(requests);
      setTasks(taskData); setProjects(projectData);
      setSelectedProjectId((current) => {
        const requested = current && current !== "all" ? current : urlProjectId;
        if (requested && requested !== "all" && projectData.some((project) => String(project.id) === String(requested))) return String(requested);
        return projectData.length ? String(projectData[0].id) : "";
      });
      if (optionData) setOptions(optionData);
    }
    catch (requestError) { setError(requestError.message || "Unable to load tasks."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [canCreate]);
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project.project_name])), [projects]);
  const priorities = useMemo(() => [...new Set(tasks.map((task) => task.priority).filter(Boolean))], [tasks]);

  const currentProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => String(p.id) === String(selectedProjectId));
  }, [projects, selectedProjectId]);

  const scopedTasks = useMemo(() => {
    if (!selectedProjectId) return [];
    return tasks.filter((t) => String(t.project_id) === String(selectedProjectId));
  }, [tasks, selectedProjectId]);

  const visible = useMemo(() => scopedTasks.filter((task) => {
    const haystack = [task.task_title, task.description, task.status, projectsById.get(task.project_id)].join(" ").toLowerCase();
    return (priority === "all" || normalized(task.priority) === normalized(priority)) && haystack.includes(query.trim().toLowerCase());
  }), [scopedTasks, priority, query, projectsById]);

  const todo = visible.filter((task) => !isDone(task) && !DOING.has(normalized(task.status)));
  const doing = visible.filter((task) => DOING.has(normalized(task.status)));
  const done = visible.filter(isDone);
  const sequenceRows = useMemo(() => {
    const rows = new Map();
    visible.forEach((task) => {
      const parsedSequence = Number(task.sequence_id);
      const sequence = Number.isFinite(parsedSequence) && parsedSequence > 0 ? parsedSequence : 1;
      if (!rows.has(sequence)) rows.set(sequence, { todo: [], doing: [], done: [] });
      const lane = isDone(task) ? "done" : DOING.has(normalized(task.status)) ? "doing" : "todo";
      rows.get(sequence)[lane].push(task);
    });
    return [...rows.entries()]
      .sort(([first], [second]) => sequenceOrder === "asc" ? first - second : second - first)
      .map(([sequence, lanes]) => ({
        sequence,
        ...Object.fromEntries(Object.entries(lanes).map(([lane, laneTasks]) => [lane, laneTasks.sort((a, b) => Number(a.id) - Number(b.id))])),
      }));
  }, [visible, sequenceOrder]);
  const overdue = scopedTasks.filter(isOverdue).length;
  const dueSoon = scopedTasks.filter((task) => { if (!task.due_date || isDone(task)) return false; const days = (new Date(`${task.due_date}T23:59:59`) - new Date()) / 86400000; return days >= 0 && days <= 7; }).length;
  const highPriority = scopedTasks.filter((task) => ["urgent", "critical", "high"].includes(normalized(task.priority)) && !isDone(task)).length;

  function replaceTask(updated) { setTasks((current) => current.map((task) => task.id === updated.id ? updated : task)); }

  async function handleStatusChange(task, nextStatus) {
    try {
      const updated = await updateTask(task.id, { status: nextStatus });
      replaceTask(updated);
      listProjects().then(setProjects).catch(() => {});
    } catch (err) {
      setError(err.message || "Unable to update task status.");
    }
  }

  async function saveTask(payload) {
    setSaving(true); setError(""); setSuccess("");
    try {
      const created = await createTask(payload);
      setFormOpen(false);
      await load();
      setSuccess(`Task “${created.task_title}” created successfully.`);
    } catch (requestError) {
      setError(requestError.message || "Unable to create the task.");
    } finally {
      setSaving(false);
    }
  }

  const currentProjectTasks = useMemo(() => {
    if (!currentProject) return [];
    return tasks.filter((t) => String(t.project_id) === String(currentProject.id));
  }, [tasks, currentProject]);

  const projectTotal = currentProjectTasks.length;
  const projectDone = currentProjectTasks.filter(isDone).length;
  const projectProgress = projectTotal > 0
    ? Math.round((projectDone / projectTotal) * 100)
    : Math.round(Number(currentProject?.progress_percentage) || 0);

  const roleMessage = user?.role === "management" ? "See execution pressure across the lab and spot work that needs intervention." : user?.role === "employee" ? "Turn project commitments into a clear, prioritized delivery queue." : "Focus on assigned work, evidence, and supervisor feedback.";

  return <div className="space-y-6">
    <section className="subpage-hero"><div className="relative z-10 max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full bg-[#edfbed] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.15em] text-[#168f18]"><Sparkles size={13} /> {user?.role} execution desk</div><h2 className="mt-4 text-4xl font-black tracking-[-.045em] text-[#10233f] sm:text-5xl">Work, clearly in motion.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-slate-500">{roleMessage}</p>{canCreate && <button className="primary-button mt-6" onClick={() => setFormOpen(true)}><Plus size={17} /> Add Task</button>}</div><div className="subpage-ring" /></section>

    {currentProject && (
      <section className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50/70 via-indigo-50/20 to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#075fae] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                Project Task Section
              </span>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                {currentProject.project_category || "General"}
              </span>
              {currentProject.current_status && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ring-1 ${projectTone(currentProject.current_status)}`}>
                  {currentProject.current_status}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-black text-[#10233f] sm:text-3xl">
              {currentProject.project_name}
            </h2>
            {currentProject.project_description && (
              <p className="mt-1 line-clamp-2 max-w-2xl text-xs leading-5 text-slate-500">
                {currentProject.project_description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600">
              <span>{projectTotal} task{projectTotal === 1 ? "" : "s"} in this project</span>
              <span>·</span>
              <span className="text-[#20a91e]">{projectDone} completed</span>
              <span>·</span>
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-36 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#20b51d] to-[#0871c6] transition-all duration-300"
                    style={{ width: `${projectProgress}%` }}
                  />
                </div>
                <b className="text-sm text-[#075fae]">{projectProgress}% project progress</b>
              </div>
            </div>

            {currentProject.current_running_stage && (
              <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200/80 bg-white/90 px-3.5 py-2 text-xs">
                <span className="rounded-md bg-[#075fae] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                  Current Stage #{currentProject.current_running_stage.sequence_id}
                </span>
                <span className="font-extrabold text-[#10233f]">
                  {currentProject.current_running_stage.tasks.length === 1
                    ? currentProject.current_running_stage.tasks[0].task_title
                    : `${currentProject.current_running_stage.tasks.length} sub-tasks in flight`}
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-slate-500">
                  {currentProject.current_running_stage.status_summary}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canCreate && (
              <button
                type="button"
                className="primary-button"
                onClick={() => setFormOpen(true)}
              >
                <Plus size={17} />
                <span>Add Task</span>
              </button>
            )}
          </div>
        </div>
      </section>
    )}

    {canCreate && formOpen && (
      <TaskModal
        options={options}
        currentProjectId={currentProject ? currentProject.id : null}
        projects={projects}
        tasks={tasks}
        submitting={saving}
        onSubmit={saveTask}
        onClose={() => setFormOpen(false)}
      />
    )}

    {success && <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700" role="status"><span>{success}</span><button onClick={() => setSuccess("")} aria-label="Dismiss success message"><X size={16} /></button></div>}

    <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <Metric icon={LayoutList} label={currentProject ? "Project tasks" : "Total work"} value={scopedTasks.length} detail={currentProject ? "In selected project" : "Tasks in current scope"} />
      <Metric icon={AlertCircle} label="Overdue" value={overdue} detail="Open tasks past due" tone="rose" />
      <Metric icon={CalendarClock} label="Due this week" value={dueSoon} detail="Next seven days" tone="amber" />
      <Metric icon={CheckCircle2} label="Completed" value={scopedTasks.filter(isDone).length} detail={`${highPriority} high-priority open`} tone="green" />
    </section>

    <section className="content-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow text-[#0871c6]">Delivery board</p>
          <h3 className="section-title">
            Task flow <span className="ml-2 text-sm text-slate-400">{visible.length}</span>
          </h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-400 focus-within:border-blue-300 focus-within:bg-white">
            <Search size={16} />
            <input className="w-full bg-transparent text-sm text-slate-700 outline-none sm:w-48" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks" />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600">
            <FolderKanban size={16} />
            <select
              className="bg-transparent outline-none max-w-44 truncate"
              value={selectedProjectId}
              onChange={(event) => handleSelectProject(event.target.value)}
              aria-label="Filter by project"
            >
              {projects.map((item) => {
                const count = tasks.filter((t) => t.project_id === item.id).length;
                return (
                  <option key={item.id} value={item.id}>
                    {item.project_name} ({count})
                  </option>
                );
              })}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600">
            <SlidersHorizontal size={16} />
            <select className="bg-transparent outline-none" value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter by priority">
              <option value="all">All priorities</option>
              {priorities.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600">
            <ArrowUpDown size={16} />
            <select className="bg-transparent outline-none" value={sequenceOrder} onChange={(event) => setSequenceOrder(event.target.value)} aria-label="Sort sequences">
              <option value="asc">Sequence: Ascending</option>
              <option value="desc">Sequence: Descending</option>
            </select>
          </label>
          <button className="icon-button" onClick={load} aria-label="Refresh tasks"><RefreshCw size={17} /></button>
        </div>
      </div>

      {error && <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm font-semibold text-slate-400">
          <LoaderCircle className="animate-spin" size={19} /> Loading delivery board...
        </div>
      ) : (
        <div className="mt-6">
          {sequenceRows.length ? (
            <div className="space-y-4">
              <div className="hidden gap-4 xl:grid xl:grid-cols-3">
                <TaskLaneHeader title="To do" accent="bg-slate-400" count={todo.length} />
                <TaskLaneHeader title="In progress" accent="bg-[#0871c6]" count={doing.length} />
                <TaskLaneHeader title="Done" accent="bg-[#20b51d]" count={done.length} />
              </div>
              {sequenceRows.map((row) => (
                <section key={row.sequence} className="rounded-[28px] border border-slate-200/80 bg-white/60 p-2 sm:p-3">
                  <div className="mb-2 flex items-center gap-3 px-2">
                    <span className="rounded-full bg-[#10233f] px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white">
                      Sequence {row.sequence}
                    </span>
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="grid items-stretch gap-3 xl:grid-cols-3">
                    <SequenceCell title="To do" accent="bg-slate-400" tasks={row.todo} currentUser={user} onStatusChange={handleStatusChange} onSubmitted={replaceTask} />
                    <SequenceCell title="In progress" accent="bg-[#0871c6]" tasks={row.doing} currentUser={user} onStatusChange={handleStatusChange} onSubmitted={replaceTask} />
                    <SequenceCell title="Done" accent="bg-[#20b51d]" tasks={row.done} currentUser={user} onStatusChange={handleStatusChange} onSubmitted={replaceTask} />
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-16 text-center text-sm font-semibold text-slate-400">
              No tasks match the current filters.
            </div>
          )}
        </div>
      )}
    </section>
  </div>;
}
