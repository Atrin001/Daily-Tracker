"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Habit = {
  id: string;
  name: string;
  unit: string;
  target: number;
  category: string;
  color: string;
  tint: string;
  icon: string;
  days?: number[];
  reminder?: string;
  weight?: number;
  startDate?: string;
  endDate?: string;
  excludedDates?: string[];
};

type Progress = Record<string, Record<string, number>>;
type DailyNotes = Record<string, string>;
type HealthEntry = {
  steps?: number; calories?: number; activeMinutes?: number; workouts?: number;
  restingHeartRate?: number; hrv?: number; spo2?: number; stress?: number;
  sleepMinutes?: number; deepSleepMinutes?: number; remSleepMinutes?: number;
  source?: "manual" | "huawei" | "huawei-import";
};
type HealthData = Record<string, HealthEntry>;
type HealthMetric = "sleepMinutes" | "restingHeartRate" | "hrv" | "spo2" | "steps" | "stress" | "activeMinutes";

type CloudState = { habits: Habit[]; progress: Progress; healthData?: HealthData; dailyGoal: number; model: string; demo: boolean; notes?: DailyNotes; weeklyGoal?: number; weeklyPlan?: string; displayName?: string };
type SyncStatus = "starting" | "syncing" | "synced" | "offline" | "local";
type ThemeMode = "light" | "dark" | "system";
type CoachHabitDraft = { name: string; unit: string; target: number; category: string; weight?: number; days?: number[]; reminder?: string };
type CoachHabitChanges = { name?: string; unit?: string; target?: number; category?: string; weight?: number; days?: number[] | null; reminder?: string | null };
type CoachAction = { type: "add"; habit: CoachHabitDraft } | { type: "edit"; habitId: string; changes: CoachHabitChanges };
type CoachActionStatus = "pending" | "applied" | "dismissed" | "failed";
type ChatMessage = { id: string; role: "user" | "assistant" | "error"; text: string; action?: CoachAction; actionStatus?: CoachActionStatus };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DEFAULT_HABITS: Habit[] = [
  { id: "water", name: "Drink water", unit: "glasses", target: 8, category: "Body", color: "#378cdb", tint: "#eaf4ff", icon: "💧" },
  { id: "workout", name: "Work out", unit: "session", target: 1, category: "Body", color: "#df7540", tint: "#fff0e8", icon: "⌁" },
  { id: "walking", name: "Walk", unit: "thousand steps", target: 6, category: "Body", color: "#168d82", tint: "#e5f7f4", icon: "♟" },
  { id: "thesis", name: "Work on master's thesis", unit: "hours", target: 4, category: "Study", color: "#7257d7", tint: "#f0ecff", icon: "✦" },
  { id: "reading", name: "Study articles", unit: "articles", target: 2, category: "Study", color: "#2f9c70", tint: "#e7f7ef", icon: "▤" },
  { id: "meditation", name: "Meditate", unit: "minutes", target: 10, category: "Mind", color: "#b76296", tint: "#faeaf4", icon: "◉" },
];

const PALETTE = [
  ["#378cdb", "#eaf4ff"], ["#7257d7", "#f0ecff"], ["#df7540", "#fff0e8"],
  ["#168d82", "#e5f7f4"], ["#d15372", "#ffeaf0"], ["#aa7a31", "#fff5dc"],
];

const CATEGORY_ICONS: Record<string, string> = { Health: "♥", Fitness: "↗", Nutrition: "◉", Study: "◇", Focus: "◎", Mindfulness: "✦", Sleep: "☾", Personal: "☺", Home: "⌂", Creative: "✎", Social: "♧", Finance: "$", Body: "◌", Mind: "✦", Lifestyle: "⌂", Other: "·" };
const CATEGORY_SUGGESTIONS = ["Health", "Fitness", "Nutrition", "Study", "Focus", "Mindfulness", "Sleep", "Personal", "Home", "Creative", "Social", "Finance"];
const STARTER_CATEGORIES = [...CATEGORY_SUGGESTIONS, "Body", "Mind", "Lifestyle", "Other"];
const REMINDER_PRESETS: Record<string, Array<{ label: string; time: string }>> = {
  Fitness: [{ label: "Early workout", time: "07:00" }, { label: "Lunch break", time: "12:30" }, { label: "After work", time: "18:00" }],
  Nutrition: [{ label: "Breakfast", time: "08:00" }, { label: "Lunch", time: "12:30" }, { label: "Evening", time: "19:00" }],
  Study: [{ label: "Morning focus", time: "09:00" }, { label: "Afternoon", time: "14:00" }, { label: "Quiet evening", time: "19:30" }],
  Focus: [{ label: "Start work", time: "09:00" }, { label: "After lunch", time: "13:30" }, { label: "Evening block", time: "19:00" }],
  Mindfulness: [{ label: "Wake up", time: "07:30" }, { label: "Midday reset", time: "13:00" }, { label: "Wind down", time: "21:00" }],
  Sleep: [{ label: "Wind down", time: "21:30" }, { label: "Bedtime", time: "22:30" }],
};
const WEEK_DAYS = [
  { value: 6, label: "Sat" }, { value: 0, label: "Sun" }, { value: 1, label: "Mon" },
  { value: 2, label: "Tue" }, { value: 3, label: "Wed" }, { value: 4, label: "Thu" }, { value: 5, label: "Fri" },
];
const HEALTH_METRICS: Record<HealthMetric, { label: string; unit: string; color: string }> = {
  sleepMinutes: { label: "Sleep", unit: "hours", color: "#7257d7" },
  restingHeartRate: { label: "Resting heart rate", unit: "bpm", color: "#d15372" },
  hrv: { label: "HRV", unit: "ms", color: "#168d82" },
  spo2: { label: "SpO₂", unit: "%", color: "#378cdb" },
  steps: { label: "Steps", unit: "steps", color: "#df7540" },
  stress: { label: "Stress", unit: "/100", color: "#aa7a31" },
  activeMinutes: { label: "Active time", unit: "min", color: "#2f9c70" },
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const cleanText = (value: unknown, fallback = "") => typeof value === "string" ? value.trim().slice(0, 100) : fallback;
const cleanDays = (value: unknown) => Array.isArray(value) ? Array.from(new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))) : undefined;

function normalizeCoachAction(value: unknown): CoachAction | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type === "add" && isRecord(value.habit)) {
    const name = cleanText(value.habit.name);
    const unit = cleanText(value.habit.unit);
    const category = cleanText(value.habit.category, "Other");
    const target = Math.max(1, Math.min(50, Number(value.habit.target) || 0));
    if (!name || !unit || !Number(value.habit.target)) return undefined;
    const weight = Math.max(1, Math.min(5, Number(value.habit.weight) || 1));
    const days = cleanDays(value.habit.days);
    const reminder = /^([01]\d|2[0-3]):[0-5]\d$/.test(cleanText(value.habit.reminder)) ? cleanText(value.habit.reminder) : undefined;
    return { type: "add", habit: { name, unit, category, target, weight, days: days?.length === 7 || !days?.length ? undefined : days, reminder } };
  }
  if (value.type === "edit" && cleanText(value.habitId) && isRecord(value.changes)) {
    const changes: CoachHabitChanges = {};
    if (typeof value.changes.name === "string" && cleanText(value.changes.name)) changes.name = cleanText(value.changes.name);
    if (typeof value.changes.unit === "string" && cleanText(value.changes.unit)) changes.unit = cleanText(value.changes.unit);
    if (Number(value.changes.target)) changes.target = Math.max(1, Math.min(50, Number(value.changes.target)));
    if (typeof value.changes.category === "string" && cleanText(value.changes.category)) changes.category = cleanText(value.changes.category);
    if (Number(value.changes.weight)) changes.weight = Math.max(1, Math.min(5, Number(value.changes.weight)));
    if (value.changes.days === null) changes.days = null;
    else if (Array.isArray(value.changes.days)) { const days = cleanDays(value.changes.days); changes.days = days?.length === 7 || !days?.length ? null : days; }
    if (value.changes.reminder === null || value.changes.reminder === "") changes.reminder = null;
    else if (/^([01]\d|2[0-3]):[0-5]\d$/.test(cleanText(value.changes.reminder))) changes.reminder = cleanText(value.changes.reminder);
    return Object.keys(changes).length ? { type: "edit", habitId: cleanText(value.habitId), changes } : undefined;
  }
  return undefined;
}

function CoachPermissionCard({ action, status = "pending", habits, onAllow, onDismiss }: { action: CoachAction; status?: CoachActionStatus; habits: Habit[]; onAllow: (approvedAction: CoachAction) => void; onDismiss: () => void }) {
  const targetHabit = action.type === "edit" ? habits.find((habit) => habit.id === action.habitId) : undefined;
  const values = action.type === "add" ? action.habit : action.changes;
  const everyDay = WEEK_DAYS.map((day) => day.value);
  const [draft, setDraft] = useState(() => ({
    name: values.name ?? targetHabit?.name ?? "",
    target: values.target ?? targetHabit?.target ?? 1,
    unit: values.unit ?? targetHabit?.unit ?? "times",
    category: values.category ?? targetHabit?.category ?? "Other",
    weight: values.weight ?? targetHabit?.weight ?? 1,
    days: values.days === null ? everyDay : values.days ?? targetHabit?.days ?? everyDay,
    reminder: values.reminder === null ? "" : values.reminder ?? targetHabit?.reminder ?? "",
  }));
  const details = [
    action.type === "add" ? ["Habit", values.name] : ["Editing", targetHabit?.name || action.habitId],
    values.target !== undefined ? ["Target", `${values.target} ${values.unit || targetHabit?.unit || "units"}`] : null,
    values.category ? ["Category", values.category] : null,
    values.weight !== undefined ? ["Weight", `${values.weight}×`] : null,
    values.days !== undefined ? ["Schedule", values.days === null || !values.days?.length ? "Every day" : values.days.map((day) => WEEK_DAYS.find((item) => item.value === day)?.label).filter(Boolean).join(", ")] : null,
    values.reminder !== undefined ? ["Reminder", values.reminder || "Remove reminder"] : null,
    action.type === "edit" && values.name ? ["New name", values.name] : null,
    action.type === "edit" && values.unit && values.target === undefined ? ["Unit", values.unit] : null,
  ].filter(Boolean) as string[][];
  const toggleDay = (day: number) => setDraft((current) => ({ ...current, days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day] }));
  const approve = () => {
    const shared = {
      name: draft.name.trim(), unit: draft.unit.trim(), target: Math.max(1, Math.min(50, draft.target)), category: draft.category.trim() || "Other",
      weight: Math.max(1, Math.min(5, draft.weight)), days: draft.days.length === 7 ? undefined : draft.days, reminder: draft.reminder || undefined,
    };
    if (!shared.name || !shared.unit || draft.days.length === 0) return;
    if (action.type === "add") onAllow({ type: "add", habit: shared });
    else onAllow({ type: "edit", habitId: action.habitId, changes: { ...shared, days: draft.days.length === 7 ? null : draft.days, reminder: draft.reminder || null } });
  };
  return <section className={`coach-action-card ${status}`}><div className="coach-action-title"><span>{action.type === "add" ? "＋" : "✎"}</span><div><small>REVIEW & PERMISSION REQUIRED</small><b>{action.type === "add" ? "Review this new habit" : `Review changes to ${targetHabit?.name || "this habit"}`}</b></div></div>{status === "pending" ? <div className="coach-action-editor"><label>Habit name<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label><div className="coach-action-editor-row"><label>Target<input type="number" min="1" max="50" value={draft.target} onChange={(event) => setDraft((current) => ({ ...current, target: Number(event.target.value) || 1 }))} /></label><label>Unit<input value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} placeholder="times, minutes, pages…" /></label><label>Weight<select value={draft.weight} onChange={(event) => setDraft((current) => ({ ...current, weight: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((weight) => <option key={weight} value={weight}>{weight}×</option>)}</select></label></div><div className="coach-action-editor-row two"><label>Category<input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /></label><label>Reminder<input type="time" value={draft.reminder} onChange={(event) => setDraft((current) => ({ ...current, reminder: event.target.value }))} /><button type="button" className="coach-clear-reminder" onClick={() => setDraft((current) => ({ ...current, reminder: "" }))}>Clear</button></label></div><fieldset><legend>Repeat on</legend><div>{WEEK_DAYS.map((day) => <label key={day.value}><input type="checkbox" checked={draft.days.includes(day.value)} onChange={() => toggleDay(day.value)} /><span>{day.label}</span></label>)}</div></fieldset><small className="coach-review-note">These exact values will be saved only after you allow the change.</small></div> : <dl>{details.map(([label, detail]) => <div key={`${label}-${detail}`}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl>}{status === "pending" ? <div className="coach-action-buttons"><button className="allow-action" onClick={approve} disabled={!draft.name.trim() || !draft.unit.trim() || draft.days.length === 0}>{action.type === "add" ? "Allow and add" : "Allow changes"}</button><button onClick={onDismiss}>Not now</button></div> : <div className="coach-action-result">{status === "applied" ? "✓ Applied to your routine" : status === "dismissed" ? "No changes were made" : "This habit is no longer available"}</div>}</section>;
}

async function putCloudState(state: CloudState, baseRevision: number, deviceId: string, updatedAt: string) {
  const response = await fetch("/api/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, baseRevision, deviceId, updatedAt }),
  });
  return { response, data: await response.json() as { revision?: number; updatedAt?: string; error?: string } };
}

const dateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const shiftDate = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const isHabitScheduled = (habit: Habit, date: Date) => {
  const key = dateKey(date);
  return (!habit.startDate || key >= habit.startDate)
    && (!habit.endDate || key <= habit.endDate)
    && !habit.excludedDates?.includes(key)
    && (!habit.days?.length || habit.days.includes(date.getDay()));
};

const withHabitStartDates = (habits: Habit[], progress: Progress, fallbackDate = dateKey(new Date())) => habits.map((habit) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(habit.startDate || "")) return habit;
  const firstRecordedDate = Object.keys(progress).filter((day) => Object.prototype.hasOwnProperty.call(progress[day] || {}, habit.id)).sort()[0];
  return { ...habit, startDate: firstRecordedDate || fallbackDate };
});

