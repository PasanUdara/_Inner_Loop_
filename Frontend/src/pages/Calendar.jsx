import { useEffect, useMemo, useRef, useState } from "react";

import { createPortal } from "react-dom";

import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, LoaderCircle, MoreVertical, Plus, Users, X } from "lucide-react";



import { createMeeting, getMeetingOptions, listMeetings, updateMeeting, updateMeetingAttendance } from "../api/meetingApi";

import { useAuth } from "../context/AuthContext";

import { canManageOperations } from "../utils/rolePermissions";


//event
const eventColors = [

  { label: "My Events", key: "my", dot: "#075fae", bg: "#e8f4ff", text: "#07518f" },

  { label: "Project Meetings", key: "project", dot: "#0871c6", bg: "#d8ecff", text: "#075fae" },

  { label: "Team Meetings", key: "team", dot: "#123e68", bg: "#dce8f3", text: "#123e68" },

  { label: "Deadlines", key: "deadline", dot: "#53a9e2", bg: "#edf7ff", text: "#176b9f" },

];



const emptyEvent = { meeting_title: "", meeting_type: "Team sync", start_datetime: "", end_datetime: "", status: "Scheduled", attendee_user_ids: [], project_ids: [] };



function dateKey(date) {

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

}



function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }

function formatTime(value) { return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }



function eventKind(meeting) {

  const type = `${meeting.meeting_type || ""} ${meeting.meeting_title || ""}`.toLowerCase();

  if (type.includes("deadline")) return "deadline";

  if (type.includes("project") || meeting.project_ids?.length) return "project";

  if (type.includes("team") || type.includes("sync")) return "team";

  return "my";

}



function colorFor(meeting) { return eventColors.find((item) => item.key === eventKind(meeting)) || eventColors[0]; }



