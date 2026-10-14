import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, LoaderCircle, MapPin, Pencil, Plus, Trash2, Users, X } from "lucide-react";

import { createMeeting, deleteMeeting, getMeetingOptions, listMeetings, updateMeeting } from "../api/meetingApi";
import { useAuth } from "../context/AuthContext";
import { canManageOperations } from "../utils/rolePermissions";
import SmoothReveal from "../components/SmoothReveal";

const meetingTypes = ["Team sync", "Project review", "One-on-one", "Client meeting", "Workshop", "Other"];
const meetingStatuses = ["Scheduled", "In progress", "Completed", "Cancelled"];
const emptyForm = {
	meeting_title: "",
	meeting_type: "Team sync",
	start_datetime: "",
	end_datetime: "",
	meeting_room_id: "",
	status: "Scheduled",
	meeting_minutes: "",
	attendee_user_ids: [],
	project_ids: [],
};

function formFromMeeting(meeting) {
	return {
		...meeting,
		start_datetime: meeting.start_datetime?.slice(0, 16) || "",
		end_datetime: meeting.end_datetime?.slice(0, 16) || "",
		meeting_room_id: meeting.meeting_room_id || "",
		attendee_user_ids: meeting.attendee_user_ids || [],
		project_ids: meeting.project_ids || [],
		meeting_minutes: meeting.meeting_minutes || "",
	};
}