const weekStart = (date: Date) => shiftDate(date, -((date.getDay() + 1) % 7));

const faNumber = (value: number | string) => String(value).replace(/\d/g, (n) => "۰۱۲۳۴۵۶۷۸۹"[Number(n)]);

const persianParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day") };
};

const fullPersianDate = (date: Date) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
}).format(date);

function HabitLabelsAndReminder({ initialCategory, initialReminder, existingCategories, notificationPermission, onEnableNotifications }: {
  initialCategory: string; initialReminder?: string; existingCategories: string[]; notificationPermission: string; onEnableNotifications: () => void;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [reminder, setReminder] = useState(initialReminder || "");
  const presets = REMINDER_PRESETS[category] || [
    { label: "Morning", time: "08:00" }, { label: "Midday", time: "13:00" }, { label: "Evening", time: "19:00" },
  ];
  const customLabels = existingCategories.filter((item) => !CATEGORY_SUGGESTIONS.includes(item) && !["Body", "Mind", "Lifestyle", "Other"].includes(item));
  return <>
    <div className="category-picker"><label>Category label
      <input name="category" required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Type your own label" />
    </label>
      <span className="field-hint">Suggested labels</span>
      <div className="category-chips">{CATEGORY_SUGGESTIONS.map((item) => <button type="button" key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}><i>{CATEGORY_ICONS[item]}</i>{item}</button>)}</div>
      {customLabels.length > 0 && <><span className="field-hint">Your labels</span><div className="category-chips custom">{customLabels.map((item) => <button type="button" key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}><i>＋</i>{item}</button>)}</div></>}
      <small className="category-help">Pick a suggestion or type any new label above. New labels are saved automatically.</small>
    </div>
    <div className="reminder-builder"><div className="reminder-title"><div><b>Smart reminder</b><span>Optional · uses your device&apos;s local time</span></div>{notificationPermission !== "granted" && <button type="button" onClick={onEnableNotifications}>Enable notifications</button>}</div><div className="reminder-presets">{presets.map((preset, index) => <button type="button" key={preset.time} className={reminder === preset.time ? "selected" : ""} onClick={() => setReminder(preset.time)}><small>{index === 0 ? "RECOMMENDED" : preset.label}</small><b>{preset.time}</b><span>{index === 0 ? preset.label : ""}</span></button>)}</div><label>Custom time<input name="reminder" type="time" value={reminder} onChange={(event) => setReminder(event.target.value)} /></label>{reminder && <button type="button" className="clear-reminder" onClick={() => setReminder("")}>Remove reminder</button>}<p className="reminder-note">Roval only nudges you on scheduled days and skips reminders when the habit is already complete.</p></div>
  </>;
}

const shortPersianDate = (date: Date) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  day: "numeric", month: "short",
}).format(date);

function buildSeed(habits: Habit[]): Progress {
  const result: Progress = {};
  for (let offset = -44; offset <= 0; offset += 1) {
    const base = 48 + (Math.abs(offset * 19 + 7) % 43);
    result[dateKey(shiftDate(new Date(), offset))] = Object.fromEntries(habits.map((habit, index) => {
      const factor = Math.max(.08, Math.min(1, (base + ((index * 13 + Math.abs(offset)) % 19) - 10) / 100));
      return [habit.id, Math.min(habit.target, Math.round(habit.target * factor))];
    }));
  }
  return result;
}

function buildHealthSeed(): HealthData {
  return Object.fromEntries(Array.from({ length: 30 }, (_, index) => {
    const offset = index - 29;
    const rhythm = Math.abs(offset * 17 + 11);
    const sleepMinutes = 390 + rhythm % 105;
    return [dateKey(shiftDate(new Date(), offset)), {
      steps: 5200 + rhythm % 6100, calories: 320 + rhythm % 410, activeMinutes: 28 + rhythm % 58, workouts: rhythm % 4 === 0 ? 1 : 0,
      restingHeartRate: 57 + rhythm % 12, hrv: 38 + rhythm % 25, spo2: 95 + rhythm % 4, stress: 28 + rhythm % 37,
      sleepMinutes, deepSleepMinutes: Math.round(sleepMinutes * (.17 + (rhythm % 7) / 100)), remSleepMinutes: Math.round(sleepMinutes * (.2 + (rhythm % 5) / 100)), source: "huawei" as const,
    }];
  }));
}

const formatHealthMinutes = (minutes?: number) => minutes === undefined ? "—" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

const HUAWEI_FIELD_ALIASES: Record<string, keyof Omit<HealthEntry, "source">> = {
  steps: "steps", stepcount: "steps", totalsteps: "steps",
  calories: "calories", activecalories: "calories", caloriesburned: "calories",
  activeminutes: "activeMinutes", activetime: "activeMinutes", activityminutes: "activeMinutes",
  workouts: "workouts", workoutcount: "workouts",
  restingheartrate: "restingHeartRate", restheartrate: "restingHeartRate", rhr: "restingHeartRate",
  hrv: "hrv", heartratevariability: "hrv",
  spo2: "spo2", bloodoxygen: "spo2", oxygensaturation: "spo2",
  stress: "stress", stressaverage: "stress", stressscore: "stress",
  sleepminutes: "sleepMinutes", totalsleepminutes: "sleepMinutes", sleepdurationminutes: "sleepMinutes",
  deepsleepminutes: "deepSleepMinutes", deepsleep: "deepSleepMinutes",
  remsleepminutes: "remSleepMinutes", remsleep: "remSleepMinutes",
};

function healthImportDate(value: unknown) {
  if (typeof value === "number" || /^\d{10,19}$/.test(String(value || ""))) {
    let timestamp = Number(value);
    if (timestamp > 1e17) timestamp /= 1e6;
    else if (timestamp < 1e12) timestamp *= 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? undefined : dateKey(date);
  }
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  return text && !Number.isNaN(date.getTime()) ? dateKey(date) : undefined;
}

function normalizedHealthRecord(record: Record<string, unknown>): { date: string; entry: HealthEntry } | undefined {
  const lowered = Object.fromEntries(Object.entries(record).map(([key, value]) => [key.replace(/[^a-z0-9]/gi, "").toLowerCase(), value]));
  const date = ["date", "day", "startdate", "starttime", "timestamp", "time"].map((key) => healthImportDate(lowered[key])).find(Boolean);
  if (!date) return undefined;
  const entry: HealthEntry = { source: "huawei-import" };
  for (const [key, value] of Object.entries(lowered)) {
    const metric = HUAWEI_FIELD_ALIASES[key];
    const numeric = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
    if (metric && Number.isFinite(numeric)) entry[metric] = Math.max(0, numeric);
  }
  return Object.keys(entry).length > 1 ? { date, entry } : undefined;
}

function collectHuaweiRecords(value: unknown, results: Array<{ date: string; entry: HealthEntry }>, depth = 0) {
  if (depth > 8 || !value) return;
  if (Array.isArray(value)) { value.forEach((item) => collectHuaweiRecords(item, results, depth + 1)); return; }
  if (!isRecord(value)) return;
  const record = normalizedHealthRecord(value);
  if (record) results.push(record);
  Object.values(value).forEach((item) => { if (Array.isArray(item) || isRecord(item)) collectHuaweiRecords(item, results, depth + 1); });
}

function parseCsvRows(text: string) {
  const rows = text.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const cells: string[] = []; let cell = ""; let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"' && quoted) { cell += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += char;
    }
    cells.push(cell.trim()); return cells;
  });
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function scoreForDay(day: Date, habits: Habit[], progress: Progress) {
  const activeHabits = habits.filter((habit) => isHabitScheduled(habit, day));
  const values = progress[dateKey(day)] || {};
  const achieved = activeHabits.reduce((sum, habit) => {
    const weight = Math.max(1, Math.min(5, habit.weight || 1));
    return sum + (Math.min(values[habit.id] || 0, habit.target) / habit.target) * weight;
  }, 0);
  const totalWeight = activeHabits.reduce((sum, habit) => sum + Math.max(1, Math.min(5, habit.weight || 1)), 0) || 1;
  return Math.round((achieved / totalWeight) * 100);
}

function streakForHabit(habit: Habit, progress: Progress, anchor = new Date()) {
  let streak = 0;
  for (let offset = 0; offset > -366; offset -= 1) {
    const day = shiftDate(anchor, offset);
    if (!isHabitScheduled(habit, day)) continue;
    if ((progress[dateKey(day)]?.[habit.id] || 0) >= habit.target) streak += 1;
    else break;
  }
  return streak;
}

function overallStreak(habits: Habit[], progress: Progress, goal: number) {
  let streak = 0;
  for (let offset = 0; offset > -366; offset -= 1) {
    if (scoreForDay(shiftDate(new Date(), offset), habits, progress) >= goal) streak += 1;
    else break;
  }
  return streak;
}

function monthDates(date: Date) {
  const parts = persianParts(date);
  const first = shiftDate(date, -(parts.day - 1));
  const dates: Date[] = [];
  for (let index = 0; index < 32; index += 1) {
    const current = shiftDate(first, index);
    if (persianParts(current).month !== parts.month) break;
    dates.push(current);
  }
  return dates;
}

function ProgressRing({ value }: { value: number }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  return <div className="ring-wrap" aria-label={`${value} percent complete`}>
    <svg viewBox="0 0 104 104" role="img"><circle className="ring-track" cx="52" cy="52" r={radius} /><circle className="ring-value" cx="52" cy="52" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} /></svg>
    <div className="ring-label"><strong>{value}%</strong><span>today</span></div>
  </div>;
}