function CalendarEvent({ meeting, compact = false, showCompactTime = false, onSelect, onEdit, onAttendance, attendanceSubmitting, className = "", style: eventStyle }) {

  const color = colorFor(meeting);

  const [hoverPosition, setHoverPosition] = useState(null);

  const hideTimerRef = useRef(null);



  const keepHoverCardOpen = () => {

    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);

  };



  const hideHoverCard = () => {

    keepHoverCardOpen();

    hideTimerRef.current = window.setTimeout(() => setHoverPosition(null), 180);

  };



  useEffect(() => () => {

    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);

  }, []);



  const showHoverCard = (event) => {

    keepHoverCardOpen();

    const rect = event.currentTarget.getBoundingClientRect();

    const cardWidth = 252;

    const placeLeft = rect.right + cardWidth + 20 > window.innerWidth;

    setHoverPosition({

      top: Math.max(12, Math.min(rect.top, window.innerHeight - (onAttendance ? 250 : 190))),

      left: placeLeft ? Math.max(12, rect.left - cardWidth - 10) : rect.right + 10,

    });

  };



  return (

    <div className={`calendar-event-shell ${className}`} style={eventStyle}>

      <button

        type="button"

        onClick={(event) => { event.stopPropagation(); onSelect(meeting); }}

        onDoubleClick={(event) => { event.stopPropagation(); onEdit?.(meeting); }}

        onMouseEnter={showHoverCard}

        onMouseLeave={hideHoverCard}

        onFocus={showHoverCard}

        onBlur={hideHoverCard}

        className={`calendar-event ${compact ? "calendar-event-compact" : ""}`}

        style={{ backgroundColor: color.bg, color: color.text }}

        aria-label={`${meeting.meeting_title}, ${formatTime(meeting.start_datetime)} to ${formatTime(meeting.end_datetime)}${onEdit ? ". Double-click to edit." : "."}`}

      >

        <span className="calendar-event-title">

          {compact && showCompactTime && <b className="calendar-event-compact-time">{formatTime(meeting.start_datetime)}</b>}

          {compact && showCompactTime && <span aria-hidden="true"> · </span>}

          {meeting.meeting_title}

        </span>

        {!compact && (

          <span className="calendar-event-time">

            <i style={{ backgroundColor: color.dot }} />

            {formatTime(meeting.start_datetime)} - {formatTime(meeting.end_datetime)}

          </span>

        )}

      </button>

      {hoverPosition && createPortal(

        <aside className="calendar-event-popover" style={hoverPosition} aria-live="polite" onMouseEnter={keepHoverCardOpen} onMouseLeave={hideHoverCard} onFocus={keepHoverCardOpen} onBlur={hideHoverCard}>

          <span className="calendar-event-popover-label">Meeting details</span>

          <strong>{meeting.meeting_title}</strong>

          <span><Clock3 size={13} /> {formatTime(meeting.start_datetime)} – {formatTime(meeting.end_datetime)}</span>

          <span><CalendarDays size={13} /> {new Date(meeting.start_datetime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>

          <span><Users size={13} /> {meeting.accepted_attendee_count || 0} accepted attendees</span>

          <em>{meeting.meeting_type || "Meeting"} · {meeting.status || "Scheduled"}</em>

          {onAttendance && (

            <div className="calendar-event-popover-actions">

              <button type="button" className={meeting.current_user_attendance_status === "Accepted" ? "accepted" : ""} onClick={(event) => { event.stopPropagation(); onAttendance(meeting, "Accepted"); }} disabled={Boolean(attendanceSubmitting)} aria-label={`Accept ${meeting.meeting_title}`}>

                {attendanceSubmitting === "Accepted" ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />} Accept

              </button>

              <button type="button" className={meeting.current_user_attendance_status === "Declined" ? "declined" : ""} onClick={(event) => { event.stopPropagation(); onAttendance(meeting, "Declined"); }} disabled={Boolean(attendanceSubmitting)} aria-label={`Decline ${meeting.meeting_title}`}>

                {attendanceSubmitting === "Declined" ? <LoaderCircle className="animate-spin" size={14} /> : <X size={14} />} Decline

              </button>

            </div>

          )}

          {onEdit && <small>Double-click to edit this meeting</small>}

        </aside>,

        document.body,

      )}

    </div>

  );

}



function EventForm({ initialValues, interns, submitting, onSubmit, onClose }) {

  const [form, setForm] = useState(initialValues || emptyEvent);

  const isEditing = Boolean(initialValues?.id);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const toggleIntern = (internId) => setForm((current) => {

    const attendeeIds = current.attendee_user_ids || [];

    return {

      ...current,

      attendee_user_ids: attendeeIds.includes(internId)

        ? attendeeIds.filter((id) => id !== internId)

        : [...attendeeIds, internId],

    };

  });

  const selectedInterns = interns.filter((intern) => (form.attendee_user_ids || []).includes(intern.id));

  return (

    <form className="content-card calendar-event-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>

      <div className="flex items-center justify-between">

        <div>

          <p className="eyebrow text-[#0871c6]">Calendar workspace</p>

          <h2 className="section-title">{isEditing ? "Update meeting details" : "Create event"}</h2>

        </div>

        <button type="button" className="icon-button" onClick={onClose} aria-label="Close create event form">

          <X size={18} />

        </button>

      </div>

      <div className="grid gap-4 sm:grid-cols-2">

        <label className="field-label sm:col-span-2">

          Event title

          <input className="field-input" value={form.meeting_title} onChange={update("meeting_title")} placeholder="e.g. Project discussion" required />

        </label>

        <label className="field-label">

          Event type

          <select className="field-input" value={form.meeting_type} onChange={update("meeting_type")}>

            <option>Team sync</option>

            <option>Project review</option>

            <option>One-on-one</option>

            <option>Client meeting</option>

            <option>Deadline</option>

            <option>Workshop</option>

          </select>

        </label>

        <label className="field-label">

          Status

          <select className="field-input" value={form.status} onChange={update("status")}>

            <option>Scheduled</option>

            <option>Completed</option>

            <option>Cancelled</option>

          </select>

        </label>

        <label className="field-label">

          Starts

          <input className="field-input" type="datetime-local" step="900" value={form.start_datetime} onChange={update("start_datetime")} required />

        </label>

        <label className="field-label">

          Ends

          <input className="field-input" type="datetime-local" step="900" value={form.end_datetime} onChange={update("end_datetime")} required />

        </label>

        <fieldset className="sm:col-span-2">

          <legend className="field-label">Add interns</legend>

          <details className="group relative mt-2">

            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-[#0871c6] hover:bg-white [&::-webkit-details-marker]:hidden">

              <Users size={17} className="shrink-0 text-[#0871c6]" />

              <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-700">

                {selectedInterns.length ? selectedInterns.map((intern) => intern.name).join(", ") : "Choose interns"}

              </span>

              <ChevronDown size={16} className="shrink-0 text-slate-400 transition group-open:rotate-180" />

            </summary>

            <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">

              {interns.length ? interns.map((intern) => (

                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-blue-50" key={intern.id}>

                  <input className="h-4 w-4 accent-[#0871c6]" type="checkbox" checked={(form.attendee_user_ids || []).includes(intern.id)} onChange={() => toggleIntern(intern.id)} />

                  <span className="min-w-0">

                    <span className="block truncate font-semibold">{intern.name}</span>

                    <span className="block truncate text-xs text-slate-400">{intern.email}</span>

                  </span>

                </label>

              )) : <p className="px-3 py-2 text-sm text-slate-400">No interns available.</p>}

            </div>

          </details>

        </fieldset>

      </div>

      <button className="primary-button w-full justify-center" disabled={submitting}>

        {submitting ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />}

        {submitting ? "Saving..." : isEditing ? "Update meeting" : "Create event"}

      </button>

    </form>

  );

}



function formatHour(hour, minutes) {

  const date = new Date(2020, 0, 1, hour, minutes);

  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

}

const WORKDAY_START_MINUTES = 8 * 60;

const WORKDAY_END_MINUTES = 18 * 60;

const SLOT_MINUTES = 15;

function layoutDayEvents(events, rowHeight) {

  const sorted = [...events].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

  const rendered = [];



  for (const event of sorted) {

    const start = new Date(event.start_datetime);

    const end = new Date(event.end_datetime);

    const startMin = start.getHours() * 60 + start.getMinutes();

    const endClock = end.getHours() * 60 + end.getMinutes();
    const rawEndMin = Math.max(endClock + (dateKey(end) !== dateKey(start) ? 1440 : 0), startMin + SLOT_MINUTES);

    if (rawEndMin <= WORKDAY_START_MINUTES || startMin >= WORKDAY_END_MINUTES) continue;

    const visibleStartMin = Math.max(startMin, WORKDAY_START_MINUTES);

    const endMin = Math.min(rawEndMin, WORKDAY_END_MINUTES);

    const duration = Math.max(endMin - visibleStartMin, SLOT_MINUTES);



    const top = ((visibleStartMin - WORKDAY_START_MINUTES) / SLOT_MINUTES) * rowHeight;

    const height = Math.max((duration / SLOT_MINUTES) * rowHeight - 2, 22);



    rendered.push({

      event,

      startMin: visibleStartMin,

      endMin,

      top,

      height,

    });

  }



  return rendered.map((item, _, arr) => {

    const overlapping = arr.filter((other) => other.startMin < item.endMin && other.endMin > item.startMin);

    const colIndex = overlapping.indexOf(item);

    const totalCols = Math.max(1, overlapping.length);

    const widthPct = 100 / totalCols;

    const leftPct = colIndex * widthPct;



    return {

      ...item,

      style: {

        top: `${item.top}px`,

        height: `${item.height}px`,

        left: `calc(${leftPct}% + 2px)`,

        width: `calc(${widthPct}% - 4px)`,

      },

    };

  });

}



function TimeGrid({ date, view, meetings, onSelect, onEdit, onAttendance, attendanceSubmitting, onSelectDate, onCreateEvent }) {

  const rowHeight = 28;

  const totalSlots = (WORKDAY_END_MINUTES - WORKDAY_START_MINUTES) / SLOT_MINUTES;
  const gridHeight = totalSlots * rowHeight;



  const rows = useMemo(() => Array.from({ length: totalSlots }, (_, index) => ({

    hour: Math.floor((WORKDAY_START_MINUTES + index * SLOT_MINUTES) / 60),

    minutes: (WORKDAY_START_MINUTES + index * SLOT_MINUTES) % 60,

    index,

  })), [totalSlots]);



  const dates = useMemo(() => {

    if (view === "day") return [new Date(date)];

    const start = new Date(date);

    start.setDate(date.getDate() - date.getDay());

    return Array.from({ length: 7 }, (_, index) => {

      const d = new Date(start);

      d.setDate(start.getDate() + index);

      return d;

    });

  }, [date, view]);



  const now = new Date();



  return (

    <div className="time-grid-container">

      {/* Header with day columns */}

      <div className="time-grid-header">

        <div className="time-grid-gutter"><span>Time</span></div>

        <div className="time-grid-days">

          {dates.map((day) => {

            const isToday = dateKey(day) === dateKey(now);

            const isSelected = dateKey(day) === dateKey(date);

            return (

              <button

                type="button"

                key={dateKey(day)}

                className={`time-grid-day-header ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}

                onClick={() => onSelectDate && onSelectDate(day)}

              >

                <span className="time-grid-day-name">{day.toLocaleDateString(undefined, { weekday: "short" })}</span>

                <span className={`time-grid-day-num ${isToday ? "today-badge" : ""}`}>{day.getDate()}</span>

              </button>

            );

          })}

        </div>

      </div>



      {/* Scrollable workday grid with individual 15-minute rows. */}

      <div className="time-grid-body-scroll">

        <div className="time-grid-labels" style={{ "--time-row-height": `${rowHeight}px`, height: `${gridHeight}px` }}>

          {rows.map((row) => (

            <div

              key={`${row.hour}-${row.minutes}`}

              className={`time-grid-label-row ${row.minutes === 0 ? "is-hour" : "is-quarter"}`}

            >

              <span className="time-grid-label-text">

                {formatHour(row.hour, row.minutes)}

              </span>

            </div>

          ))}

          <div className="time-grid-end-row"><span>{formatHour(18, 0)}</span></div>

        </div>



        {/* Day columns with horizontal lines for each 15-minute row */}

        <div className="time-grid-columns" style={{ "--time-row-height": `${rowHeight}px`, height: `${gridHeight}px` }}>

          {dates.map((day) => {

            const dayKey = dateKey(day);

            const dayMeetings = meetings.filter((meeting) => dateKey(new Date(meeting.start_datetime)) === dayKey);

            const positionedEvents = layoutDayEvents(dayMeetings, rowHeight);



            return (

              <div className="time-grid-column" key={dayKey}>

                {/* 15-minute time rows with dividing horizontal lines */}

                {rows.map((row) => (

                  <div

                    key={`${row.hour}-${row.minutes}`}

                    className={`time-grid-slot ${row.minutes === 0 ? "is-hour" : "is-quarter"}`}

                    onDoubleClick={() => onCreateEvent && onCreateEvent(day, row.hour, row.minutes)}

                    title={`Double-click to schedule at ${formatHour(row.hour, row.minutes)}`}

                  />

                ))}



                {/* Scheduled calendar events placed accurately on the 15-minute grid */}

                {positionedEvents.map(({ event, style }) => (

                  <CalendarEvent

                    key={event.id}

                    meeting={event}

                    onSelect={onSelect}

                    onEdit={onEdit}

                    onAttendance={onAttendance}

                    attendanceSubmitting={attendanceSubmitting}

                    className="time-grid-event"

                    style={style}

                  />

                ))}

              </div>

            );

          })}

        </div>

      </div>

    </div>

  );

}



export default function Calendar() {

  const { user } = useAuth();

  const canManage = canManageOperations(user?.role);

  const [meetings, setMeetings] = useState([]);

  const [interns, setInterns] = useState([]);

  const [calendarDate, setCalendarDate] = useState(new Date());

  const [selectedDate, setSelectedDate] = useState(new Date());

  const [view, setView] = useState("month");

  const [filters, setFilters] = useState({ my: true, project: true, team: true, deadline: true });

  const [formOpen, setFormOpen] = useState(false);

  const [initialFormValues, setInitialFormValues] = useState(emptyEvent);

  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [attendanceSubmitting, setAttendanceSubmitting] = useState("");

  const [error, setError] = useState("");

  const formSectionRef = useRef(null);



  const loadAll = async () => {

    try {

      const [meetingData, optionData] = await Promise.all([

        listMeetings(),

        canManage ? getMeetingOptions() : Promise.resolve(null),

      ]);

      setMeetings(meetingData);

      setInterns(optionData?.attendees?.filter((attendee) => attendee.role === "intern") || []);

    } catch (requestError) {

      setError(requestError.message);

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => { loadAll(); }, []);



  useEffect(() => {

    if (!formOpen) return;

    const frame = window.requestAnimationFrame(() => {

      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    });

    return () => window.cancelAnimationFrame(frame);

  }, [formOpen, initialFormValues]);



  const visibleMeetings = useMemo(() => meetings.filter((meeting) => filters[eventKind(meeting)]), [meetings, filters]);



  const monthDays = useMemo(() => {

    const monthStart = startOfMonth(calendarDate);

    const gridStart = new Date(monthStart);

    gridStart.setDate(1 - monthStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {

      const day = new Date(gridStart);

      day.setDate(gridStart.getDate() + index);

      return day;

    });

  }, [calendarDate]);



  const selectedEvents = visibleMeetings.filter((meeting) => dateKey(new Date(meeting.start_datetime)) === dateKey(selectedDate));

  const monthEvents = visibleMeetings.filter((meeting) => new Date(meeting.start_datetime).getMonth() === calendarDate.getMonth() && new Date(meeting.start_datetime).getFullYear() === calendarDate.getFullYear());



  function moveCalendar(offset) {

    if (view === "day") {

      setSelectedDate((curr) => {

        const next = new Date(curr);

        next.setDate(curr.getDate() + offset);

        return next;

      });

      setCalendarDate((curr) => {

        const next = new Date(curr);

        next.setDate(curr.getDate() + offset);

        return next;

      });

    } else if (view === "week") {

      setSelectedDate((curr) => {

        const next = new Date(curr);

        next.setDate(curr.getDate() + offset * 7);

        return next;

      });

      setCalendarDate((curr) => {

        const next = new Date(curr);

        next.setDate(curr.getDate() + offset * 7);

        return next;

      });

    } else {

      setCalendarDate((curr) => new Date(curr.getFullYear(), curr.getMonth() + offset, 1));

    }

  }



  function goToday() {

    const today = new Date();

    setCalendarDate(today);

    setSelectedDate(today);

  }



  function handleCreateAtTime(day, hour, minutes) {

    if (!canManage) return;

    const pad = (n) => String(n).padStart(2, "0");

    const startStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(hour)}:${pad(minutes)}`;

    const endMinutesTotal = hour * 60 + minutes + SLOT_MINUTES;

    const endHour = Math.floor(endMinutesTotal / 60) % 24;

    const endMin = endMinutesTotal % 60;

    const endStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(endHour)}:${pad(endMin)}`;



    setInitialFormValues({

      ...emptyEvent,

      start_datetime: startStr,

      end_datetime: endStr,

    });

    setFormOpen(true);

  }



  function openMeetingEditor(meeting) {

    if (!canManage) return;

    setSelectedMeeting(meeting);

    setInitialFormValues({

      ...meeting,

      start_datetime: meeting.start_datetime?.slice(0, 16) || "",

      end_datetime: meeting.end_datetime?.slice(0, 16) || "",

      attendee_user_ids: meeting.attendee_user_ids || [],

      project_ids: meeting.project_ids || [],

    });

    setFormOpen(true);

  }



  function openDefaultCreate() {

    const now = new Date();

    const pad = (n) => String(n).padStart(2, "0");

    const roundedMinutes = Math.ceil(now.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES;

    const proposedMinutes = now.getHours() * 60 + roundedMinutes;

    const startTotal = Math.min(Math.max(proposedMinutes, WORKDAY_START_MINUTES), WORKDAY_END_MINUTES - SLOT_MINUTES);

    const startHour = Math.floor(startTotal / 60);

    const startMin = startTotal % 60;

    const endTotal = startTotal + SLOT_MINUTES;

    const endHour = Math.floor(endTotal / 60);

    const endMin = endTotal % 60;

    const day = selectedDate || now;



    setInitialFormValues({

      ...emptyEvent,

      start_datetime: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(startHour)}:${pad(startMin)}`,

      end_datetime: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(endHour)}:${pad(endMin)}`,

    });

    setFormOpen(true);

  }



  async function saveEvent(payload) {

    setSubmitting(true);

    setError("");

    try {

      const { id, created_by, ...meetingPayload } = payload;

      const requestPayload = {

        ...meetingPayload,

        attendee_user_ids: meetingPayload.attendee_user_ids || [],

        project_ids: meetingPayload.project_ids || [],

      };

      if (id) await updateMeeting(id, requestPayload);

      else await createMeeting(requestPayload);

      setFormOpen(false);

      setSelectedMeeting(null);

      const data = await listMeetings();

      setMeetings(data);

    } catch (requestError) {

      setError(requestError.message);

    } finally {

      setSubmitting(false);

    }

  }



  async function respondToMeeting(meeting, attendanceStatus) {

    if (!meeting || user?.role !== "intern") return;

    setAttendanceSubmitting(attendanceStatus);

    setError("");

    try {

      const updatedMeeting = await updateMeetingAttendance(meeting.id, attendanceStatus);

      setMeetings((current) => current.map((meeting) => meeting.id === updatedMeeting.id ? updatedMeeting : meeting));

      setSelectedMeeting((current) => current?.id === updatedMeeting.id ? updatedMeeting : current);

    } catch (requestError) {

      setError(requestError.message);

    } finally {

      setAttendanceSubmitting("");

    }

  }



  const calendarTitle = useMemo(() => {

    if (view === "day") {

      return selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });

    }

    if (view === "week") {

      const start = new Date(selectedDate);

      start.setDate(selectedDate.getDate() - selectedDate.getDay());

      const end = new Date(start);

      end.setDate(start.getDate() + 6);

      if (start.getMonth() === end.getMonth()) {

        return `${start.toLocaleDateString(undefined, { month: "long" })} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;

      }

      return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

    }

    return calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  }, [calendarDate, selectedDate, view]);



  return (

    <div className="calendar-page space-y-5">

      <section className="calendar-hero">

        <div className="relative z-10 max-w-2xl">

          <p className="eyebrow text-[#0871c6]">Calendar workspace</p>

          <h2 className="mt-2 text-4xl font-black tracking-tighter text-[#10233f] sm:text-5xl">

            Team <span className="text-[#0871c6]">Calendar</span>

          </h2>

          <p className="mt-2 text-sm text-slate-500 sm:text-base">

            Coordinate meetings and deadlines across focused 15-minute workday slots.

          </p>

          {canManage && (

            <button className="primary-button mt-5" onClick={openDefaultCreate}>

              <Plus size={17} /> Create event

            </button>

          )}

        </div>

        <div className="calendar-hero-art" />

      </section>



      {formOpen && (

        <div ref={formSectionRef}>

          <EventForm

            key={initialFormValues.id || initialFormValues.start_datetime || "new-event"}

            initialValues={initialFormValues}

            interns={interns}

            submitting={submitting}

            onSubmit={saveEvent}

            onClose={() => setFormOpen(false)}

          />

        </div>

      )}



      {error && (

        <div className="flex items-center justify-between rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">

          <span>{error}</span>

          <button onClick={() => setError("")} aria-label="Dismiss error">

            <X size={16} />

          </button>

        </div>

      )}



      <div className="calendar-layout">

        <section className="content-card calendar-main">

          {/* Calendar Toolbar */}

          <div className="calendar-toolbar">

            <div className="flex items-center gap-2">

              <button className="secondary-button calendar-today" onClick={goToday}>Today</button>

              <div className="flex">

                <button

                  className="icon-button rounded-r-none"

                  onClick={() => moveCalendar(-1)}

                  aria-label="Previous period"

                >

                  <ChevronLeft size={18} />

                </button>

                <button

                  className="icon-button rounded-l-none border-l-0"

                  onClick={() => moveCalendar(1)}

                  aria-label="Next period"

                >

                  <ChevronRight size={18} />

                </button>

              </div>

              <h3 className="calendar-month-title">{calendarTitle}</h3>

            </div>

            <div className="calendar-view-tabs">

              {["month", "week", "day", "list"].map((tab) => (

                <button

                  key={tab}

                  className={view === tab ? "active" : ""}

                  onClick={() => { if (tab === "week" || tab === "day") setSelectedDate(calendarDate); setView(tab); }}

                >

                  {tab[0].toUpperCase() + tab.slice(1)}

                </button>

              ))}

            </div>

          </div>



          {/* Main Calendar View Area */}

          {loading ? (

            <div className="flex items-center justify-center gap-2 py-20 text-sm font-semibold text-slate-400">

              <LoaderCircle className="animate-spin" size={18} /> Loading calendar...

            </div>

          ) : view === "month" ? (

            <div className="month-calendar-frame">

              <div className="calendar-grid month-calendar-grid">

                <div className="calendar-weekdays">

                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (

                    <span key={day}>{day}</span>

                  ))}

                </div>

                <div className="calendar-cells">

                  {monthDays.map((day) => {

                    const dayEvents = visibleMeetings.filter((meeting) => dateKey(new Date(meeting.start_datetime)) === dateKey(day));

                    const currentMonth = day.getMonth() === calendarDate.getMonth();

                    const today = dateKey(day) === dateKey(new Date());

                    return (

                      <div

                        className={`calendar-cell ${currentMonth ? "" : "muted"} ${dateKey(selectedDate) === dateKey(day) ? "selected" : ""}`}

                        key={dateKey(day)}

                        onClick={() => { setSelectedDate(day); setCalendarDate(day); setView("day"); }}

                      >

                        <button type="button" className={`calendar-date ${today ? "today" : ""}`} onClick={(event) => { event.stopPropagation(); setSelectedDate(day); setCalendarDate(day); setView("day"); }} aria-label={`Select ${day.toLocaleDateString()}`}>{day.getDate()}</button>

                        <div className="calendar-cell-events">

                          {dayEvents.slice(0, 2).map((meeting) => (

                            <CalendarEvent key={meeting.id} meeting={meeting} compact showCompactTime onSelect={setSelectedMeeting} onEdit={canManage ? openMeetingEditor : undefined} onAttendance={user?.role === "intern" ? respondToMeeting : undefined} attendanceSubmitting={attendanceSubmitting} />

                          ))}

                          {dayEvents.length > 2 && <span className="calendar-more">+{dayEvents.length - 2} more</span>}

                        </div>

                      </div>

                    );

                  })}

                </div>

              </div>

            </div>

          ) : view === "week" || view === "day" ? (

            <TimeGrid

              date={selectedDate}

              view={view}

              meetings={visibleMeetings}

              onSelect={setSelectedMeeting}

              onEdit={canManage ? openMeetingEditor : undefined}

              onAttendance={user?.role === "intern" ? respondToMeeting : undefined}

              attendanceSubmitting={attendanceSubmitting}

              onSelectDate={(newDate) => setSelectedDate(newDate)}

              onCreateEvent={handleCreateAtTime}

            />

          ) : (

            <div className="calendar-list-view">

              {monthEvents.length ? (

                monthEvents.map((meeting) => (

                  <CalendarEvent key={meeting.id} meeting={meeting} onSelect={setSelectedMeeting} onEdit={canManage ? openMeetingEditor : undefined} onAttendance={user?.role === "intern" ? respondToMeeting : undefined} attendanceSubmitting={attendanceSubmitting} />

                ))

              ) : (

                <div className="py-16 text-center text-sm text-slate-400">No events in this view.</div>

              )}

            </div>

          )}

        </section>



        {/* Sidebar */}

        <aside className="calendar-sidebar">

          <section className="content-card selected-day-panel">

            <div className="flex items-center justify-between">

              <div>

                <h3 className="text-base font-black text-[#10233f]">

                  {selectedDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}

                </h3>

                <p className="mt-1 text-xs font-semibold text-slate-400">

                  {selectedEvents.length} {selectedEvents.length === 1 ? "event" : "events"}

                </p>

              </div>

              <CalendarDays className="text-[#0871c6]" size={20} />

            </div>

            <div className="mt-4 space-y-2">

              {selectedEvents.length ? (

                selectedEvents.map((meeting) => (

                  <CalendarEvent key={meeting.id} meeting={meeting} onSelect={setSelectedMeeting} onEdit={canManage ? openMeetingEditor : undefined} onAttendance={user?.role === "intern" ? respondToMeeting : undefined} attendanceSubmitting={attendanceSubmitting} />

                ))

              ) : (

                <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-400">

                  Nothing scheduled for this day.

                </p>

              )}

            </div>

          </section>



          <section className="content-card calendar-filters">

            <div className="flex items-center justify-between">

              <h3 className="text-base font-black text-[#10233f]">My Calendars</h3>

              <button className="text-slate-400" aria-label="Calendar settings">

                <MoreVertical size={18} />

              </button>

            </div>

            <div className="mt-4 space-y-3">

              {eventColors.map((item) => (

                <label className="calendar-filter" key={item.key}>

                  <input

                    type="checkbox"

                    checked={filters[item.key]}

                    onChange={() => setFilters((current) => ({ ...current, [item.key]: !current[item.key] }))}

                    style={{ accentColor: item.dot }}

                  />

                  <span className="calendar-filter-box" style={{ backgroundColor: filters[item.key] ? item.dot : "#d3dce6" }}>

                    ✓

                  </span>

                  <span>{item.label}</span>

                </label>

              ))}

            </div>

          </section>

        </aside>

      </div>



      {selectedMeeting && (

        <div className="calendar-detail content-card">

          <div>

            <p className="eyebrow text-[#0871c6]">Event details</p>

            <h3 className="section-title">{selectedMeeting.meeting_title}</h3>

            <p className="mt-2 text-sm text-slate-500">

              <Clock3 className="mr-1 inline" size={14} />

              {formatTime(selectedMeeting.start_datetime)} - {formatTime(selectedMeeting.end_datetime)} · {selectedMeeting.meeting_type || "Meeting"}

            </p>

            <p className="mt-2 text-sm text-slate-500">

              <Users className="mr-1 inline" size={14} />

              {selectedMeeting.accepted_attendee_count || 0} accepted attendees

            </p>

            {user?.role === "intern" && (

              <div className="mt-4">

                <p className="mb-2 text-xs font-bold text-slate-500">

                  Your response: <span className="text-[#10233f]">{selectedMeeting.current_user_attendance_status || "Invited"}</span>

                </p>

                <div className="flex flex-wrap gap-2">

                  <button

                    type="button"

                    className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-extrabold transition ${selectedMeeting.current_user_attendance_status === "Accepted" ? "border-green-600 bg-green-600 text-white" : "border-green-200 bg-green-50 text-green-700 hover:border-green-500"}`}

                    onClick={() => respondToMeeting(selectedMeeting, "Accepted")}

                    disabled={Boolean(attendanceSubmitting)}

                  >

                    {attendanceSubmitting === "Accepted" ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />} Accept

                  </button>

                  <button

                    type="button"

                    className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-extrabold transition ${selectedMeeting.current_user_attendance_status === "Declined" ? "border-red-600 bg-red-600 text-white" : "border-red-200 bg-red-50 text-red-700 hover:border-red-500"}`}

                    onClick={() => respondToMeeting(selectedMeeting, "Declined")}

                    disabled={Boolean(attendanceSubmitting)}

                  >

                    {attendanceSubmitting === "Declined" ? <LoaderCircle className="animate-spin" size={15} /> : <X size={15} />} Decline

                  </button>

                </div>

              </div>

            )}

          </div>

          <button className="icon-button" onClick={() => setSelectedMeeting(null)} aria-label="Close event details">

            <X size={18} />

          </button>

        </div>

      )}

    </div>

  );

}
