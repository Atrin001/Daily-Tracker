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
};

type Progress = Record<string, Record<string, number>>;
type DailyNotes = Record<string, string>;

type CloudState = { habits: Habit[]; progress: Progress; dailyGoal: number; model: string; demo: boolean; notes?: DailyNotes; weeklyGoal?: number; weeklyPlan?: string; displayName?: string };
type SyncStatus = "starting" | "syncing" | "synced" | "offline" | "local";
type ThemeMode = "light" | "dark" | "system";
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

const isHabitScheduled = (habit: Habit, date: Date) => !habit.days?.length || habit.days.includes(date.getDay());

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

function scoreForDay(day: Date, habits: Habit[], progress: Progress) {
  const activeHabits = habits.filter((habit) => isHabitScheduled(habit, day));
  const values = progress[dateKey(day)] || {};
  const achieved = activeHabits.reduce((sum, habit) => sum + Math.min(values[habit.id] || 0, habit.target), 0);
  const target = activeHabits.reduce((sum, habit) => sum + habit.target, 0) || 1;
  return Math.round((achieved / target) * 100);
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
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${padX},${height - padY} ${polyline} ${width - padX},${height - padY}`;
  const goalY = height - padY - (goal / 100) * (height - padY * 2);
  return <div className="chart-wrap">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Progress trend chart">
      {[25, 50, 75, 100].map((tick) => { const y = height - padY - (tick / 100) * (height - padY * 2); return <line key={tick} className="grid-line" x1={padX} x2={width - padX} y1={y} y2={y} />; })}
      <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#167f74" stopOpacity=".22" /><stop offset="1" stopColor="#167f74" stopOpacity="0" /></linearGradient></defs>
      <line className="goal-line" x1={padX} x2={width - padX} y1={goalY} y2={goalY} />
      <polygon points={area} fill="url(#chartFill)" />
      <polyline points={polyline} fill="none" stroke="#167f74" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#167f74" strokeWidth="3" />)}
    </svg>
    <div className="chart-labels">{labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
  </div>;
}

function CalendarCard({ selected, onSelect, habits, progress, dailyGoal, className = "" }: {
  selected: Date; onSelect: (date: Date) => void; habits: Habit[]; progress: Progress; dailyGoal: number; className?: string;
}) {
  const dates = monthDates(selected);
  const first = dates[0];
  const leading = (first.getDay() + 1) % 7;
  const logged = dates.filter((date) => progress[dateKey(date)]).filter((date) => Object.keys(progress[dateKey(date)] || {}).length > 0);
  const scores = logged.map((date) => scoreForDay(date, habits, progress));
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const aboveGoal = scores.filter((score) => score >= dailyGoal).length;
  const bestIndex = scores.length ? scores.indexOf(Math.max(...scores)) : -1;
  const bestDate = bestIndex >= 0 ? logged[bestIndex] : null;
  const title = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "numeric" }).format(selected);
  return <section className={`calendar-card ${className}`} aria-label="Persian calendar">
    <div className="calendar-head"><div><span className="eyebrow">PERSIAN CALENDAR</span><h2 dir="rtl">{title}</h2></div><div><button aria-label="Previous month" onClick={() => onSelect(shiftDate(first, -1))}>‹</button><button aria-label="Next month" onClick={() => onSelect(shiftDate(dates[dates.length - 1], 1))}>›</button></div></div>
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
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
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
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [aiError, setAiError] = useState("");
  const [toast, setToast] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("starting");
  const [cloudReady, setCloudReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)));
  const importRef = useRef<HTMLInputElement>(null);
  const syncRevisionRef = useRef(0);
  const applyingCloudRef = useRef(false);
  const persistedOnceRef = useRef(false);
  const cloudEnabledRef = useRef(true);
  const deviceIdRef = useRef("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedHabits = localStorage.getItem("roval-habits");
      const storedHabits = savedHabits ? JSON.parse(savedHabits) as Habit[] : DEFAULT_HABITS;
      const nextHabits = storedHabits.map((habit) => {
        const builtIn = DEFAULT_HABITS.find((item) => item.id === habit.id);
        return builtIn ? { ...habit, name: builtIn.name, unit: builtIn.unit, category: habit.category || builtIn.category } : { ...habit, category: habit.category || "Other" };
      });
      const savedProgress = localStorage.getItem("roval-progress");
      const savedDemo = localStorage.getItem("roval-demo") !== "false";
      const parsedProgress = savedProgress ? JSON.parse(savedProgress) as Progress : {};
      setHabits(nextHabits);
      setProgress(savedDemo && Object.keys(parsedProgress).length < 30 ? buildSeed(nextHabits) : Object.keys(parsedProgress).length ? parsedProgress : buildSeed(nextHabits));
      setDemo(savedDemo);
      setDailyGoal(Number(localStorage.getItem("roval-daily-goal")) || 80);
      setWeeklyGoal(Number(localStorage.getItem("roval-weekly-goal")) || 80);
      setWeeklyPlan(localStorage.getItem("roval-weekly-plan") || "");
      setNotes(JSON.parse(localStorage.getItem("roval-notes") || "{}") as DailyNotes);
      setDisplayName(localStorage.getItem("roval-display-name") || "");
      setApiKey(sessionStorage.getItem("roval-gemini-key") || "");
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
    localStorage.setItem("roval-habits", JSON.stringify(habits));
    localStorage.setItem("roval-progress", JSON.stringify(progress));
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
  }, [habits, progress, demo, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, ready]);

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
          setHabits(remote.state.habits);
          setProgress(remote.state.progress);
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
          const result = await putCloudState({ habits, progress, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo }, remote.revision || 0, deviceIdRef.current, updatedAt);
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
        let result = await putCloudState({ habits, progress, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo }, syncRevisionRef.current, deviceIdRef.current, updatedAt);
        if (result.response.status === 409) {
          const latestResponse = await fetch("/api/sync", { cache: "no-store" });
          if (!latestResponse.ok) throw new Error("Conflict refresh failed");
          const latest = await latestResponse.json() as { state: CloudState | null; revision: number; updatedAt: string | null };
          const localUpdatedAt = localStorage.getItem("roval-updated-at") || updatedAt;
          if (latest.state && (latest.updatedAt || "") >= localUpdatedAt) {
            syncRevisionRef.current = latest.revision;
            applyingCloudRef.current = true;
            setHabits(latest.state.habits);
            setProgress(latest.state.progress);
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
          result = await putCloudState({ habits, progress, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo }, latest.revision, deviceIdRef.current, updatedAt);
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
  }, [habits, progress, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo, ready, cloudReady]);

  const selectedKey = dateKey(selectedDate);
  const dayProgress = progress[selectedKey] || {};
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
    if (editingHabit) {
      setHabits((current) => current.map((habit) => habit.id === editingHabit.id ? { ...habit, name: String(data.get("name")), unit: String(data.get("unit")), category, target, days, reminder } : habit));
    } else {
      const palette = PALETTE[habits.length % PALETTE.length];
      setHabits((current) => [...current, { id: `habit-${Date.now()}`, name: String(data.get("name")), unit: String(data.get("unit")), category, target, days, reminder, color: palette[0], tint: palette[1], icon: CATEGORY_ICONS[category] || "·" }]);
    }
    setHabitModalOpen(false);
    setEditingHabit(null);
  };

  const deleteHabit = (habit: Habit) => {
    if (!window.confirm(`Delete “${habit.name}” and its history?`)) return;
    setHabits((current) => current.filter((item) => item.id !== habit.id));
    setProgress((current) => Object.fromEntries(Object.entries(current).map(([day, values]) => { const next = { ...values }; delete next[habit.id]; return [day, next]; })));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ version: 4, habits, progress, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
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
      const data = JSON.parse(await file.text()) as { habits?: Habit[]; progress?: Progress; dailyGoal?: number; weeklyGoal?: number; weeklyPlan?: string; notes?: DailyNotes; displayName?: string };
      if (!Array.isArray(data.habits) || !data.progress) throw new Error("Invalid backup");
      setHabits(data.habits.map((habit) => ({ ...habit, category: habit.category || "Other" })));
      setProgress(data.progress);
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
      const result = await putCloudState({ habits, progress, dailyGoal, weeklyGoal, weeklyPlan, notes, displayName, model, demo }, syncRevisionRef.current, deviceIdRef.current, updatedAt);
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

  const askGemini = async (promptText?: string) => {
    const query = (promptText || question).trim();
    if (!query) return;
    if (!apiKey.trim()) { setSettingsOpen(true); return; }
    setQuestion(query); setAsking(true); setAiError(""); setAnswer("");
    const recent = Array.from({ length: 14 }, (_, index) => { const day = shiftDate(selectedDate, index - 13); return { date: fullPersianDate(day), score: scoreForDay(day, habits, progress) }; });
    const details = scheduledHabits.map((habit) => ({ goal: habit.name, category: habit.category, target: `${habit.target} ${habit.unit}`, done: dayProgress[habit.id] || 0, reminder: habit.reminder || null }));
    const prompt = `You are a kind, realistic productivity coach. Reply briefly and entirely in English. Avoid guilt or judgment.\nQuestion: ${query}\nDaily target: ${dailyGoal}%\nWeekly target: ${weeklyGoal}%\nWeekly plan: ${weeklyPlan || "Not set"}\nLast 14 days: ${JSON.stringify(recent)}\nSelected day: ${JSON.stringify(details)}\nSelected-day note: ${notes[selectedKey] || "None"}\nEnd with exactly one small, specific action for tomorrow.`;
    try {
      const response = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: apiKey.trim(), model, prompt }) });
      if (!response.ok) throw new Error(`Gemini ${response.status}`);
      const data = await response.json();
      if (!data?.text) throw new Error("No response");
      setAnswer(data.text);
    } catch { setAiError("Could not connect to Gemini. Check your API key and model name."); }
    finally { setAsking(false); }
  };

  const resetAll = () => {
    if (!window.confirm("Reset all habits and progress? This cannot be undone.")) return;
    setHabits(DEFAULT_HABITS); setProgress({}); setNotes({}); setWeeklyPlan(""); setDemo(false); setToast("All data reset"); setSettingsOpen(false);
  };

  if (!ready) return <main className="loading">Roval is getting ready…</main>;

  return <main className="app-shell" dir="ltr">
    {profileOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setProfileOpen(false)}><section className="modal profile-modal"><div className="modal-head"><div><span className="eyebrow">MY PROFILE</span><h2>Your personal Roval space</h2></div><button className="icon-button" aria-label="Close" onClick={() => setProfileOpen(false)}>×</button></div><div className="account-badge"><span>{(displayName || accountEmail || "R").charAt(0).toUpperCase()}</span><div><b>{displayName || "Roval user"}</b><small>{accountEmail}</small></div></div><label>Display name<input value={displayName} maxLength={50} onChange={(event) => setDisplayName(event.target.value)} placeholder="What should Roval call you?" /></label><p className="account-privacy">Your habits, notes, progress, labels, and display name belong only to this signed-in account. Other users get a separate private tracker.</p><button className="primary-button wide" onClick={() => { setDisplayName((current) => current.trim()); setProfileOpen(false); setToast("Profile name saved and synced"); }}>Save profile</button><a className="signout-button" href="/signout-with-chatgpt?return_to=%2F">Sign out of this account</a></section></div>}
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">R</span><div><b>Roval</b><small>Calmer. Steadier.</small></div></div>
      <nav><button className="active"><span>⌂</span>Today</button><button onClick={() => setCalendarOpen(true)}><span>▦</span>Calendar</button><button onClick={() => setPlannerOpen(true)}><span>◎</span>Weekly plan</button><button onClick={() => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" })}><span>⌁</span>Insights</button><button onClick={() => setAiOpen(true)}><span>✦</span>AI coach<i>AI</i></button></nav>
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

      {demo && <div className="demo-banner"><span>Explore with 45 days of sample check-ins.</span><button onClick={() => { setProgress({}); setDemo(false); }}>Start with my own data</button></div>}
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
          <div className="section-heading"><div><span className="eyebrow">TODAY&apos;S ROUTINE</span><h2>Small steps, meaningful progress</h2></div><span>{completedCount} of {scheduledHabits.length} complete</span></div>
          <div className="habit-groups">{scheduledHabits.length === 0 && <div className="empty-routine"><b>No habits scheduled</b><span>Use this day to rest, or edit a habit&apos;s weekly schedule.</span></div>}{categories.map((category) => <section className="habit-group" key={category}><div className="group-label"><span>{CATEGORY_ICONS[category] || "·"}</span>{category}</div>{scheduledHabits.filter((habit) => habit.category === category).map((habit) => {
            const done = dayProgress[habit.id] || 0;
            const complete = done >= habit.target;
            return <article className={`habit-row${complete ? " complete" : ""}`} key={habit.id}>
              <div className="habit-icon" style={{ background: habit.tint, color: habit.color }}>{habit.icon}</div>
              <div className="habit-copy"><h3>{habit.name}</h3><p>{habit.target} {habit.unit}{habit.reminder ? ` · ${habit.reminder}` : ""}</p></div>
              <div className="segments" aria-label={`Log ${habit.name}`}>{habit.target <= 12 ? Array.from({ length: habit.target }, (_, index) => <button key={index} aria-label={`${habit.name}: ${index + 1} of ${habit.target}`} className={index < done ? "filled" : ""} style={index < done ? { background: habit.color, borderColor: habit.color } : undefined} onClick={() => setHabitValue(habit, done >= index + 1 ? index : index + 1)} />) : <div className="stepper"><button onClick={() => setHabitValue(habit, done - 1)}>−</button><b>{done}</b><button onClick={() => setHabitValue(habit, done + 1)}>+</button></div>}</div>
              <strong className="habit-count">{done} of {habit.target}</strong>
              <div className="habit-actions"><button aria-label={`Edit ${habit.name}`} onClick={() => { setEditingHabit(habit); setHabitModalOpen(true); }}>✎</button><button aria-label={`Delete ${habit.name}`} onClick={() => deleteHabit(habit)}>×</button></div>
            </article>;
          })}</section>)}</div>
          <button className="add-habit" onClick={() => { setEditingHabit(null); setHabitModalOpen(true); }}>＋ Add habit</button>
        </section>

        <CalendarCard className="desktop-calendar" selected={selectedDate} onSelect={setSelectedDate} habits={habits} progress={progress} dailyGoal={dailyGoal} />
      </div>

      <section className="analytics" id="analytics">
        <div className="analytics-grid">
          <article className="trend-card"><div className="card-head"><div><span className="eyebrow">PROGRESS TREND</span><h2>Your rhythm over time</h2></div><div className="segmented"><button className={trendRange === "14d" ? "active" : ""} onClick={() => setTrendRange("14d")}>14 days</button><button className={trendRange === "8w" ? "active" : ""} onClick={() => setTrendRange("8w")}>8 weeks</button></div></div><TrendChart values={trend.values} labels={trend.labels} goal={dailyGoal} /><p className="trend-summary"><b>Period insight:</b> {trendMessage}</p></article>
          <article className="habit-stats"><div className="card-head"><div><span className="eyebrow">30-DAY VIEW</span><h2>Each habit at a glance</h2></div></div><div>{habitStats.map(({ habit, percent, completeDays, streak }) => <section key={habit.id}><div><b>{habit.name}</b><strong>{percent}%</strong></div><div className="mini-meter"><i style={{ width: `${percent}%`, background: habit.color }} /></div><p>{completeDays} complete days{streak ? ` · ${streak}-day streak` : ""}</p></section>)}</div></article>
        </div>
      </section>

      <section className="ai-banner"><div className="ai-orb">✦</div><div><span className="eyebrow">GEMINI 3.6 COACH</span><h2>Turn your activity into a useful next step</h2><p>Ask about patterns, compare weeks, or build a realistic plan for your thesis.</p></div><div className="ai-banner-actions"><button onClick={() => { setQuestion("Compare this week with the previous week"); setAiOpen(true); }}>Compare my weeks</button><button className="primary-button" onClick={() => setAiOpen(true)}>Open AI coach →</button></div></section>
      <footer><span>Roval · Persian-calendar routine tracking</span><button onClick={() => setSettingsOpen(true)}>Data, AI & target settings</button></footer>
    </section>

    <nav className="mobile-nav"><button className="active">⌂<span>Today</span></button><button onClick={() => setCalendarOpen(true)}>▦<span>Calendar</span></button><button onClick={() => { setEditingHabit(null); setHabitModalOpen(true); }} className="mobile-add">＋</button><button onClick={() => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" })}>⌁<span>Insights</span></button><button onClick={() => setAiOpen(true)}>✦<span>AI coach</span></button></nav>

    {calendarOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCalendarOpen(false)}><div className="mobile-calendar-wrap"><button className="modal-close" onClick={() => setCalendarOpen(false)}>×</button><CalendarCard selected={selectedDate} onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }} habits={habits} progress={progress} dailyGoal={dailyGoal} /></div></div>}

    {habitModalOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setHabitModalOpen(false)}><form className="modal habit-modal" key={editingHabit?.id || "new"} onSubmit={saveHabit}><div className="modal-head"><div><span className="eyebrow">{editingHabit ? "EDIT HABIT" : "NEW HABIT"}</span><h2>{editingHabit ? "Tune this habit" : "What would you like to track?"}</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setHabitModalOpen(false)}>×</button></div><label>Habit name<input name="name" required defaultValue={editingHabit?.name || ""} placeholder="For example, practice a language" autoFocus /></label><div className="form-row"><label>Daily target<input name="target" type="number" min="1" max="50" defaultValue={editingHabit?.target || 1} /></label><label>Unit<input name="unit" defaultValue={editingHabit?.unit || "times"} placeholder="times, hours, pages…" /></label></div><HabitLabelsAndReminder initialCategory={editingHabit?.category || "Personal"} initialReminder={editingHabit?.reminder} existingCategories={availableCategories} notificationPermission={notificationPermission} onEnableNotifications={requestReminders} /><fieldset className="schedule-field"><legend>Repeat on</legend><div>{WEEK_DAYS.map((day) => <label key={day.value}><input type="checkbox" name="days" value={day.value} defaultChecked={!editingHabit?.days?.length || editingHabit.days.includes(day.value)} /><span>{day.label}</span></label>)}</div><small>Leave every day selected for a daily habit.</small></fieldset><button className="primary-button wide" type="submit">{editingHabit ? "Save changes" : "Add to my routine"}</button></form></div>}

    {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}><section className="modal settings-modal"><div className="modal-head"><div><span className="eyebrow">SETTINGS</span><h2>Targets, appearance, AI and data</h2></div><button className="icon-button" aria-label="Close" onClick={() => setSettingsOpen(false)}>×</button></div><label>Daily success target<input type="number" min="40" max="100" value={dailyGoal} onChange={(event) => setDailyGoal(Math.max(40, Math.min(100, Number(event.target.value))))} /></label><div className="theme-setting"><b>Appearance</b><div>{(["light", "dark", "system"] as ThemeMode[]).map((mode) => <button key={mode} className={theme === mode ? "active" : ""} onClick={() => setTheme(mode)}>{mode === "light" ? "☀ Light" : mode === "dark" ? "☾ Dark" : "◐ System"}</button>)}</div></div><div className="sync-panel"><div><span className={`sync-dot ${syncStatus}`} /><b>Cloud sync: {syncLabel[syncStatus]}</b><small>Habits, schedules, notes, plans, and settings sync between your phone and Windows.</small></div><button onClick={syncNow}>Sync now</button></div><div className="settings-shortcuts"><button onClick={requestReminders}>Enable reminders</button><button onClick={() => setReportsOpen(true)}>Open reports</button></div><button className="install-settings" onClick={installApp}>{installed ? "✓ Roval is installed" : "Install Roval on this device"}</button><div className="settings-rule" /><h3>Gemini connection</h3><p>Enter your API key from Google AI Studio. It stays only for this browser session and is never synced.</p><label>Gemini API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="AIza…" autoComplete="off" /></label><label>Model<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gemini-3.6-flash" /></label><button className="primary-button wide" onClick={saveSettings}>Save settings</button><div className="settings-data"><button onClick={exportData}>Export backup</button><button onClick={() => importRef.current?.click()}>Import backup</button><button className="danger" onClick={resetAll}>Reset all data</button></div></section></div>}

    {plannerOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPlannerOpen(false)}><section className="modal planner-modal"><div className="modal-head"><div><span className="eyebrow">WEEKLY PLANNER</span><h2>Choose a realistic focus</h2></div><button className="icon-button" aria-label="Close" onClick={() => setPlannerOpen(false)}>×</button></div><div className="planner-score"><strong>{weekAverage}%</strong><span>This week so far</span><p>{weekTargetDays} days reached your daily target.</p></div><label>Weekly success target<input type="number" min="40" max="100" value={weeklyGoal} onChange={(event) => setWeeklyGoal(Math.max(40, Math.min(100, Number(event.target.value))))} /></label><label>Weekly focus<textarea value={weeklyPlan} onChange={(event) => setWeeklyPlan(event.target.value)} placeholder="For example: protect three focused thesis sessions and keep workouts light." rows={5} /></label><div className="week-days-summary">{weekDates.map((day, index) => <div key={dateKey(day)} className={weekScores[index] >= dailyGoal ? "reached" : ""}><span>{WEEK_DAYS[index].label}</span><b>{weekScores[index]}%</b></div>)}</div><button className="primary-button wide" onClick={() => { setPlannerOpen(false); setToast("Weekly plan saved and synced"); }}>Save weekly plan</button></section></div>}

    {reportsOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setReportsOpen(false)}><section className="modal reports-modal"><div className="modal-head"><div><span className="eyebrow">REPORTS & ACCOUNTABILITY</span><h2>Take your progress with you</h2></div><button className="icon-button" aria-label="Close" onClick={() => setReportsOpen(false)}>×</button></div><div className="report-preview"><span>Current week</span><strong>{weekAverage}%</strong><p>{weekTargetDays}/7 target days · {loggedDays} total days logged</p></div><div className="report-actions"><button onClick={exportCsv}><b>↓ CSV report</b><span>90 days of scores and habit values</span></button><button onClick={printReport}><b>▤ Print / PDF</b><span>Use your browser&apos;s Save as PDF option</span></button><button onClick={shareSummary}><b>↗ Share weekly review</b><span>Send a concise summary to an accountability partner</span></button><button onClick={() => { setReportsOpen(false); setQuestion("Create a structured weekly performance review with wins, patterns, risks, and next-week priorities"); setAiOpen(true); }}><b>✦ Gemini report</b><span>Generate a deeper personalized review</span></button></div></section></div>}

    {installGuideOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInstallGuideOpen(false)}><section className="modal install-guide"><div className="modal-head"><div><span className="eyebrow">INSTALL ROVAL</span><h2>Use it like an app on every device</h2></div><button className="icon-button" aria-label="Close" onClick={() => setInstallGuideOpen(false)}>×</button></div><p>Install from this browser. Sign in with the same account on each device and your tracker will stay synced.</p><div className="install-steps"><article><b>Android</b><span>Open the browser menu, then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span></article><article><b>iPhone</b><span>Open in Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</span></article><article><b>Windows</b><span>In Edge or Chrome, open the browser menu and choose <strong>Install Roval</strong>.</span></article></div><button className="primary-button wide" onClick={() => setInstallGuideOpen(false)}>Got it</button></section></div>}

    {aiOpen && <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAiOpen(false)}><aside className="ai-drawer"><div className="modal-head"><div><span className="eyebrow">AI COACH</span><h2><span className="ai-orb">✦</span> Analyze with Gemini</h2></div><button className="icon-button" aria-label="Close" onClick={() => setAiOpen(false)}>×</button></div><div className="ai-summary"><span>Selected-day progress</span><strong>{selectedScore}%</strong><p>{completedCount} complete goals out of {scheduledHabits.length} scheduled · target {dailyGoal}%</p></div><p className="ai-intro">I can use your schedules, notes, weekly plan, and performance history to find patterns and suggest one realistic adjustment.</p><div className="quick-prompts"><button onClick={() => askGemini("Create a structured weekly review with wins, patterns, risks, and next-week priorities")}>Weekly review</button><button onClick={() => askGemini("Compare this week with the previous week")}>Compare my weeks</button><button onClick={() => askGemini("Which habit needs the most attention and why?")}>My weakest habit?</button><button onClick={() => askGemini("Build a realistic weekly plan for my thesis")}>Plan my thesis week</button></div>{(asking || answer || aiError) && <div className="ai-answer">{asking ? <div className="thinking"><i /><i /><i /> Reviewing your data…</div> : aiError ? <p className="error">{aiError}</p> : <p>{answer}</p>}</div>}<div className="ai-compose"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about my performance…" rows={4} /><button onClick={() => askGemini()} disabled={asking}>↑</button></div>{!apiKey && <button className="connect-link" onClick={() => { setAiOpen(false); setSettingsOpen(true); }}>Connect a Gemini key to begin →</button>}</aside></div>}
  </main>;
}