function TrendChart({ values, labels, goal }: { values: number[]; labels: string[]; goal: number }) {
  const width = 680;
  const height = 240;
  const padX = 28;
  const padY = 28;
  const points = values.map((value, index) => ({
    x: padX + (index * (width - padX * 2)) / Math.max(1, values.length - 1),
    y: height - padY - (value / 100) * (height - padY * 2), value,
  }));
  const smoothPath = points.length ? points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[index + 1];
    const afterNext = points[Math.min(points.length - 1, index + 2)];
    const tension = .72;
    const control1X = point.x + ((next.x - previous.x) / 6) * tension;
    const control1Y = point.y + ((next.y - previous.y) / 6) * tension;
    const control2X = next.x - ((afterNext.x - point.x) / 6) * tension;
    const control2Y = next.y - ((afterNext.y - point.y) / 6) * tension;
    return `${path} C ${control1X},${control1Y} ${control2X},${control2Y} ${next.x},${next.y}`;
  }, `M ${points[0].x},${points[0].y}`) : "";
  const areaPath = points.length ? `${smoothPath} L ${points[points.length - 1].x},${height - padY} L ${points[0].x},${height - padY} Z` : "";
  const goalY = height - padY - (goal / 100) * (height - padY * 2);
  return <div className="chart-wrap">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Progress trend chart">
      {[25, 50, 75, 100].map((tick) => { const y = height - padY - (tick / 100) * (height - padY * 2); return <line key={tick} className="grid-line" x1={padX} x2={width - padX} y1={y} y2={y} />; })}
      <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#167f74" stopOpacity=".22" /><stop offset="1" stopColor="#167f74" stopOpacity="0" /></linearGradient></defs>
      <line className="goal-line" x1={padX} x2={width - padX} y1={goalY} y2={goalY} />
      <path d={areaPath} fill="url(#chartFill)" />
      <path d={smoothPath} fill="none" stroke="#167f74" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#167f74" strokeWidth="3" />)}
    </svg>
    <div className="chart-labels">{labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
  </div>;
}