function AttendeeDropdown({ title, attendees, selectedIds, onChange }) {
	const selected = attendees.filter((attendee) => selectedIds.includes(attendee.id));
	return <details className="group relative"><summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-[#0871c6] hover:bg-white [&::-webkit-details-marker]:hidden"><div className="min-w-0 flex-1"><span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{title}</span><span className="mt-1 block truncate text-sm font-semibold text-slate-700">{selected.length ? selected.map((attendee) => attendee.name).join(", ") : `Choose ${title.toLowerCase()}`}</span></div><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-400 shadow-sm transition group-open:rotate-180"><ChevronDown size={16} /></span></summary><div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">{attendees.length ? attendees.map((attendee) => <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-blue-50" key={attendee.id}><input className="h-4 w-4 accent-[#0871c6]" type="checkbox" checked={selectedIds.includes(attendee.id)} onChange={() => onChange(attendee.id)} /><span className="min-w-0"><span className="block truncate font-semibold">{attendee.name}</span><span className="block truncate text-xs text-slate-400">{attendee.email}</span></span></label>) : <p className="px-3 py-2 text-sm text-slate-400">No {title.toLowerCase()} available.</p>}</div></details>;
}

function MeetingForm({ initialValues, meetings, options, submitting, onSubmit, onClose }) {
	const [form, setForm] = useState(initialValues);
	const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
	const toggle = (field, id) => setForm((current) => ({ ...current, [field]: current[field].includes(id) ? current[field].filter((value) => value !== id) : [...current[field], id] }));
	const employeeAttendees = options.attendees.filter((attendee) => attendee.role === "employee");
	const internAttendees = options.attendees.filter((attendee) => attendee.role === "intern");
	const roomIsBooked = (roomId) => Boolean(form.start_datetime && form.end_datetime && meetings.some((meeting) => meeting.id !== initialValues.id && meeting.meeting_room_id === roomId && meeting.status !== "Cancelled" && new Date(meeting.start_datetime) < new Date(form.end_datetime) && new Date(meeting.end_datetime) > new Date(form.start_datetime)));

	return (
		<form className="content-card space-y-5" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, meeting_room_id: form.meeting_room_id ? Number(form.meeting_room_id) : null, attendee_user_ids: form.attendee_user_ids.map(Number), project_ids: form.project_ids.map(Number) }); }}>
			<div className="flex items-center justify-between"><div><p className="eyebrow text-[#0871c6]">Calendar workspace</p><h3 className="section-title">{initialValues.id ? "Edit meeting" : "Create meeting"}</h3></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close form"><X size={18} /></button></div>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="field-label sm:col-span-2">Meeting title<input className="field-input" value={form.meeting_title} onChange={update("meeting_title")} required /></label>
				<label className="field-label">Meeting type<select className="field-input" value={form.meeting_type} onChange={update("meeting_type")}>{meetingTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
				<label className="field-label">Status<select className="field-input" value={form.status} onChange={update("status")}>{meetingStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
				<label className="field-label">Start<input className="field-input" type="datetime-local" value={form.start_datetime} onChange={update("start_datetime")} required /></label>
				<label className="field-label">End<input className="field-input" type="datetime-local" value={form.end_datetime} onChange={update("end_datetime")} required /></label>
				<label className="field-label sm:col-span-2">Meeting room<select className="field-input" value={form.meeting_room_id} onChange={update("meeting_room_id")}><option value="">No room selected</option>{options.rooms.map((room) => { const booked = roomIsBooked(room.id); return <option key={room.id} value={room.id} disabled={booked}>{room.room_name}{room.location ? ` - ${room.location}` : ""}{booked ? " - Booked" : ""}</option>; })}</select>{form.start_datetime && form.end_datetime && <span className="mt-1 block text-xs font-semibold text-slate-400">Rooms booked during this time are unavailable.</span>}</label>
			</div>
			<div className="grid gap-5 lg:grid-cols-2">
				<fieldset><legend className="field-label">Attendees</legend><div className="mt-2 space-y-3">{options.attendees.length ? <><AttendeeDropdown title="Employees" attendees={employeeAttendees} selectedIds={form.attendee_user_ids} onChange={(id) => toggle("attendee_user_ids", id)} /><AttendeeDropdown title="Interns" attendees={internAttendees} selectedIds={form.attendee_user_ids} onChange={(id) => toggle("attendee_user_ids", id)} /></> : <p className="text-sm text-slate-400">No attendees available.</p>}</div></fieldset>
				<fieldset><legend className="field-label">Selected projects</legend><div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{options.projects.length ? options.projects.map((project) => <label className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50" key={project.id}><input type="checkbox" checked={form.project_ids.includes(project.id)} onChange={() => toggle("project_ids", project.id)} /><span>{project.project_name}</span></label>) : <p className="text-sm text-slate-400">No projects available.</p>}</div></fieldset>
			</div>
			<label className="field-label">Meeting minutes<textarea className="field-input min-h-24 resize-y" value={form.meeting_minutes} onChange={update("meeting_minutes")} placeholder="Add notes or decisions after the meeting" /></label>
			<button className="primary-button w-full justify-center" disabled={submitting}>{submitting ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />} {submitting ? "Saving..." : "Save meeting"}</button>
		</form>
	);
}

function MeetingCard({ meeting, options, canManage, onEdit, onDelete }) {
	const projectNames = meeting.project_ids.map((id) => options.projects.find((item) => item.id === id)?.project_name).filter(Boolean);
	return <article className="rounded-2xl border border-slate-100 bg-white p-5 transition hover:border-blue-100"><div className="flex flex-wrap items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e5f3ff] text-[#0769ba]"><CalendarDays size={19} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-extrabold text-slate-800">{meeting.meeting_title}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-slate-600">{meeting.status}</span></div><p className="mt-1 text-xs text-slate-400">{meeting.meeting_type || "Meeting"}{meeting.meeting_room_id ? ` · ${options.rooms.find((room) => room.id === meeting.meeting_room_id)?.room_name || "Room selected"}` : ""}</p></div>{canManage && <div className="flex gap-2"><button className="icon-button" onClick={() => onEdit(meeting)} aria-label="Edit meeting"><Pencil size={16} /></button><button className="icon-button hover:border-red-200 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(meeting)} aria-label="Delete meeting"><Trash2 size={16} /></button></div>}</div><div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:grid-cols-3"><span className="flex items-center gap-2"><Clock3 size={14} />{new Date(meeting.start_datetime).toLocaleString()}</span><span className="flex items-center gap-2"><Users size={14} />{meeting.accepted_attendee_count || 0} accepted attendees</span><span>{projectNames.length ? `Projects: ${projectNames.join(", ")}` : "No projects selected"}</span></div></article>;
}

export default function Meetings() {
	const { user } = useAuth();
	const canManage = canManageOperations(user?.role);
	const [meetings, setMeetings] = useState([]);
	const [options, setOptions] = useState({ attendees: [], projects: [], rooms: [] });
	const [form, setForm] = useState(null);
	const [calendarDate, setCalendarDate] = useState(new Date());
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	async function loadData() {
		setLoading(true); setError("");
		try { const [meetingData, optionData] = await Promise.all([listMeetings(), getMeetingOptions()]); setMeetings(meetingData); setOptions(optionData); }
		catch (requestError) { setError(requestError.message); }
		finally { setLoading(false); }
	}

	useEffect(() => { loadData(); }, []);

	async function saveMeeting(payload) {
		setSubmitting(true); setError("");
		try { if (form.id) await updateMeeting(form.id, payload); else await createMeeting(payload); setForm(null); await loadData(); }
		catch (requestError) { setError(requestError.message); }
		finally { setSubmitting(false); }
	}

	async function removeMeeting(meeting) {
		if (!window.confirm(`Delete ${meeting.meeting_title}?`)) return;
		try { await deleteMeeting(meeting.id); await loadData(); } catch (requestError) { setError(requestError.message); }
	}

	return <div className="space-y-7"><section className="subpage-hero"><div className="relative z-10 max-w-xl"><p className="eyebrow text-[#199d1c]">Calendar workspace</p><h2 className="mt-2 text-4xl font-black tracking-[-0.04em] text-[#10233f]">Meetings</h2><p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">Coordinate attendees, projects, rooms and follow-up in one place.</p>{canManage && <button className="primary-button mt-6" onClick={() => setForm({ ...emptyForm })}><Plus size={17} /> Create meeting</button>}</div><div className="subpage-ring" /></section>{canManage && form && <SmoothReveal revealKey={form.id || "new-meeting"}><MeetingForm initialValues={form} meetings={meetings} options={options} submitting={submitting} onSubmit={saveMeeting} onClose={() => setForm(null)} /></SmoothReveal>}{error && <div className="flex items-center justify-between rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}<section className="content-card"><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow text-[#0871c6]">Live data</p><h3 className="section-title">All meetings <span className="ml-2 text-sm font-bold text-slate-400">{meetings.length}</span></h3></div></div>{loading ? <div className="flex items-center justify-center gap-2 py-14 text-sm font-semibold text-slate-400"><LoaderCircle className="animate-spin" size={18} /> Loading meetings...</div> : meetings.length ? <div className="space-y-3">{meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} options={options} canManage={canManage} onEdit={(item) => setForm(formFromMeeting(item))} onDelete={removeMeeting} />)}</div> : <div className="py-14 text-center"><CalendarDays className="mx-auto text-slate-300" size={36} /><p className="mt-3 text-sm font-extrabold text-slate-600">No meetings yet</p><p className="mt-1 text-sm text-slate-400">Create the first meeting to coordinate your workspace.</p></div>}</section></div>;
}
