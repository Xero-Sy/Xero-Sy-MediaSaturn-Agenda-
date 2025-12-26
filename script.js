import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const elMonthYear = document.getElementById("monthYear");
const elPrev = document.getElementById("prevMonth");
const elNext = document.getElementById("nextMonth");
const elDow = document.getElementById("dowRow");
const elCal = document.getElementById("calendar");

const elPanel = document.getElementById("dayPanel");
const elClosePanel = document.getElementById("closePanelBtn");
const elSelectedDate = document.getElementById("selectedDate");
const elAvail = document.getElementById("availableToggle");
const elStart = document.getElementById("startTime");
const elEnd = document.getElementById("endTime");
const elNote = document.getElementById("myNote");
const elSaveHint = document.getElementById("saveHint");

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

let viewYear, viewMonth;
let selectedDateStr = null;
let monthCache = new Map();
let noteDebounce = null;

function pad2(n) { return String(n).padStart(2, "0"); }
function toDateStr(y, m0, d) { return `${y}-${pad2(m0 + 1)}-${pad2(d)}`; }
function startOfMonthStr(y, m0) { return `${y}-${pad2(m0 + 1)}-01`; }
function endOfMonthStr(y, m0) {
  const last = new Date(y, m0 + 1, 0).getDate();
  return `${y}-${pad2(m0 + 1)}-${pad2(last)}`;
}
function prettyMonthYear(y, m0) {
  return new Date(y, m0, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function setHint(text) { elSaveHint.textContent = text; }

function renderDow() {
  elDow.innerHTML = "";
  for (const ch of DOW) {
    const div = document.createElement("div");
    div.textContent = ch;
    elDow.appendChild(div);
  }
}

function applyDayClasses(dayEl, dStr) {
  dayEl.classList.remove("available", "unavailable", "has-note");

  const data = monthCache.get(dStr);
  if (!data) return;

  if (data.available === true) dayEl.classList.add("available");
  if (data.available === false) dayEl.classList.add("unavailable");

  const hasAnyNote =
    (data.note && String(data.note).trim().length) ||
    (data.bossNote && String(data.bossNote).trim().length);

  if (hasAnyNote) dayEl.classList.add("has-note");
}

function renderCalendar(y, m0) {
  elCal.innerHTML = "";
  elMonthYear.textContent = prettyMonthYear(y, m0);

  const firstDayIndex = new Date(y, m0, 1).getDay();
  const daysInMonth = new Date(y, m0 + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    const blank = document.createElement("div");
    blank.className = "blank";
    elCal.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day";
    cell.textContent = String(d);

    const dStr = toDateStr(y, m0, d);
    cell.dataset.date = dStr;

    cell.classList.toggle("selected", selectedDateStr === dStr);
    applyDayClasses(cell, dStr);

    cell.addEventListener("click", () => openDay(dStr));
    elCal.appendChild(cell);
  }
}

async function loadMonth(y, m0) {
  monthCache.clear();

  const start = startOfMonthStr(y, m0);
  const end = endOfMonthStr(y, m0);

  const qRef = query(
    collection(db, "availability"),
    where("date", ">=", start),
    where("date", "<=", end)
  );

  const snap = await getDocs(qRef);
  snap.forEach((docSnap) => monthCache.set(docSnap.id, docSnap.data()));

  elCal.querySelectorAll(".day").forEach((dayEl) => {
    applyDayClasses(dayEl, dayEl.dataset.date);
  });
}

function openPanel() { elPanel.classList.remove("hidden"); }
function closePanel() {
  elPanel.classList.add("hidden");
  selectedDateStr = null;
  elCal.querySelectorAll(".day.selected").forEach((x) => x.classList.remove("selected"));
}

async function openDay(dStr) {
  selectedDateStr = dStr;
  elSelectedDate.textContent = dStr;
  openPanel();

  elCal.querySelectorAll(".day").forEach((x) => {
    x.classList.toggle("selected", x.dataset.date === dStr);
  });

  const snap = await getDoc(doc(db, "availability", dStr));
  if (snap.exists()) {
    const data = snap.data();
    elAvail.checked = !!data.available;
    elStart.value = data.startTime || "";
    elEnd.value = data.endTime || "";
    elNote.value = data.note || "";
  } else {
    elAvail.checked = false;
    elStart.value = "";
    elEnd.value = "";
    elNote.value = "";
  }

  setHint("Changes save automatically.");
}

async function saveSelectedDay() {
  if (!selectedDateStr) return;

  setHint("Saving...");

  const payload = {
    date: selectedDateStr,
    available: !!elAvail.checked,
    startTime: elStart.value || "",
    endTime: elEnd.value || "",
    note: elNote.value || "",
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "availability", selectedDateStr), payload, { merge: true });

  monthCache.set(selectedDateStr, { ...(monthCache.get(selectedDateStr) || {}), ...payload });

  const dayEl = elCal.querySelector(`.day[data-date="${selectedDateStr}"]`);
  if (dayEl) applyDayClasses(dayEl, selectedDateStr);

  setHint("Saved");
}

elAvail.addEventListener("change", saveSelectedDay);
elStart.addEventListener("change", saveSelectedDay);
elEnd.addEventListener("change", saveSelectedDay);
elNote.addEventListener("input", () => {
  clearTimeout(noteDebounce);
  noteDebounce = setTimeout(saveSelectedDay, 300);
});

elClosePanel.addEventListener("click", closePanel);

function shiftMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
  if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }

  renderCalendar(viewYear, viewMonth);
  loadMonth(viewYear, viewMonth).catch(console.error);
}

elPrev.addEventListener("click", () => shiftMonth(-1));
elNext.addEventListener("click", () => shiftMonth(1));

(function init() {
  renderDow();
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  renderCalendar(viewYear, viewMonth);
  loadMonth(viewYear, viewMonth).catch(console.error);
})();