function HealthTrendChart({ values, labels, metric }: { values: Array<number | undefined>; labels: string[]; metric: HealthMetric }) {
  const config = HEALTH_METRICS[metric];
  const width = 680; const height = 230; const padX = 30; const padY = 30;
  const present = values.filter((value): value is number => value !== undefined);
  if (!present.length) return <div className="health-chart-empty"><span>⌁</span><b>No {config.label.toLowerCase()} data yet</b><small>Add Band 11 values for this date to begin the curve.</small></div>;
  const minimum = Math.min(...present); const maximum = Math.max(...present); const spread = Math.max(1, maximum - minimum); const floor = Math.max(0, minimum - spread * .18); const ceiling = maximum + spread * .18;
  const points = values.map((value, index) => value === undefined ? null : ({
    x: padX + (index * (width - padX * 2)) / Math.max(1, values.length - 1),
    y: height - padY - ((value - floor) / Math.max(1, ceiling - floor)) * (height - padY * 2), value, label: labels[index],
  })).filter((point): point is { x: number; y: number; value: number; label: string } => Boolean(point));
  const path = points.length > 1 ? points.slice(0, -1).reduce((result, point, index) => {
    const previous = points[Math.max(0, index - 1)]; const next = points[index + 1]; const afterNext = points[Math.min(points.length - 1, index + 2)]; const tension = .68;
    const control1X = point.x + ((next.x - previous.x) / 6) * tension; const control1Y = point.y + ((next.y - previous.y) / 6) * tension;
    const control2X = next.x - ((afterNext.x - point.x) / 6) * tension; const control2Y = next.y - ((afterNext.y - point.y) / 6) * tension;
    return `${result} C ${control1X},${control1Y} ${control2X},${control2Y} ${next.x},${next.y}`;
  }, `M ${points[0].x},${points[0].y}`) : `M ${points[0].x},${points[0].y}`;
  const displayValue = (value: number) => metric === "sleepMinutes" ? `${(value / 60).toFixed(1)}h` : value.toLocaleString();
  return <div className="health-chart"><div className="health-chart-scale"><span>{displayValue(Math.round(ceiling))}</span><span>{displayValue(Math.round(floor))}</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${config.label} trend`}><defs><linearGradient id={`health-fill-${metric}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={config.color} stopOpacity=".2" /><stop offset="1" stopColor={config.color} stopOpacity="0" /></linearGradient></defs>{[.25,.5,.75].map((part) => <line key={part} className="grid-line" x1={padX} x2={width-padX} y1={padY+(height-padY*2)*part} y2={padY+(height-padY*2)*part} />)}<path d={`${path} L ${points[points.length-1].x},${height-padY} L ${points[0].x},${height-padY} Z`} fill={`url(#health-fill-${metric})`} /><path d={path} fill="none" stroke={config.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{points.map((point) => <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="4" fill="var(--surface)" stroke={config.color} strokeWidth="3"><title>{point.label}: {displayValue(point.value)} {metric === "sleepMinutes" ? "" : config.unit}</title></circle>)}</svg><div className="health-chart-labels">{labels.map((label, index) => <span key={`${label}-${index}`}>{index === 0 || index === labels.length - 1 || index % Math.max(1, Math.floor(labels.length / 6)) === 0 ? label : ""}</span>)}</div></div>;
}

function CalendarCard({ selected, onSelect, habits, progress, dailyGoal, className = "" }: {
  selected: Date; onSelect: (date: Date) => void; habits: Habit[]; progress: Progress; dailyGoal: number; className?: string;
}) {
  const [viewDate, setViewDate] = useState(selected);
  const dates = monthDates(viewDate);
  const first = dates[0];
  const leading = (first.getDay() + 1) % 7;
  const logged = dates.filter((date) => progress[dateKey(date)]).filter((date) => Object.keys(progress[dateKey(date)] || {}).length > 0);
  const scores = logged.map((date) => scoreForDay(date, habits, progress));
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const aboveGoal = scores.filter((score) => score >= dailyGoal).length;
  const bestIndex = scores.length ? scores.indexOf(Math.max(...scores)) : -1;
  const bestDate = bestIndex >= 0 ? logged[bestIndex] : null;
  const title = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" }).format(viewDate);
  return <section className={`calendar-card ${className}`} aria-label="Persian calendar">
    <div className="calendar-head"><div><span className="eyebrow">PERSIAN CALENDAR</span><h2 dir="rtl">{title}</h2></div><div><button aria-label="Previous month" onClick={() => setViewDate(shiftDate(first, -1))}>‹</button><button aria-label="Next month" onClick={() => setViewDate(shiftDate(dates[dates.length - 1], 1))}>›</button></div></div>
    <div className="calendar-weekdays" dir="rtl">{["ش", "ی", "د", "س", "چ", "پ", "ج"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid" dir="rtl">
      {Array.from({ length: leading }).map((_, index) => <span key={`blank-${index}`} />)}
      {dates.map((date) => {
        const score = scoreForDay(date, habits, progress);
        const selectedDay = dateKey(date) === dateKey(selected);
        const future = dateKey(date) > dateKey(new Date());
        return <button key={dateKey(date)} title={`${fullPersianDate(date)} · ${future ? "Future" : `${score}%`}`} className={`calendar-day${selectedDay ? " selected" : ""}${future ? " future" : ""}`} style={!selectedDay && score ? { backgroundColor: `rgba(22, 141, 130, ${.09 + score / 125})` } : undefined} onClick={() => onSelect(date)}><b>{faNumber(persianParts(date).day)}</b></button>;
      })}
    </div>
    <div className="heat-legend"><span>Less</span>{[.12,.25,.4,.58,.78].map((opacity) => <i key={opacity} style={{ backgroundColor: `rgba(22,141,130,${opacity})` }} />)}<span>Complete</span></div>
    <dl className="month-stats"><div><dt>Monthly average</dt><dd>{average}%</dd></div><div><dt>Days above {dailyGoal}%</dt><dd>{aboveGoal} days</dd></div><div><dt>Best day</dt><dd>{bestDate ? `${Math.max(...scores)}% · ${shortPersianDate(bestDate)}` : "—"}</dd></div><div><dt>Days logged</dt><dd>{logged.length} of {dates.length}</dd></div></dl>
  </section>;
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [progress, setProgress] = useState<Progress>({});
  const [healthData, setHealthData] = useState<HealthData>({});
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(80);
  const [weeklyGoal, setWeeklyGoal] = useState(80);
  const [weeklyPlan, setWeeklyPlan] = useState("");
  const [notes, setNotes] = useState<DailyNotes>({});
  const [displayName, setDisplayName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(() => typeof window !== "undefined" ? (localStorage.getItem("roval-theme") as ThemeMode || "system") : "system");
  const [trendRange, setTrendRange] = useState<"14d" | "8w">("14d");
  const [healthRange, setHealthRange] = useState<7 | 30>(7);
  const [healthMetric, setHealthMetric] = useState<HealthMetric>("sleepMinutes");
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [huaweiModalOpen, setHuaweiModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);
  const [newHabitScope, setNewHabitScope] = useState<"routine" | "day">("routine");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-3.6-flash");
  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [toast, setToast] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("starting");
  const [cloudReady, setCloudReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)));
  const importRef = useRef<HTMLInputElement>(null);
  const huaweiImportRef = useRef<HTMLInputElement>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement>(null);
  const syncRevisionRef = useRef(0);
  const applyingCloudRef = useRef(false);
  const persistedOnceRef = useRef(false);
  const cloudEnabledRef = useRef(true);
  const deviceIdRef = useRef("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedHabits = localStorage.getItem("roval-habits");
      const storedHabits = savedHabits ? JSON.parse(savedHabits) as Habit[] : DEFAULT_HABITS;
      const baseHabits = storedHabits.map((habit) => {
        const builtIn = DEFAULT_HABITS.find((item) => item.id === habit.id);
        return builtIn ? { ...habit, name: builtIn.name, unit: builtIn.unit, category: habit.category || builtIn.category } : { ...habit, category: habit.category || "Other" };
      });
      const savedProgress = localStorage.getItem("roval-progress");
      const savedDemo = localStorage.getItem("roval-demo") !== "false";
      const parsedProgress = savedProgress ? JSON.parse(savedProgress) as Progress : {};
      const nextProgress = savedDemo && Object.keys(parsedProgress).length < 30 ? buildSeed(baseHabits) : parsedProgress;
      const nextHabits = withHabitStartDates(baseHabits, nextProgress);
      setHabits(nextHabits);
      setProgress(nextProgress);
      setHealthData(JSON.parse(localStorage.getItem("roval-health-data") || "{}") as HealthData);
      setDemo(savedDemo);
      setDailyGoal(Number(localStorage.getItem("roval-daily-goal")) || 80);
      setWeeklyGoal(Number(localStorage.getItem("roval-weekly-goal")) || 80);
      setWeeklyPlan(localStorage.getItem("roval-weekly-plan") || "");
      setNotes(JSON.parse(localStorage.getItem("roval-notes") || "{}") as DailyNotes);
      setDisplayName(localStorage.getItem("roval-display-name") || "");
      setApiKey(sessionStorage.getItem("roval-gemini-key") || "");
      try {
        const savedChat = JSON.parse(sessionStorage.getItem("roval-coach-chat") || "[]") as ChatMessage[];
        if (Array.isArray(savedChat)) setChatMessages(savedChat.slice(-30));
      } catch { sessionStorage.removeItem("roval-coach-chat"); }
      setModel(localStorage.getItem("roval-gemini-model") || "gemini-3.6-flash");
      let deviceId = localStorage.getItem("roval-device-id");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("roval-device-id", deviceId);
      }
      deviceIdRef.current = deviceId;
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    sessionStorage.setItem("roval-coach-chat", JSON.stringify(chatMessages.slice(-30)));
  }, [chatMessages, ready]);

  useEffect(() => {
    if (!aiOpen) return;
    window.setTimeout(() => aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 30);
  }, [chatMessages, asking, aiOpen]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("roval-habits", JSON.stringify(habits));
    localStorage.setItem("roval-progress", JSON.stringify(progress));
    localStorage.setItem("roval-health-data", JSON.stringify(healthData));
    localStorage.setItem("roval-demo", String(demo));
    localStorage.setItem("roval-daily-goal", String(dailyGoal));
    localStorage.setItem("roval-weekly-goal", String(weeklyGoal));
    localStorage.setItem("roval-weekly-plan", weeklyPlan);
    localStorage.setItem("roval-notes", JSON.stringify(notes));
    localStorage.setItem("roval-display-name", displayName);
    localStorage.setItem("roval-gemini-model", model);
    if (!persistedOnceRef.current) persistedOnceRef.current = true;
    else if (applyingCloudRef.current) applyingCloudRef.current = false;
    else localStorage.setItem("roval-updated-at", new Date().toISOString());
  }, [habits, progress, healthData, demo, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, ready]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((user: { email?: string; displayName?: string } | null) => {
      if (!user || cancelled) return;
      setAccountEmail(user.email || "");
      setDisplayName((current) => current || user.displayName || "");
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      localStorage.setItem("roval-theme", theme);
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    if (!ready || typeof Notification === "undefined" || notificationPermission !== "granted") return;
    const checkReminders = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      habits.filter((habit) => habit.reminder === currentTime && isHabitScheduled(habit, now)).forEach((habit) => {
        const completed = progress[dateKey(now)]?.[habit.id] || 0;
        if (completed >= habit.target) return;
        const reminderKey = `roval-reminded-${dateKey(now)}-${habit.id}-${currentTime}`;
        if (localStorage.getItem(reminderKey)) return;
        localStorage.setItem(reminderKey, "1");
        new Notification(`A gentle nudge for ${habit.name}`, { body: completed > 0 ? `${completed} of ${habit.target} ${habit.unit} done — continue when it fits.` : `Ready when you are: ${habit.target} ${habit.unit}.`, icon: "/app-icon.svg", tag: reminderKey });
      });
    };
    checkReminders();
    const timer = window.setInterval(checkReminders, 30000);
    return () => window.clearInterval(timer);
  }, [habits, progress, ready, notificationPermission]);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  useEffect(() => {
    if (!ready || new URLSearchParams(window.location.search).get("view") !== "insights") return;
    window.setTimeout(() => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" }), 250);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const loadCloud = async () => {
      setSyncStatus("syncing");
      try {
        const response = await fetch("/api/sync", { cache: "no-store" });
        if (response.status === 401) {
          cloudEnabledRef.current = false;
          if (!cancelled) { setSyncStatus("local"); setCloudReady(true); }
          return;
        }
        if (!response.ok) throw new Error("Cloud load failed");
        const remote = await response.json() as { state: CloudState | null; revision: number; updatedAt: string | null };
        if (cancelled) return;
        syncRevisionRef.current = remote.revision || 0;
        const localUpdatedAt = localStorage.getItem("roval-updated-at") || "";
        if (remote.state && (!localUpdatedAt || (remote.updatedAt || "") > localUpdatedAt)) {
          applyingCloudRef.current = true;
          setHabits(withHabitStartDates(remote.state.habits, remote.state.progress));
          setProgress(remote.state.progress);
          setHealthData(remote.state.healthData || {});
          setDailyGoal(remote.state.dailyGoal);
          setWeeklyGoal(remote.state.weeklyGoal || 80);
          setWeeklyPlan(remote.state.weeklyPlan || "");
          setNotes(remote.state.notes || {});
          setDisplayName((current) => remote.state?.displayName || current);
          setModel(remote.state.model || "gemini-3.6-flash");
          setDemo(Boolean(remote.state.demo));
          if (remote.updatedAt) localStorage.setItem("roval-updated-at", remote.updatedAt);
        } else if (!remote.state || localUpdatedAt) {
          const updatedAt = localUpdatedAt || new Date().toISOString();
          const result = await putCloudState({ habits, progress, healthData, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo }, remote.revision || 0, deviceIdRef.current, updatedAt);
          if (result.response.ok && result.data.revision) syncRevisionRef.current = result.data.revision;
        }
        setSyncStatus("synced");
        setCloudReady(true);
      } catch {
        if (!cancelled) { setSyncStatus(navigator.onLine ? "local" : "offline"); setCloudReady(true); }
      }
    };
    void loadCloud();
    return () => { cancelled = true; };
  // Initial cloud reconciliation intentionally uses the state loaded from local storage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!ready || !cloudReady || !cloudEnabledRef.current) return;
    const timer = window.setTimeout(async () => {
      const updatedAt = new Date().toISOString();
      setSyncStatus("syncing");
      try {
        let result = await putCloudState({ habits, progress, healthData, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo }, syncRevisionRef.current, deviceIdRef.current, updatedAt);
        if (result.response.status === 409) {
          const latestResponse = await fetch("/api/sync", { cache: "no-store" });
          if (!latestResponse.ok) throw new Error("Conflict refresh failed");
          const latest = await latestResponse.json() as { state: CloudState | null; revision: number; updatedAt: string | null };
          const localUpdatedAt = localStorage.getItem("roval-updated-at") || updatedAt;
          if (latest.state && (latest.updatedAt || "") >= localUpdatedAt) {
            syncRevisionRef.current = latest.revision;
            applyingCloudRef.current = true;
            setHabits(withHabitStartDates(latest.state.habits, latest.state.progress));
            setProgress(latest.state.progress);
            setHealthData(latest.state.healthData || {});
            setDailyGoal(latest.state.dailyGoal);
            setWeeklyGoal(latest.state.weeklyGoal || 80);
            setWeeklyPlan(latest.state.weeklyPlan || "");
            setNotes(latest.state.notes || {});
            setDisplayName((current) => latest.state?.displayName || current);
            setModel(latest.state.model || "gemini-3.6-flash");
            setDemo(Boolean(latest.state.demo));
            if (latest.updatedAt) localStorage.setItem("roval-updated-at", latest.updatedAt);
            setToast("Updated with newer changes from another device");
            setSyncStatus("synced");
            return;
          }
          result = await putCloudState({ habits, progress, healthData, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo }, latest.revision, deviceIdRef.current, updatedAt);
        }
        if (!result.response.ok) throw new Error(result.data.error || "Sync failed");
        syncRevisionRef.current = result.data.revision || syncRevisionRef.current;
        localStorage.setItem("roval-updated-at", updatedAt);
        setSyncStatus("synced");
      } catch {
        setSyncStatus(navigator.onLine ? "local" : "offline");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [habits, progress, healthData, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo, ready, cloudReady]);

  const selectedKey = dateKey(selectedDate);
  const dayProgress = progress[selectedKey] || {};
  const visibleHealthData = useMemo(() => Object.keys(healthData).length ? healthData : demo ? buildHealthSeed() : {}, [healthData, demo]);
  const selectedHealth = visibleHealthData[selectedKey] || {};
  const healthDates = useMemo(() => Array.from({ length: healthRange }, (_, index) => shiftDate(selectedDate, index - healthRange + 1)), [selectedDate, healthRange]);
  const healthTrendValues = healthDates.map((date) => visibleHealthData[dateKey(date)]?.[healthMetric]);
  const healthTrendLabels = healthDates.map((date) => faNumber(persianParts(date).day));
  const healthMetricValues = healthTrendValues.filter((value): value is number => value !== undefined);
  const healthMetricAverage = healthMetricValues.length ? Math.round(healthMetricValues.reduce((sum, value) => sum + value, 0) / healthMetricValues.length) : undefined;
  const lightSleepMinutes = Math.max(0, (selectedHealth.sleepMinutes || 0) - (selectedHealth.deepSleepMinutes || 0) - (selectedHealth.remSleepMinutes || 0));
  const sleepTotal = selectedHealth.sleepMinutes || 0;
  const scheduledHabits = useMemo(() => habits.filter((habit) => isHabitScheduled(habit, selectedDate)), [habits, selectedDate]);
  const selectedScore = scoreForDay(selectedDate, habits, progress);
  const completedCount = scheduledHabits.filter((habit) => (dayProgress[habit.id] || 0) >= habit.target).length;
  const categories = useMemo(() => Array.from(new Set(scheduledHabits.map((habit) => habit.category))), [scheduledHabits]);
  const availableCategories = useMemo(() => Array.from(new Set([...STARTER_CATEGORIES, ...habits.map((habit) => habit.category)])), [habits]);
  const syncLabel: Record<SyncStatus, string> = { starting: "Connecting", syncing: "Syncing", synced: "Synced", offline: "Offline", local: "On device" };
  const currentStreak = overallStreak(habits, progress, dailyGoal);
  const loggedDays = Object.values(progress).filter((day) => Object.keys(day).length).length;
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => shiftDate(weekStart(selectedDate), index)), [selectedDate]);
  const weekScores = useMemo(() => weekDates.map((day) => scoreForDay(day, habits, progress)), [weekDates, habits, progress]);
  const observedWeekScores = weekScores.filter((_, index) => dateKey(weekDates[index]) <= dateKey(new Date()));
  const weekDayCount = observedWeekScores.length || 1;
  const weekAverage = Math.round(observedWeekScores.reduce((sum, score) => sum + score, 0) / weekDayCount);
  const weekTargetDays = observedWeekScores.filter((score) => score >= dailyGoal).length;

  const trend = useMemo(() => {
    if (trendRange === "14d") {
      const dates = Array.from({ length: 14 }, (_, index) => shiftDate(selectedDate, index - 13));
      return { values: dates.map((date) => scoreForDay(date, habits, progress)), labels: dates.map((date, index) => index % 2 === 0 ? faNumber(persianParts(date).day) : "") };
    }
    const values: number[] = [];
    const labels: string[] = [];
    for (let week = 7; week >= 0; week -= 1) {
      const scores = Array.from({ length: 7 }, (_, index) => scoreForDay(shiftDate(selectedDate, -(week * 7 + index)), habits, progress));
      values.push(Math.round(scores.reduce((sum, score) => sum + score, 0) / 7));
      labels.push(`W${8 - week}`);
    }
    return { values, labels };
  }, [trendRange, selectedDate, habits, progress]);

  const trendMessage = useMemo(() => {
    const split = Math.floor(trend.values.length / 2);
    const first = trend.values.slice(0, split);
    const second = trend.values.slice(split);
    const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const difference = Math.round(average(second) - average(first));
    const best = Math.max(...trend.values);
    const worst = Math.min(...trend.values);
    return `${difference >= 0 ? "Up" : "Down"} ${Math.abs(difference)} points versus the previous period. Highest: ${best}% · Lowest: ${worst}%.`;
  }, [trend]);

  const habitStats = useMemo(() => habits.map((habit) => {
    const dates = Array.from({ length: 30 }, (_, index) => shiftDate(new Date(), index - 29)).filter((date) => isHabitScheduled(habit, date));
    const values = dates.map((date) => progress[dateKey(date)]?.[habit.id] || 0);
    const percent = Math.round(values.reduce((sum, value) => sum + Math.min(value, habit.target), 0) / (habit.target * Math.max(1, dates.length)) * 100);
    const completeDays = values.filter((value) => value >= habit.target).length;
    return { habit, percent, completeDays, streak: streakForHabit(habit, progress) };
  }).sort((a, b) => b.percent - a.percent), [habits, progress]);

  const setHabitValue = (habit: Habit, nextValue: number) => {
    setProgress((current) => ({ ...current, [selectedKey]: { ...(current[selectedKey] || {}), [habit.id]: Math.max(0, Math.min(habit.target, nextValue)) } }));
  };

  const saveHabit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const target = Math.max(1, Math.min(50, Number(data.get("target")) || 1));
    const category = String(data.get("category") || "Other").trim() || "Other";
    const selectedDays = data.getAll("days").map(Number);
    const days = selectedDays.length === 7 || selectedDays.length === 0 ? undefined : selectedDays;
    const reminder = String(data.get("reminder") || "") || undefined;
    const weight = Math.max(1, Math.min(5, Number(data.get("weight")) || 1));
    if (editingHabit) {
      setHabits((current) => current.map((habit) => habit.id === editingHabit.id ? { ...habit, name: String(data.get("name")), unit: String(data.get("unit")), category, target, days: habit.endDate === habit.startDate ? undefined : days, reminder, weight } : habit));
    } else {
      const palette = PALETTE[habits.length % PALETTE.length];
      const oneDay = newHabitScope === "day";
      setHabits((current) => [...current, {
        id: `habit-${Date.now()}`, name: String(data.get("name")), unit: String(data.get("unit")), category, target,
        days: oneDay ? undefined : days, reminder, weight, startDate: selectedKey, endDate: oneDay ? selectedKey : undefined,
        color: palette[0], tint: palette[1], icon: CATEGORY_ICONS[category] || "·",
      }]);
    }
    setHabitModalOpen(false);
    setEditingHabit(null);
  };

  const saveHealthEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const numberValue = (name: string, minimum: number, maximum: number) => {
      const raw = String(data.get(name) || "").trim();
      return raw ? Math.max(minimum, Math.min(maximum, Number(raw))) : undefined;
    };
    const entry: HealthEntry = {
      steps: numberValue("steps", 0, 100000), calories: numberValue("calories", 0, 10000), activeMinutes: numberValue("activeMinutes", 0, 1440), workouts: numberValue("workouts", 0, 20),
      restingHeartRate: numberValue("restingHeartRate", 30, 220), hrv: numberValue("hrv", 1, 250), spo2: numberValue("spo2", 70, 100), stress: numberValue("stress", 0, 100),
      sleepMinutes: numberValue("sleepMinutes", 0, 1440), deepSleepMinutes: numberValue("deepSleepMinutes", 0, 720), remSleepMinutes: numberValue("remSleepMinutes", 0, 720), source: "manual",
    };
    if (!Object.entries(entry).some(([key, value]) => key !== "source" && value !== undefined)) { setToast("Enter at least one health value"); return; }
    if (entry.sleepMinutes !== undefined) {
      entry.deepSleepMinutes = Math.min(entry.deepSleepMinutes || 0, entry.sleepMinutes);
      entry.remSleepMinutes = Math.min(entry.remSleepMinutes || 0, Math.max(0, entry.sleepMinutes - (entry.deepSleepMinutes || 0)));
    }
    setHealthData((current) => ({ ...current, [selectedKey]: entry }));
    setHealthModalOpen(false);
    setToast("Health snapshot saved and synced");
  };

  const deleteHabitEverywhere = (habit: Habit) => {
    setHabits((current) => current.filter((item) => item.id !== habit.id));
    setProgress((current) => Object.fromEntries(Object.entries(current).map(([day, values]) => { const next = { ...values }; delete next[habit.id]; return [day, next]; })));
    setDeletingHabit(null);
    setToast(`“${habit.name}” deleted from the routine`);
  };

  const removeHabitFromSelectedDay = (habit: Habit) => {
    if (habit.startDate === selectedKey && habit.endDate === selectedKey) {
      deleteHabitEverywhere(habit);
      return;
    }
    setHabits((current) => current.map((item) => item.id === habit.id
      ? { ...item, excludedDates: Array.from(new Set([...(item.excludedDates || []), selectedKey])).sort() }
      : item));
    setProgress((current) => {
      if (!current[selectedKey]?.[habit.id]) return current;
      const nextDay = { ...current[selectedKey] };
      delete nextDay[habit.id];
      return { ...current, [selectedKey]: nextDay };
    });
    setDeletingHabit(null);
    setToast(`“${habit.name}” removed only from this day`);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ version: 6, habits, progress, healthData, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `roval-backup-${dateKey(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Backup exported");
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { habits?: Habit[]; progress?: Progress; healthData?: HealthData; dailyGoal?: number; weeklyGoal?: number; weeklyPlan?: string; notes?: DailyNotes; displayName?: string };
      if (!Array.isArray(data.habits) || !data.progress) throw new Error("Invalid backup");
      setHabits(withHabitStartDates(data.habits.map((habit) => ({ ...habit, category: habit.category || "Other" })), data.progress));
      setProgress(data.progress);
      setHealthData(data.healthData || {});
      if (data.dailyGoal) setDailyGoal(data.dailyGoal);
      if (data.weeklyGoal) setWeeklyGoal(data.weeklyGoal);
      if (typeof data.weeklyPlan === "string") setWeeklyPlan(data.weeklyPlan);
      if (data.notes) setNotes(data.notes);
      if (typeof data.displayName === "string") setDisplayName(data.displayName);
      setDemo(false);
      setToast("Backup imported");
    } catch { setToast("That file is not a valid Roval backup"); }
    event.target.value = "";
  };

  const importHuaweiHealth = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      const records: Array<{ date: string; entry: HealthEntry }> = [];
      for (const file of files) {
        const text = await file.text();
        if (file.name.toLowerCase().endsWith(".csv")) parseCsvRows(text).forEach((row) => { const result = normalizedHealthRecord(row); if (result) records.push(result); });
        else collectHuaweiRecords(JSON.parse(text), records);
      }
      if (!records.length) throw new Error("No daily records");
      const imported: HealthData = {};
      for (const { date, entry } of records) imported[date] = { ...(imported[date] || {}), ...entry, source: "huawei-import" };
      setHealthData((current) => ({ ...current, ...imported }));
      setDemo(false);
      setHuaweiModalOpen(false);
      setToast(`${Object.keys(imported).length} Huawei Health day${Object.keys(imported).length === 1 ? "" : "s"} imported and queued for sync`);
    } catch {
      setToast("No supported daily Huawei Health records were found. Use the included CSV template or extracted JSON files.");
    }
    event.target.value = "";
  };

  const downloadHuaweiTemplate = () => {
    const rows = [
      "date,steps,calories,activeMinutes,workouts,restingHeartRate,hrv,spo2,stress,sleepMinutes,deepSleepMinutes,remSleepMinutes",
      `${dateKey(new Date())},8000,520,45,1,62,48,97,34,450,85,95`,
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "roval-huawei-health-template.csv"; link.click(); URL.revokeObjectURL(url);
  };

  const saveSettings = () => {
    sessionStorage.setItem("roval-gemini-key", apiKey.trim());
    setSettingsOpen(false);
    setToast("Settings saved");
  };

  const syncNow = async () => {
    if (!cloudEnabledRef.current) {
      setToast("Cloud sync becomes available when you open the signed-in Roval site");
      return;
    }
    setSyncStatus("syncing");
    const updatedAt = new Date().toISOString();
    try {
      const result = await putCloudState({ habits, progress, healthData, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo }, syncRevisionRef.current, deviceIdRef.current, updatedAt);
      if (!result.response.ok) throw new Error("Sync failed");
      syncRevisionRef.current = result.data.revision || syncRevisionRef.current;
      localStorage.setItem("roval-updated-at", updatedAt);
      setSyncStatus("synced");
      setToast("All devices are up to date");
    } catch {
      setSyncStatus(navigator.onLine ? "local" : "offline");
      setToast("Saved on this device; cloud sync will retry after your next change");
    }
  };

  const requestReminders = async () => {
    if (typeof Notification === "undefined") { setToast("Notifications are not supported in this browser"); return; }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setToast(permission === "granted" ? "Habit reminders are enabled on this device" : "Notifications were not enabled");
  };

  const exportCsv = () => {
    const dates = Array.from({ length: 90 }, (_, index) => shiftDate(new Date(), index - 89));
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["Gregorian date", "Persian date", "Score", ...habits.map((habit) => habit.name)],
      ...dates.map((day) => [dateKey(day), fullPersianDate(day), `${scoreForDay(day, habits, progress)}%`, ...habits.map((habit) => progress[dateKey(day)]?.[habit.id] || 0)]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `roval-report-${dateKey(new Date())}.csv`; link.click(); URL.revokeObjectURL(url);
    setToast("90-day CSV report downloaded");
  };

  const printReport = () => {
    setReportsOpen(false);
    window.setTimeout(() => window.print(), 100);
  };

  const shareSummary = async () => {
    const best = habitStats[0];
    const summary = `My Roval weekly review\n${weekAverage}% average · ${weekTargetDays}/${weekDayCount} days reached my daily target${best ? `\nStrongest habit: ${best.habit.name} (${best.percent}% over 30 days)` : ""}${weeklyPlan ? `\nNext focus: ${weeklyPlan}` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: "My Roval weekly review", text: summary });
      else { await navigator.clipboard.writeText(summary); setToast("Weekly summary copied to share"); }
    } catch { setToast("Sharing was cancelled"); }
  };

  const cycleTheme = () => setTheme((current) => current === "light" ? "dark" : current === "dark" ? "system" : "light");

  const installApp = async () => {
    if (installed) { setToast("Roval is already installed"); return; }
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    setInstallGuideOpen(true);
  };

  const setCoachActionStatus = (messageId: string, status: CoachActionStatus) => {
    setChatMessages((current) => current.map((message) => message.id === messageId ? { ...message, actionStatus: status } : message));
  };

  const applyCoachAction = (message: ChatMessage, approvedAction?: CoachAction) => {
    const action = approvedAction || message.action;
    if (!action || message.actionStatus && message.actionStatus !== "pending") return;
    if (action.type === "add") {
      const palette = PALETTE[habits.length % PALETTE.length];
      const habit = action.habit;
      setHabits((current) => [...current, { id: `habit-${Date.now()}`, name: habit.name, unit: habit.unit, target: habit.target, category: habit.category, weight: habit.weight || 1, days: habit.days, reminder: habit.reminder, startDate: selectedKey, color: palette[0], tint: palette[1], icon: CATEGORY_ICONS[habit.category] || "·" }]);
      setCoachActionStatus(message.id, "applied");
      setToast(`“${habit.name}” was added and will sync to your devices`);
      return;
    }
    const existing = habits.find((habit) => habit.id === action.habitId);
    if (!existing) { setCoachActionStatus(message.id, "failed"); return; }
    setHabits((current) => current.map((habit) => {
      if (habit.id !== action.habitId) return habit;
      const changes = action.changes;
      return {
        ...habit,
        name: changes.name ?? habit.name,
        unit: changes.unit ?? habit.unit,
        target: changes.target ?? habit.target,
        category: changes.category ?? habit.category,
        weight: changes.weight ?? habit.weight,
        days: changes.days === null ? undefined : changes.days ?? habit.days,
        reminder: changes.reminder === null ? undefined : changes.reminder ?? habit.reminder,
      };
    }));
    setCoachActionStatus(message.id, "applied");
    setToast(`“${existing.name}” was updated and will sync to your devices`);
  };

  const dismissCoachAction = (messageId: string) => setCoachActionStatus(messageId, "dismissed");

  const askGemini = async (promptText?: string) => {
    const query = (promptText || question).trim();
    if (!query || asking) return;
    if (!apiKey.trim()) { setSettingsOpen(true); return; }
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text: query };
    const conversation = chatMessages.filter((message) => message.role !== "error").slice(-8).map((message) => `${message.role === "user" ? "User" : "Coach"}: ${message.text}`).join("\n");
    setChatMessages((current) => [...current, userMessage]);
    setQuestion("");
    setAsking(true);
    const recent = Array.from({ length: 14 }, (_, index) => { const day = shiftDate(selectedDate, index - 13); return { date: fullPersianDate(day), score: scoreForDay(day, habits, progress) }; });
    const recentHealth = Array.from({ length: 14 }, (_, index) => { const day = shiftDate(selectedDate, index - 13); return { date: fullPersianDate(day), ...(visibleHealthData[dateKey(day)] || {}) }; });
    const details = scheduledHabits.map((habit) => ({ id: habit.id, name: habit.name, category: habit.category, target: habit.target, unit: habit.unit, done: dayProgress[habit.id] || 0, importanceWeight: habit.weight || 1, days: habit.days || "every day", reminder: habit.reminder || null, startDate: habit.startDate || null }));
    const prompt = `Reply entirely in English. Give a complete, useful answer with concise bullets or short paragraphs when helpful. Explain the evidence behind your advice, mention meaningful tradeoffs, and finish with one specific next step. For recommendations, provide concrete options, why each fits my performance, and an easy starter target. Treat wearable health values as contextual estimates, not diagnoses.\n${conversation ? `Conversation so far:\n${conversation}\n` : ""}New question: ${query}\nDaily target: ${dailyGoal}%\nWeekly target: ${weeklyGoal}%\nScores use each habit's 1-5 importance weight.\nWeekly plan: ${weeklyPlan || "Not set"}\nLast 14 days: ${JSON.stringify(recent)}\nLast 14 days of optional health context: ${JSON.stringify(recentHealth)}\nCurrent habits and selected-day progress: ${JSON.stringify(details)}\nSelected-day note: ${notes[selectedKey] || "None"}`;
    try {
      const response = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: apiKey.trim(), model, prompt }) });
      const data = await response.json() as { text?: string; error?: string; suggestedAction?: unknown };
      if (!response.ok) throw new Error(data.error || `Gemini request failed (${response.status})`);
      if (!data.text) throw new Error("Gemini returned no answer");
      const action = normalizeCoachAction(data.suggestedAction);
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: data.text!, action, actionStatus: action ? "pending" : undefined }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not connect to Gemini";
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: "error", text: `${message}. Check your API key and selected model, then try again.` }]);
    }
    finally { setAsking(false); }
  };

  const resetAll = () => {
    if (!window.confirm("Reset all habits and progress? This cannot be undone.")) return;
    setHabits(withHabitStartDates(DEFAULT_HABITS, {})); setProgress({}); setHealthData({}); setNotes({}); setWeeklyPlan(""); setDemo(false); setToast("All data reset"); setSettingsOpen(false);
  };

  if (!ready) return <main className="loading">Roval is getting ready…</main>;

  return <main className="app-shell" dir="ltr">
    {profileOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setProfileOpen(false)}><section className="modal profile-modal"><div className="modal-head"><div><span className="eyebrow">MY PROFILE</span><h2>Your personal Roval space</h2></div><button className="icon-button" aria-label="Close" onClick={() => setProfileOpen(false)}>×</button></div><div className="account-badge"><span>{(displayName || accountEmail || "R").charAt(0).toUpperCase()}</span><div><b>{displayName || "Roval user"}</b><small>{accountEmail}</small></div></div><label>Display name<input value={displayName} maxLength={50} onChange={(event) => setDisplayName(event.target.value)} placeholder="What should Roval call you?" /></label><p className="account-privacy">Your habits, notes, progress, health snapshots, labels, and display name belong only to this signed-in account. Other users get a separate private tracker.</p><button className="primary-button wide" onClick={() => { setDisplayName((current) => current.trim()); setProfileOpen(false); setToast("Profile name saved and synced"); }}>Save profile</button><a className="signout-button" href="/signout-with-chatgpt?return_to=%2F">Sign out of this account</a></section></div>}
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">R</span><div><b>Roval</b><small>Calmer. Steadier.</small></div></div>
      <nav><button className="active"><span>⌂</span>Today</button><button onClick={() => setCalendarOpen(true)}><span>▦</span>Calendar</button><button onClick={() => setPlannerOpen(true)}><span>◎</span>Weekly plan</button><button onClick={() => document.getElementById("health")?.scrollIntoView({ behavior: "smooth" })}><span>♡</span>Health</button><button onClick={() => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" })}><span>⌁</span>Insights</button><button className="coach-nav-icon" onClick={() => setAiOpen(true)} aria-label="Open AI coach" title="Open AI coach"><span>✦</span><b>Coach</b></button></nav>
      <div className="sidebar-spacer" />
      <button className="side-setting side-profile" onClick={() => setProfileOpen(true)}><span className="mini-avatar">{(displayName || accountEmail || "R").charAt(0).toUpperCase()}</span><span>{displayName || "My profile"}<small>{accountEmail || "Signed-in account"}</small></span></button>
      <button className="side-setting" onClick={() => setSettingsOpen(true)}>⚙ Settings</button>
      <div className="privacy-note"><span>⌾</span><div><b>Local-first and cloud synced</b><small>Your signed-in devices stay up to date.</small></div></div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div><p dir="rtl">{fullPersianDate(selectedDate)}</p><h1>{dateKey(selectedDate) === dateKey(new Date()) ? `Shape your day${displayName ? `, ${displayName.split(" ")[0]}` : ""}` : "Review this day"}</h1></div>
        <div className="top-actions"><input ref={importRef} type="file" accept="application/json" hidden onChange={importData} /><button className={`theme-button ${theme}`} onClick={cycleTheme} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}>{theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}</button><button className={`sync-pill ${syncStatus}`} onClick={syncNow} title="Sync now"><i />{syncLabel[syncStatus]}</button><button className="ghost-button install-button" onClick={installApp}>{installed ? "✓ Installed" : "↓ Install app"}</button><button className="ghost-button data-button" onClick={() => importRef.current?.click()}>⇧ Import</button><button className="ghost-button data-button" onClick={exportData}>⇩ Export</button><button className="avatar" aria-label="Profile settings" onClick={() => setProfileOpen(true)}>{(displayName || accountEmail || "R").charAt(0).toUpperCase()}</button></div>
      </header>

      {demo && <div className="demo-banner"><span>Explore with 45 days of sample check-ins.</span><button onClick={() => { setProgress({}); setHabits((current) => current.map((habit) => ({ ...habit, startDate: dateKey(new Date()) }))); setDemo(false); }}>Start with my own data</button></div>}
      {toast && <button className="toast" onClick={() => setToast("")}>{toast}<span>×</span></button>}

      <section className="day-command">
        <div className="day-nav"><button onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} aria-label="Previous day">‹</button><div><small>{dateKey(selectedDate) === dateKey(new Date()) ? "TODAY" : "SELECTED DAY"}</small><b dir="rtl">{fullPersianDate(selectedDate)}</b></div><button onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} aria-label="Next day">›</button><button className="today-button" onClick={() => setSelectedDate(new Date())}>Today</button></div>
        <div className="daily-progress"><div><span>Daily progress</span><strong>{selectedScore}%</strong></div><div className="goal-track"><i style={{ width: `${selectedScore}%` }} /><em style={{ left: `${dailyGoal}%` }} /></div><small>{currentStreak} day streak above {dailyGoal}%</small></div>
      </section>

      <section className="stat-row">
        <article><ProgressRing value={selectedScore} /><div><span>Overall completion</span><b>{selectedScore >= dailyGoal ? "Daily target reached" : `${dailyGoal - selectedScore} points to target`}</b></div></article>
        <article><span className="stat-icon">✓</span><div><strong>{completedCount}/{scheduledHabits.length}</strong><span>Scheduled goals complete</span></div></article>
        <article><span className="stat-icon">↗</span><div><strong>{currentStreak}</strong><span>Current streak</span></div></article>
        <article><span className="stat-icon">▦</span><div><strong>{loggedDays}</strong><span>Days logged</span></div></article>
      </section>

      <section className="focus-grid">
        <article className="focus-card week-widget"><div><span className="eyebrow">WEEKLY QUICK VIEW</span><h2>{weekAverage}% average</h2><p>{weekTargetDays} of {weekDayCount} observed days reached {dailyGoal}% · weekly aim {weeklyGoal}%</p></div><div className="week-meter"><i style={{ width: `${weekAverage}%` }} /><em style={{ left: `${weeklyGoal}%` }} /></div><button onClick={() => setPlannerOpen(true)}>Plan this week →</button></article>
        <article className="focus-card note-card"><div><span className="eyebrow">DAY NOTE</span><h2>What shaped this day?</h2></div><textarea aria-label="Daily note" value={notes[selectedKey] || ""} onChange={(event) => setNotes((current) => ({ ...current, [selectedKey]: event.target.value }))} placeholder="Energy, obstacles, a small win…" rows={3} /></article>
        <article className="focus-card action-card"><span className="eyebrow">TOOLS</span><div><button onClick={() => setReportsOpen(true)}>▤ Reports</button><button onClick={shareSummary}>↗ Share review</button><button onClick={requestReminders}>◉ Reminders</button></div></article>
      </section>

      <div className="dashboard-grid">
        <section className="habits-panel">
          <div className="section-heading"><div><span className="eyebrow">{selectedKey === dateKey(new Date()) ? "TODAY'S ROUTINE" : "ROUTINE FOR SELECTED DAY"}</span><h2>{selectedKey < dateKey(new Date()) ? "Review and update this past day" : "Small steps, meaningful progress"}</h2></div><span>{completedCount} of {scheduledHabits.length} complete</span></div>
          <div className="habit-groups">{scheduledHabits.length === 0 && <div className="empty-routine"><b>No habits scheduled</b><span>Use this day to rest, or edit a habit&apos;s weekly schedule.</span></div>}{categories.map((category) => <section className="habit-group" key={category}><div className="group-label"><span>{CATEGORY_ICONS[category] || "·"}</span>{category}</div>{scheduledHabits.filter((habit) => habit.category === category).map((habit) => {
            const done = dayProgress[habit.id] || 0;
            const complete = done >= habit.target;
            return <article className={`habit-row${complete ? " complete" : ""}`} key={habit.id}>
              <div className="habit-icon" style={{ background: habit.tint, color: habit.color }}>{habit.icon}</div>
              <div className="habit-copy"><h3>{habit.name}{habit.startDate && habit.endDate === habit.startDate && <span className="one-day-badge">One-day plan</span>}</h3><p>{habit.target} {habit.unit}{habit.reminder ? ` · ${habit.reminder}` : ""} <span className="weight-badge" title="Importance in your weighted score">{habit.weight || 1}× weight</span></p></div>
              <div className="segments" aria-label={`Log ${habit.name}`}>{habit.target <= 12 ? Array.from({ length: habit.target }, (_, index) => <button key={index} aria-label={`${habit.name}: ${index + 1} of ${habit.target}`} className={index < done ? "filled" : ""} style={index < done ? { background: habit.color, borderColor: habit.color } : undefined} onClick={() => setHabitValue(habit, done >= index + 1 ? index : index + 1)} />) : <div className="stepper"><button onClick={() => setHabitValue(habit, done - 1)}>−</button><b>{done}</b><button onClick={() => setHabitValue(habit, done + 1)}>+</button></div>}</div>
              <strong className="habit-count">{done} of {habit.target}</strong>
              <div className="habit-actions"><button aria-label={`Edit ${habit.name}`} onClick={() => { setEditingHabit(habit); setHabitModalOpen(true); }}>✎</button><button aria-label={`Remove ${habit.name}`} onClick={() => setDeletingHabit(habit)}>×</button></div>
            </article>;
          })}</section>)}</div>
          <div className="add-habit-row"><button className="add-habit day" onClick={() => { setEditingHabit(null); setNewHabitScope("day"); setHabitModalOpen(true); }}>＋ Add for this day</button><button className="add-habit routine" onClick={() => { setEditingHabit(null); setNewHabitScope("routine"); setHabitModalOpen(true); }}>＋ Add recurring habit</button></div>
        </section>

        <CalendarCard key={`desktop-${persianParts(selectedDate).year}-${persianParts(selectedDate).month}`} className="desktop-calendar" selected={selectedDate} onSelect={setSelectedDate} habits={habits} progress={progress} dailyGoal={dailyGoal} />
      </div>

      <section className="health-dashboard" id="health">
        <div className="health-head"><div><span className="eyebrow">BAND 11 HEALTH</span><h2>Your body signals, separate from habits</h2><p>Read-only health context for the selected Persian-calendar day. These values never affect goals, streaks, or percentages.</p></div><div><span className="health-source-pill">{selectedHealth.source === "huawei" ? "Huawei sample" : selectedHealth.source === "huawei-import" ? "Huawei Health" : healthData[selectedKey] ? "Manual entry" : "No data"}</span><button className="health-log-button connect" onClick={() => setHuaweiModalOpen(true)}>⌁ Connect Huawei</button><button className="health-log-button" onClick={() => setHealthModalOpen(true)}>{healthData[selectedKey] ? "Edit health data" : "＋ Add health data"}</button></div></div>
        <div className="health-snapshot-grid">
          <article><span className="health-icon sleep">☾</span><div><small>SLEEP</small><strong>{formatHealthMinutes(selectedHealth.sleepMinutes)}</strong><p>{selectedHealth.deepSleepMinutes !== undefined ? `${formatHealthMinutes(selectedHealth.deepSleepMinutes)} deep` : "No sleep stages"}</p></div></article>
          <article><span className="health-icon heart">♥</span><div><small>RESTING HEART RATE</small><strong>{selectedHealth.restingHeartRate !== undefined ? `${selectedHealth.restingHeartRate} bpm` : "—"}</strong><p>Selected-day average</p></div></article>
          <article><span className="health-icon hrv">⌁</span><div><small>OVERNIGHT HRV</small><strong>{selectedHealth.hrv !== undefined ? `${selectedHealth.hrv} ms` : "—"}</strong><p>Recovery signal</p></div></article>
          <article><span className="health-icon oxygen">◌</span><div><small>BLOOD OXYGEN</small><strong>{selectedHealth.spo2 !== undefined ? `${selectedHealth.spo2}%` : "—"}</strong><p>SpO₂ snapshot</p></div></article>
          <article><span className="health-icon steps">↗</span><div><small>STEPS</small><strong>{selectedHealth.steps !== undefined ? selectedHealth.steps.toLocaleString() : "—"}</strong><p>{selectedHealth.activeMinutes !== undefined ? `${selectedHealth.activeMinutes} active min` : "No activity data"}</p></div></article>
          <article><span className="health-icon stress">◎</span><div><small>STRESS</small><strong>{selectedHealth.stress !== undefined ? `${selectedHealth.stress}/100` : "—"}</strong><p>Daily average</p></div></article>
        </div>
        <div className="health-detail-grid">
          <article className="health-trend-card"><div className="health-card-head"><div><span className="eyebrow">VITALS TREND</span><h3>{HEALTH_METRICS[healthMetric].label}</h3><p>{healthMetricAverage === undefined ? "No average yet" : `${healthRange}-day average: ${healthMetric === "sleepMinutes" ? formatHealthMinutes(healthMetricAverage) : `${healthMetricAverage.toLocaleString()} ${HEALTH_METRICS[healthMetric].unit}`}`}</p></div><div className="health-controls"><select aria-label="Health metric" value={healthMetric} onChange={(event) => setHealthMetric(event.target.value as HealthMetric)}>{(Object.keys(HEALTH_METRICS) as HealthMetric[]).map((metric) => <option key={metric} value={metric}>{HEALTH_METRICS[metric].label}</option>)}</select><div className="segmented"><button className={healthRange === 7 ? "active" : ""} onClick={() => setHealthRange(7)}>7 days</button><button className={healthRange === 30 ? "active" : ""} onClick={() => setHealthRange(30)}>30 days</button></div></div></div><HealthTrendChart values={healthTrendValues} labels={healthTrendLabels} metric={healthMetric} /></article>
          <div className="health-side-stack"><article className="sleep-composition-card"><div><span className="eyebrow">LAST NIGHT</span><h3>Sleep composition</h3></div>{sleepTotal ? <><div className="sleep-stage-bar"><i className="deep" style={{ width: `${((selectedHealth.deepSleepMinutes || 0) / sleepTotal) * 100}%` }} /><i className="rem" style={{ width: `${((selectedHealth.remSleepMinutes || 0) / sleepTotal) * 100}%` }} /><i className="light" style={{ width: `${(lightSleepMinutes / sleepTotal) * 100}%` }} /></div><dl><div><dt><i className="deep" />Deep</dt><dd>{formatHealthMinutes(selectedHealth.deepSleepMinutes)}</dd></div><div><dt><i className="rem" />REM</dt><dd>{formatHealthMinutes(selectedHealth.remSleepMinutes)}</dd></div><div><dt><i className="light" />Light</dt><dd>{formatHealthMinutes(lightSleepMinutes)}</dd></div></dl></> : <div className="health-mini-empty">Add sleep duration and stages to see the nightly composition.</div>}</article><article className="movement-card"><div><span className="eyebrow">MOVEMENT</span><h3>Daily totals</h3></div><dl><div><dt>Active time</dt><dd>{selectedHealth.activeMinutes !== undefined ? `${selectedHealth.activeMinutes} min` : "—"}</dd></div><div><dt>Active calories</dt><dd>{selectedHealth.calories !== undefined ? `${selectedHealth.calories} kcal` : "—"}</dd></div><div><dt>Workouts</dt><dd>{selectedHealth.workouts ?? "—"}</dd></div></dl><small>Observation only · never counted as a habit</small></article></div>
        </div>
        <button className="health-connection-note" onClick={() => setHuaweiModalOpen(true)}><span>⌁</span><div><b>Huawei Health bridge</b><p>{Object.values(healthData).some((entry) => entry.source === "huawei-import") ? "Huawei Health records are imported and synced with your Roval account. Import a newer export whenever you want to refresh them." : "Import Huawei Health data now, or review what is required for automatic account linking."}</p></div><small>Open connection</small></button>
      </section>

      <section className="analytics" id="analytics">
        <div className="analytics-grid">
          <article className="trend-card"><div className="card-head"><div><span className="eyebrow">PROGRESS TREND</span><h2>Your rhythm over time</h2></div><div className="segmented"><button className={trendRange === "14d" ? "active" : ""} onClick={() => setTrendRange("14d")}>14 days</button><button className={trendRange === "8w" ? "active" : ""} onClick={() => setTrendRange("8w")}>8 weeks</button></div></div><TrendChart values={trend.values} labels={trend.labels} goal={dailyGoal} /><p className="trend-summary"><b>Period insight:</b> {trendMessage}</p></article>
          <article className="habit-stats"><div className="card-head"><div><span className="eyebrow">30-DAY VIEW</span><h2>Each habit at a glance</h2></div></div><div>{habitStats.map(({ habit, percent, completeDays, streak }) => <section key={habit.id}><div><b>{habit.name}</b><strong>{percent}%</strong></div><div className="mini-meter"><i style={{ width: `${percent}%`, background: habit.color }} /></div><p>{completeDays} complete days{streak ? ` · ${streak}-day streak` : ""}</p></section>)}</div></article>
        </div>
      </section>

      <footer><span>Roval · Persian-calendar routines and health context</span><button onClick={() => setSettingsOpen(true)}>Data, AI & target settings</button></footer>
    </section>

    <nav className="mobile-nav"><button className="active">⌂<span>Today</span></button><button onClick={() => setCalendarOpen(true)}>▦<span>Calendar</span></button><button onClick={() => { setEditingHabit(null); setNewHabitScope("day"); setHabitModalOpen(true); }} className="mobile-add" aria-label="Add for selected day">＋</button><button onClick={() => document.getElementById("health")?.scrollIntoView({ behavior: "smooth" })}>♡<span>Health</span></button><button onClick={() => setAiOpen(true)}>✦<span>AI coach</span></button></nav>

    {calendarOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCalendarOpen(false)}><div className="mobile-calendar-wrap"><button className="modal-close" onClick={() => setCalendarOpen(false)}>×</button><CalendarCard key={`mobile-${persianParts(selectedDate).year}-${persianParts(selectedDate).month}`} selected={selectedDate} onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }} habits={habits} progress={progress} dailyGoal={dailyGoal} /></div></div>}

    {habitModalOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setHabitModalOpen(false)}><form className="modal habit-modal" key={`${editingHabit?.id || "new"}-${newHabitScope}`} onSubmit={saveHabit}><div className="modal-head"><div><span className="eyebrow">{editingHabit ? "EDIT ITEM" : newHabitScope === "day" ? "ONE-DAY PLAN" : "NEW HABIT"}</span><h2>{editingHabit ? "Tune this item" : newHabitScope === "day" ? "Plan something for this day" : "What would you like to track?"}</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setHabitModalOpen(false)}>×</button></div>{!editingHabit && <p className="habit-start-note"><b>{newHabitScope === "day" ? "Only on this selected day" : "Starts on the selected day"}</b><span dir="rtl">{fullPersianDate(selectedDate)}</span><small>{newHabitScope === "day" ? "This behaves like a planner task and will not repeat tomorrow." : "It will not appear on any earlier date."}</small></p>}<label>{newHabitScope === "day" && !editingHabit ? "Plan item" : "Habit name"}<input name="name" required defaultValue={editingHabit?.name || ""} placeholder={newHabitScope === "day" && !editingHabit ? "For example, submit the report" : "For example, practice a language"} autoFocus /></label><div className="form-row habit-basics"><label>Target<input name="target" type="number" min="1" max="50" defaultValue={editingHabit?.target || 1} /></label><label>Unit<input name="unit" defaultValue={editingHabit?.unit || "times"} placeholder="times, hours, pages…" /></label><label>Importance weight<select name="weight" defaultValue={editingHabit?.weight || 1}><option value="1">1× · Normal</option><option value="2">2× · Meaningful</option><option value="3">3× · Important</option><option value="4">4× · Very important</option><option value="5">5× · Highest priority</option></select><small className="weight-help">Higher weights contribute more to your daily and weekly percentage.</small></label></div><HabitLabelsAndReminder initialCategory={editingHabit?.category || "Personal"} initialReminder={editingHabit?.reminder} existingCategories={availableCategories} notificationPermission={notificationPermission} onEnableNotifications={requestReminders} />{(editingHabit ? !(editingHabit.startDate && editingHabit.endDate === editingHabit.startDate) : newHabitScope === "routine") && <fieldset className="schedule-field"><legend>Repeat on</legend><div>{WEEK_DAYS.map((day) => <label key={day.value}><input type="checkbox" name="days" value={day.value} defaultChecked={!editingHabit?.days?.length || editingHabit.days.includes(day.value)} /><span>{day.label}</span></label>)}</div><small>Leave every day selected for a daily habit.</small></fieldset>}<button className="primary-button wide" type="submit">{editingHabit ? "Save changes" : newHabitScope === "day" ? "Add to this day" : "Add to my routine"}</button></form></div>}
    {deletingHabit && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDeletingHabit(null)}><section className="modal delete-habit-modal"><div className="modal-head"><div><span className="eyebrow">REMOVE ITEM</span><h2>Where should “{deletingHabit.name}” be removed?</h2><p dir="rtl">{fullPersianDate(selectedDate)}</p></div><button className="icon-button" aria-label="Close" onClick={() => setDeletingHabit(null)}>×</button></div><div className="delete-scope-actions"><button className="delete-day-choice" onClick={() => removeHabitFromSelectedDay(deletingHabit)}><b>Only this day</b><span>Keep the habit and all other dates. This selected day becomes an exception.</span></button><button className="delete-all-choice" onClick={() => { if (window.confirm(`Delete “${deletingHabit.name}” everywhere and erase its history?`)) deleteHabitEverywhere(deletingHabit); }}><b>Delete everywhere</b><span>Remove the habit itself plus all of its recorded history.</span></button></div><button className="ghost-button wide" onClick={() => setDeletingHabit(null)}>Cancel</button></section></div>}

    {huaweiModalOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setHuaweiModalOpen(false)}><section className="modal huawei-modal"><div className="modal-head"><div><span className="eyebrow">HUAWEI HEALTH BRIDGE</span><h2>Bring Band 11 data into Roval</h2><p>Health data stays separate from habit scoring.</p></div><button className="icon-button" aria-label="Close" onClick={() => setHuaweiModalOpen(false)}>×</button></div><div className="huawei-flow"><article><span>1</span><div><b>Pair and sync your Band 11</b><p>Use Huawei Health on your phone, then sync the band so the latest readings reach Huawei Health before Roval tries to read or import them.</p></div></article><article><span>2</span><div><b>Available now: import a Huawei Health export</b><p>Request your Health data in Huawei Privacy Center, extract the downloaded ZIP, then choose its JSON files here. Roval also accepts a daily-summary CSV.</p><div className="huawei-actions"><input ref={huaweiImportRef} type="file" accept=".json,.csv,application/json,text/csv" multiple hidden onChange={importHuaweiHealth} /><button className="primary-button" onClick={() => huaweiImportRef.current?.click()}>Choose Huawei files</button><button onClick={downloadHuaweiTemplate}>Download CSV template</button></div></div></article><article><span>3</span><div><b>Android automatic route: Health Connect</b><p>Huawei Health can share supported fitness and sleep data to Android Health Connect. The Roval PWA cannot read Health Connect directly, so this route needs the planned native Android bridge. It can keep this same Roval interface while the Android layer reads approved records.</p></div></article><article><span>4</span><div><b>Cross-platform automatic route: Huawei Health Kit</b><p>Direct Huawei account syncing requires a Huawei developer app/service, approved Health Kit scopes, OAuth credentials, and secure server-side token storage. Once those credentials are issued, Roval can add Connect, Sync now, and Disconnect actions without storing secrets in the browser.</p><a href="https://developer.huawei.com/consumer/en/hms/huaweihealth/" target="_blank" rel="noreferrer">Open official Huawei Health Kit ↗</a></div></article></div><div className="huawei-data-list"><b>Roval health signals</b><span>Sleep & stages</span><span>Resting heart rate</span><span>HRV</span><span>SpO₂</span><span>Stress</span><span>Steps & activity</span></div><p className="huawei-privacy">Only values Roval recognizes are stored. File import works now; automatic Health Connect or Health Kit reading requires the corresponding native/provider authorization layer described above.</p></section></div>}

    {healthModalOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setHealthModalOpen(false)}><form className="modal health-modal" onSubmit={saveHealthEntry}><div className="modal-head"><div><span className="eyebrow">BAND 11 SNAPSHOT</span><h2>Add health data</h2><p dir="rtl">{fullPersianDate(selectedDate)}</p></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setHealthModalOpen(false)}>×</button></div><p className="health-modal-note">Enter only the values you can see in Huawei Health. They are stored as health context and never become habits.</p><fieldset><legend>Sleep & recovery</legend><div className="health-form-grid"><label>Total sleep (minutes)<input name="sleepMinutes" type="number" min="0" max="1440" defaultValue={healthData[selectedKey]?.sleepMinutes ?? ""} placeholder="450" /></label><label>Deep sleep (minutes)<input name="deepSleepMinutes" type="number" min="0" max="720" defaultValue={healthData[selectedKey]?.deepSleepMinutes ?? ""} placeholder="85" /></label><label>REM sleep (minutes)<input name="remSleepMinutes" type="number" min="0" max="720" defaultValue={healthData[selectedKey]?.remSleepMinutes ?? ""} placeholder="95" /></label><label>HRV (ms)<input name="hrv" type="number" min="1" max="250" defaultValue={healthData[selectedKey]?.hrv ?? ""} placeholder="48" /></label></div></fieldset><fieldset><legend>Heart & wellbeing</legend><div className="health-form-grid"><label>Resting heart rate (bpm)<input name="restingHeartRate" type="number" min="30" max="220" defaultValue={healthData[selectedKey]?.restingHeartRate ?? ""} placeholder="62" /></label><label>SpO₂ (%)<input name="spo2" type="number" min="70" max="100" step="0.1" defaultValue={healthData[selectedKey]?.spo2 ?? ""} placeholder="97" /></label><label>Stress average (0–100)<input name="stress" type="number" min="0" max="100" defaultValue={healthData[selectedKey]?.stress ?? ""} placeholder="34" /></label></div></fieldset><fieldset><legend>Movement</legend><div className="health-form-grid"><label>Steps<input name="steps" type="number" min="0" max="100000" defaultValue={healthData[selectedKey]?.steps ?? ""} placeholder="8000" /></label><label>Active calories (kcal)<input name="calories" type="number" min="0" max="10000" defaultValue={healthData[selectedKey]?.calories ?? ""} placeholder="520" /></label><label>Active time (minutes)<input name="activeMinutes" type="number" min="0" max="1440" defaultValue={healthData[selectedKey]?.activeMinutes ?? ""} placeholder="45" /></label><label>Workouts<input name="workouts" type="number" min="0" max="20" defaultValue={healthData[selectedKey]?.workouts ?? ""} placeholder="1" /></label></div></fieldset><div className="health-modal-actions"><button className="primary-button" type="submit">Save health snapshot</button>{healthData[selectedKey] && <button type="button" className="health-delete-button" onClick={() => { if (!window.confirm("Remove this day's health snapshot?")) return; setHealthData((current) => { const next = { ...current }; delete next[selectedKey]; return next; }); setHealthModalOpen(false); setToast("Health snapshot removed"); }}>Remove this day</button>}</div></form></div>}

    {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}><section className="modal settings-modal"><div className="modal-head"><div><span className="eyebrow">SETTINGS</span><h2>Targets, appearance, AI and data</h2></div><button className="icon-button" aria-label="Close" onClick={() => setSettingsOpen(false)}>×</button></div><label>Daily success target<input type="number" min="40" max="100" value={dailyGoal} onChange={(event) => setDailyGoal(Math.max(40, Math.min(100, Number(event.target.value))))} /></label><div className="theme-setting"><b>Appearance</b><div>{(["light", "dark", "system"] as ThemeMode[]).map((mode) => <button key={mode} className={theme === mode ? "active" : ""} onClick={() => setTheme(mode)}>{mode === "light" ? "☀ Light" : mode === "dark" ? "☾ Dark" : "◐ System"}</button>)}</div></div><div className="sync-panel"><div><span className={`sync-dot ${syncStatus}`} /><b>Cloud sync: {syncLabel[syncStatus]}</b><small>Habits, health snapshots, notes, plans, and settings sync between your phone and Windows.</small></div><button onClick={syncNow}>Sync now</button></div><div className="settings-shortcuts"><button onClick={requestReminders}>Enable reminders</button><button onClick={() => setReportsOpen(true)}>Open reports</button></div><button className="install-settings" onClick={installApp}>{installed ? "✓ Roval is installed" : "Install Roval on this device"}</button><div className="settings-rule" /><h3>Gemini connection</h3><p>Enter your API key from Google AI Studio. It stays only for this browser session and is never synced.</p><label>Gemini API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="AIza…" autoComplete="off" /></label><label>Model<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gemini-3.6-flash" /></label><button className="primary-button wide" onClick={saveSettings}>Save settings</button><div className="settings-data"><button onClick={exportData}>Export backup</button><button onClick={() => importRef.current?.click()}>Import backup</button><button className="danger" onClick={resetAll}>Reset all data</button></div></section></div>}

    {plannerOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPlannerOpen(false)}><section className="modal planner-modal"><div className="modal-head"><div><span className="eyebrow">WEEKLY PLANNER</span><h2>Choose a realistic focus</h2></div><button className="icon-button" aria-label="Close" onClick={() => setPlannerOpen(false)}>×</button></div><div className="planner-score"><strong>{weekAverage}%</strong><span>This week so far</span><p>{weekTargetDays} days reached your daily target.</p></div><label>Weekly success target<input type="number" min="40" max="100" value={weeklyGoal} onChange={(event) => setWeeklyGoal(Math.max(40, Math.min(100, Number(event.target.value))))} /></label><label>Weekly focus<textarea value={weeklyPlan} onChange={(event) => setWeeklyPlan(event.target.value)} placeholder="For example: protect three focused thesis sessions and keep workouts light." rows={5} /></label><div className="week-days-summary">{weekDates.map((day, index) => <div key={dateKey(day)} className={weekScores[index] >= dailyGoal ? "reached" : ""}><span>{WEEK_DAYS[index].label}</span><b>{weekScores[index]}%</b></div>)}</div><button className="primary-button wide" onClick={() => { setPlannerOpen(false); setToast("Weekly plan saved and synced"); }}>Save weekly plan</button></section></div>}

    {reportsOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setReportsOpen(false)}><section className="modal reports-modal"><div className="modal-head"><div><span className="eyebrow">REPORTS & ACCOUNTABILITY</span><h2>Take your progress with you</h2></div><button className="icon-button" aria-label="Close" onClick={() => setReportsOpen(false)}>×</button></div><div className="report-preview"><span>Current week</span><strong>{weekAverage}%</strong><p>{weekTargetDays}/7 target days · {loggedDays} total days logged</p></div><div className="report-actions"><button onClick={exportCsv}><b>↓ CSV report</b><span>90 days of scores and habit values</span></button><button onClick={printReport}><b>▤ Print / PDF</b><span>Use your browser&apos;s Save as PDF option</span></button><button onClick={shareSummary}><b>↗ Share weekly review</b><span>Send a concise summary to an accountability partner</span></button><button onClick={() => { setReportsOpen(false); setQuestion("Create a structured weekly performance review with wins, patterns, risks, and next-week priorities"); setAiOpen(true); }}><b>✦ Gemini report</b><span>Generate a deeper personalized review</span></button></div></section></div>}

    {installGuideOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInstallGuideOpen(false)}><section className="modal install-guide"><div className="modal-head"><div><span className="eyebrow">INSTALL ROVAL</span><h2>Use it like an app on every device</h2></div><button className="icon-button" aria-label="Close" onClick={() => setInstallGuideOpen(false)}>×</button></div><p>Install from this browser. Sign in with the same account on each device and your tracker will stay synced.</p><div className="install-steps"><article><b>Android</b><span>Open the browser menu, then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span></article><article><b>iPhone</b><span>Open in Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</span></article><article><b>Windows</b><span>In Edge or Chrome, open the browser menu and choose <strong>Install Roval</strong>.</span></article></div><button className="primary-button wide" onClick={() => setInstallGuideOpen(false)}>Got it</button></section></div>}

    {aiOpen && <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAiOpen(false)}><aside className="ai-drawer"><div className="modal-head"><div><span className="eyebrow">AI COACH</span><h2><span className="ai-orb">✦</span> Chat with Gemini</h2></div><div className="ai-head-actions">{chatMessages.length > 0 && <button className="clear-chat" disabled={asking} onClick={() => setChatMessages([])}>New chat</button>}<button className="icon-button" aria-label="Close" onClick={() => setAiOpen(false)}>×</button></div></div><div className="ai-summary"><span>Selected-day progress</span><strong>{selectedScore}%</strong><p>{completedCount} complete goals out of {scheduledHabits.length} scheduled · target {dailyGoal}%</p></div><p className="ai-intro">Ask for deeper analysis, or ask me to add or edit any habit setting. You can review and change the exact values before giving permission.</p><div className="quick-prompts"><button disabled={asking} onClick={() => askGemini("Create a structured weekly review with wins, patterns, risks, and next-week priorities")}>Weekly review</button><button disabled={asking} onClick={() => askGemini("Compare this week with the previous week")}>Compare my weeks</button><button disabled={asking} onClick={() => askGemini("Which habit needs the most attention and why?")}>My weakest habit?</button><button disabled={asking} onClick={() => askGemini("Help me add a useful habit based on my recent performance")}>Suggest a habit</button></div><div className="chat-thread" aria-live="polite">{chatMessages.length === 0 && !asking && <div className="chat-empty"><span>✦</span><b>Start a conversation</b><p>I can analyze your progress and—with your permission—add or edit habits.</p></div>}{chatMessages.map((message) => <article key={message.id} className={`chat-message ${message.role}${message.action ? " has-action" : ""}`}><span>{message.role === "user" ? "You" : message.role === "assistant" ? "Coach" : "Couldn’t send"}</span><p>{message.text}</p>{message.action && <CoachPermissionCard action={message.action} status={message.actionStatus} habits={habits} onAllow={(approvedAction) => applyCoachAction(message, approvedAction)} onDismiss={() => dismissCoachAction(message.id)} />}</article>)}{asking && <article className="chat-message assistant"><span>Coach</span><div className="thinking"><i /><i /><i /> Reviewing your data…</div></article>}<div ref={aiMessagesEndRef} /></div><div className="ai-compose"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void askGemini(); } }} placeholder="Ask about performance or habit changes…" rows={3} /><button type="button" aria-label="Send message" onClick={() => askGemini()} disabled={asking || !question.trim()}>↑</button></div><small className="compose-hint">Enter to send · Shift + Enter for a new line</small>{!apiKey && <button className="connect-link" onClick={() => { setAiOpen(false); setSettingsOpen(true); }}>Connect a Gemini key to begin →</button>}</aside></div>}
  </main>;
}
