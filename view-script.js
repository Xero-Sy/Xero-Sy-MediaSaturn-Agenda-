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

const elInfoAvail = document.getElementById("infoAvailable");
const elInfoTime = document.getElementById("infoTime");
const elInfoNote = document.getElementById("infoNote");

const elBossNote = document.getElementById("bossNote");
const elGlobal = document.getElementById("globalBossNote");

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

let viewYear, viewMonth;
let selectedDateStr = null;
let monthCache = new Map();
let bossDebounce = null;
let globalDebounce = null;

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
  elBossNote.value = "";
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
  if (!snap.exists()) {
    elInfoAvail.textContent = "No data";
    elInfoTime.textContent = "—";
    elInfoNote.textContent = "—";
    elBossNote.value = "";
    return;
  }

  const data = snap.data();
  elInfoAvail.textContent = data.available === true ? "Yes" : (data.available === false ? "No" : "—");
  elInfoTime.textContent =
    (data.startTime || data.endTime) ? `${data.startTime || "—"} -> ${data.endTime || "—"}` : "—";
  elInfoNote.textContent = (data.note && String(data.note).trim().length) ? data.note : "—";
  elBossNote.value = data.bossNote || "";
}

elBossNote.addEventListener("input", () => {
  clearTimeout(bossDebounce);
  bossDebounce = setTimeout(async () => {
    if (!selectedDateStr) return;

    await setDoc(doc(db, "availability", selectedDateStr), {
      date: selectedDateStr,
      bossNote: elBossNote.value || "",
      managerUpdatedAt: serverTimestamp(),
    }, { merge: true });

    const prev = monthCache.get(selectedDateStr) || { date: selectedDateStr };
    monthCache.set(selectedDateStr, { ...prev, bossNote: elBossNote.value || "" });

    const dayEl = elCal.querySelector(`.day[data-date="${selectedDateStr}"]`);
    if (dayEl) applyDayClasses(dayEl, selectedDateStr);
  }, 300);
});

elGlobal.addEventListener("input", () => {
  clearTimeout(globalDebounce);
  globalDebounce = setTimeout(async () => {
    await setDoc(doc(db, "notes", "global"), {
      note: elGlobal.value || "",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, 300);
});

async function loadGlobalNote() {
  const snap = await getDoc(doc(db, "notes", "global"));
  elGlobal.value = snap.exists() ? (snap.data().note || "") : "";
}

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
  loadGlobalNote().catch(console.error);
})();
