/* ===============================================================
   John's Notes — offline sermon & devotion notebook
   Runs entirely on-device. Notes never leave the phone. The only
   outbound requests are ESV passage and search lookups, and only
   if you add your own key in Backup & storage.
   =============================================================== */
const { useState, useEffect, useMemo, useRef } = React;

const storage = {
  async get(key) {
    const v = localStorage.getItem("jn:" + key);
    if (v === null) throw new Error("not found: " + key);
    return { key, value: v };
  },
  async set(key, value) { localStorage.setItem("jn:" + key, value); return { key, value }; },
  async delete(key) { localStorage.removeItem("jn:" + key); return { key, deleted: true }; },
  async list(prefix = "") {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith("jn:" + prefix)) keys.push(k.slice(3));
    }
    return { keys, prefix };
  },
};


/* ===============================================================
   BIBLE DATA — book names, abbreviations, verse counts per chapter
   =============================================================== */
const RAW = [
  ["Genesis", "gen ge gn", "31,25,24,26,32,22,24,22,29,32,32,20,18,24,21,16,27,33,38,18,34,24,20,67,34,35,46,22,35,43,55,32,20,31,29,43,36,30,23,23,57,38,34,34,28,34,31,22,33,26"],
  ["Exodus", "exo ex", "22,25,22,31,23,30,25,32,35,29,10,51,22,31,27,36,16,27,25,26,36,31,33,18,40,37,21,43,46,38,18,35,23,35,35,38,29,31,43,38"],
  ["Leviticus", "lev lv", "17,16,17,35,19,30,38,36,24,20,47,8,59,57,33,34,16,30,37,27,24,33,44,23,55,46,34"],
  ["Numbers", "num nu nm", "54,34,51,49,31,27,89,26,23,36,35,16,33,45,41,50,13,32,22,29,35,41,30,25,18,65,23,31,40,16,54,42,56,29,34,13"],
  ["Deuteronomy", "deut dt dte", "46,37,29,49,33,25,26,20,29,22,32,32,18,29,23,22,20,22,21,20,23,30,25,22,19,19,26,68,29,20,30,52,29,12"],
  ["Joshua", "josh jos", "18,24,17,24,15,27,26,35,27,43,23,24,33,15,63,10,18,28,51,9,45,34,16,33"],
  ["Judges", "judg jdg", "36,23,31,24,31,40,25,35,57,18,40,15,25,20,20,31,13,31,30,48,25"],
  ["Ruth", "ru rth", "22,23,18,22"],
  ["1 Samuel", "1sam 1sa 1 sam", "28,36,21,22,12,21,17,22,27,27,15,25,23,52,35,23,58,30,24,42,15,23,29,22,44,25,12,25,11,31,13"],
  ["2 Samuel", "2sam 2sa 2 sam", "27,32,39,12,25,23,29,18,13,19,27,31,39,33,37,23,29,33,43,26,22,51,39,25"],
  ["1 Kings", "1ki 1kgs 1 kings", "53,46,28,34,18,38,51,66,28,29,43,33,34,31,34,34,24,46,21,43,29,53"],
  ["2 Kings", "2ki 2kgs 2 kings", "18,25,27,44,27,33,20,29,37,36,21,21,25,29,38,20,41,37,37,21,26,20,37,20,30"],
  ["1 Chronicles", "1chr 1ch", "54,55,24,43,26,81,40,40,44,14,47,40,14,17,29,43,27,17,19,8,30,19,32,31,31,32,34,21,30"],
  ["2 Chronicles", "2chr 2ch", "17,18,17,22,14,42,22,18,31,19,23,16,22,15,19,14,19,34,11,37,20,12,21,27,28,23,9,27,36,27,21,33,25,33,27,23"],
  ["Ezra", "ezr", "11,70,13,24,17,22,28,36,15,44"],
  ["Nehemiah", "neh", "11,20,32,23,19,19,73,18,38,39,36,47,31"],
  ["Esther", "est", "22,23,15,17,14,14,10,17,32,3"],
  ["Job", "job", "22,13,26,21,27,30,21,22,35,22,20,25,28,22,35,22,16,21,29,29,34,30,17,25,6,14,23,28,25,31,40,22,33,37,16,33,24,41,30,24,34,17"],
  ["Psalms", "ps psa psalm", "6,12,8,8,12,10,17,9,20,18,7,8,6,7,5,11,15,50,14,9,13,31,6,10,22,12,14,9,11,12,24,11,22,22,28,12,40,22,13,17,13,11,5,26,17,11,9,14,20,23,19,9,6,7,23,13,11,11,17,12,8,12,11,10,13,20,7,35,36,5,24,20,28,23,10,12,20,72,13,19,16,8,18,12,13,17,7,18,52,17,16,15,5,23,11,13,12,9,9,5,8,28,22,35,45,48,43,13,31,7,10,10,9,8,18,19,2,29,176,7,8,9,4,8,5,6,5,6,8,8,3,18,3,3,21,26,9,8,24,13,10,7,12,15,21,10,20,14,9,6"],
  ["Proverbs", "prov pr prv", "33,22,35,27,23,35,27,36,18,32,31,28,25,35,33,33,28,24,29,30,31,29,35,34,28,28,27,28,27,33,31"],
  ["Ecclesiastes", "eccl ecc", "18,26,22,16,20,12,29,17,18,20,10,14"],
  ["Song of Solomon", "song sos ss", "17,17,11,16,16,13,13,14"],
  ["Isaiah", "isa is", "31,22,26,6,30,13,25,22,21,34,16,6,22,32,9,14,14,7,25,6,17,25,18,23,12,21,13,29,24,33,9,20,24,17,10,22,38,22,8,31,29,25,28,28,25,13,15,22,26,11,23,15,12,17,13,12,21,14,21,22,11,12,19,12,25,24"],
  ["Jeremiah", "jer", "19,37,25,31,31,30,34,22,26,25,23,17,27,22,21,21,27,23,15,18,14,30,40,10,38,24,22,17,32,24,40,44,26,22,19,32,21,28,18,16,18,22,13,30,5,28,7,47,39,46,64,34"],
  ["Lamentations", "lam", "22,22,66,22,22"],
  ["Ezekiel", "ezek eze", "28,10,27,17,17,14,27,18,11,22,25,28,23,23,8,63,24,32,14,49,32,31,49,27,17,21,36,26,21,26,18,32,33,31,15,38,28,23,29,49,26,20,27,31,25,24,23,35"],
  ["Daniel", "dan dn", "21,49,30,37,31,28,28,27,27,21,45,13"],
  ["Hosea", "hos", "11,23,5,19,15,11,16,14,17,15,12,14,16,9"],
  ["Joel", "joel jl", "20,32,21"],
  ["Amos", "amos am", "15,16,15,13,27,14,17,14,15"],
  ["Obadiah", "obad ob", "21"],
  ["Jonah", "jonah jon", "17,10,10,11"],
  ["Micah", "mic", "16,13,12,13,15,16,20"],
  ["Nahum", "nah", "15,13,19"],
  ["Habakkuk", "hab", "17,20,19"],
  ["Zephaniah", "zeph zep", "18,15,20"],
  ["Haggai", "hag", "15,23"],
  ["Zechariah", "zech zec", "21,13,10,14,11,15,14,23,17,12,17,14,9,21"],
  ["Malachi", "mal", "14,17,18,6"],
  ["Matthew", "matt mt mat", "25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20"],
  ["Mark", "mark mk mrk", "45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20"],
  ["Luke", "luke lk luk", "80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53"],
  ["John", "john jn jhn", "51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25"],
  ["Acts", "acts ac", "26,47,26,37,42,15,60,40,43,48,30,25,52,28,41,40,34,28,41,38,40,30,35,27,27,32,44,31"],
  ["Romans", "rom ro", "32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27"],
  ["1 Corinthians", "1cor 1co 1 cor", "31,16,23,21,13,20,40,13,27,33,34,31,13,40,58,24"],
  ["2 Corinthians", "2cor 2co 2 cor", "24,17,18,18,21,18,16,24,15,18,33,21,14"],
  ["Galatians", "gal ga", "24,21,29,31,26,18"],
  ["Ephesians", "eph", "23,22,21,32,33,24"],
  ["Philippians", "phil php", "30,30,21,23"],
  ["Colossians", "col", "29,23,25,18"],
  ["1 Thessalonians", "1thess 1th", "10,20,13,18,28"],
  ["2 Thessalonians", "2thess 2th", "12,17,18"],
  ["1 Timothy", "1tim 1ti", "20,15,16,16,25,21"],
  ["2 Timothy", "2tim 2ti", "18,26,17,22"],
  ["Titus", "titus tit", "16,15,15"],
  ["Philemon", "philem phm", "25"],
  ["Hebrews", "heb", "14,18,19,16,14,20,28,13,28,39,40,29,25"],
  ["James", "jas jam", "27,26,18,17,20"],
  ["1 Peter", "1pet 1pe", "25,25,22,19,14"],
  ["2 Peter", "2pet 2pe", "21,22,18"],
  ["1 John", "1john 1jn 1jo", "10,29,24,21,21"],
  ["2 John", "2john 2jn 2jo", "13"],
  ["3 John", "3john 3jn 3jo", "14"],
  ["Jude", "jude jud", "25"],
  ["Revelation", "rev re", "20,29,22,11,14,17,17,13,21,11,19,17,18,20,8,21,18,24,21,15,27,21"],
];

const BOOKS = RAW.map(([name, abbr, counts], i) => ({
  name,
  abbr: abbr.split(" "),
  verses: counts.split(",").map(Number),
  testament: i < 39 ? "Old" : "New",
}));

function matchBooks(query) {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return BOOKS;
  const starts = [], contains = [];
  for (const b of BOOKS) {
    const hay = [b.name.toLowerCase(), ...b.abbr];
    if (hay.some((h) => h.startsWith(q))) starts.push(b);
    else if (hay.some((h) => h.includes(q))) contains.push(b);
  }
  return [...starts, ...contains];
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ===============================================================
   PERSISTENCE
   =============================================================== */
/* ===============================================================
   PHOTOS
   ---------------------------------------------------------------
   Images are far bigger than text, so they live in IndexedDB
   (quota measured in GB) rather than alongside the notes. Each
   entry stores only lightweight metadata; the pixels are fetched
   by id when a photo is actually shown.
   =============================================================== */
const PHOTO_DB = "johns-notes-photos";
const PHOTO_STORE = "photos";

function openPhotoDB() {
  return new Promise((resolve, reject) => {
    if (!self.indexedDB) return reject(new Error("no indexeddb"));
    const req = indexedDB.open(PHOTO_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbOp(mode, fn) {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, mode);
    const store = tx.objectStore(PHOTO_STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* Falls back to the regular key-value store if IndexedDB is unavailable. */
const photoStore = {
  async put(id, dataUrl) {
    try { await idbOp("readwrite", (st) => st.put(dataUrl, id)); return true; }
    catch { await storage.set("photo:" + id, dataUrl); return true; }
  },
  async get(id) {
    try {
      const v = await idbOp("readonly", (st) => st.get(id));
      if (v) return v;
    } catch {}
    try { const r = await storage.get("photo:" + id); return r?.value || null; }
    catch { return null; }
  },
  async del(id) {
    try { await idbOp("readwrite", (st) => st.delete(id)); } catch {}
    try { await storage.delete("photo:" + id); } catch {}
  },
};

/* Downscale and compress before storing — a phone photo is ~4MB raw,
   this brings it to roughly 200-400KB while staying readable. */
function compressImage(file, maxEdge = 1600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality), width, height });
      };
      img.onerror = () => reject(new Error("Couldn't read that image"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.readAsDataURL(file);
  });
}

const approxKB = (dataUrl) => Math.round((dataUrl.length * 0.75) / 1024);

/* ===============================================================
   READING PLANS — coverage based
   ---------------------------------------------------------------
   The plan tracks WHAT you've read, not which day you're on. Read
   John 1:1-6 anywhere, any time, and it comes off the unread list.
   A guided order and a deadline are both optional layers on top of
   that record, never the thing itself.
   =============================================================== */
const NT_START = 39;

const SCOPES = [
  { id: "all",      label: "Whole Bible",     books: "all" },
  { id: "nt",       label: "New Testament",   books: "nt" },
  { id: "ot",       label: "Old Testament",   books: "ot" },
  { id: "gospels",  label: "The Gospels",     books: ["Matthew", "Mark", "Luke", "John"] },
  { id: "psalms",   label: "Psalms",          books: ["Psalms"] },
  { id: "proverbs", label: "Proverbs",        books: ["Proverbs"] },
  { id: "pauline",  label: "Paul's Letters",  books: ["Romans", "1 Corinthians", "2 Corinthians",
    "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon"] },
];

function scopeBooks(scopeId) {
  const scope = SCOPES.find((s) => s.id === scopeId) || SCOPES[0];
  if (scope.books === "all") return BOOKS;
  if (scope.books === "nt") return BOOKS.slice(NT_START);
  if (scope.books === "ot") return BOOKS.slice(0, NT_START);
  return BOOKS.filter((b) => scope.books.includes(b.name));
}

const bookByName = (name) => BOOKS.find((b) => b.name === name);

/* ---------------- coverage ----------------
   { "John 1": [[1,6],[10,14]] } — merged, sorted verse ranges.
------------------------------------------- */
function parseReading(ref) {
  const withVerses = ref.match(/^(.+?)\s+(\d+):(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (withVerses) {
    const [, book, ch, a, b] = withVerses;
    if (!bookByName(book)) return null;
    return { book, ch: +ch, start: +a, end: b ? +b : +a };
  }
  const chapterOnly = ref.match(/^(.+?)\s+(\d+)$/);
  if (chapterOnly) {
    const [, book, ch] = chapterOnly;
    const bk = bookByName(book);
    if (!bk || !bk.verses[+ch - 1]) return null;
    return { book, ch: +ch, start: 1, end: bk.verses[+ch - 1] };
  }
  return null;
}

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

const rangeTotal = (ranges) => (ranges || []).reduce((sum, [a, b]) => sum + (b - a + 1), 0);

function addToCoverage(coverage, ref) {
  const parsed = parseReading(ref);
  if (!parsed) return coverage;
  const key = `${parsed.book} ${parsed.ch}`;
  const next = { ...coverage };
  next[key] = mergeRanges([...(next[key] || []), [parsed.start, parsed.end]]);
  return next;
}

function removeFromCoverage(coverage, key) {
  const next = { ...coverage };
  delete next[key];
  return next;
}

function chapterDone(coverage, book, ch) {
  const bk = bookByName(book);
  if (!bk) return false;
  return rangeTotal(coverage[`${book} ${ch}`]) >= bk.verses[ch - 1];
}

/* Totals for a scope: verses and chapters, read and outstanding */
function coverageStats(coverage, scopeId) {
  const books = scopeBooks(scopeId);
  let totalVerses = 0, readVerses = 0, totalCh = 0, doneCh = 0, partialCh = 0;

  books.forEach((b) => {
    b.verses.forEach((vCount, i) => {
      const key = `${b.name} ${i + 1}`;
      const read = Math.min(rangeTotal(coverage[key]), vCount);
      totalVerses += vCount;
      readVerses += read;
      totalCh += 1;
      if (read >= vCount) doneCh += 1;
      else if (read > 0) partialCh += 1;
    });
  });

  return {
    totalVerses, readVerses, totalCh, doneCh, partialCh,
    pct: totalVerses ? Math.round((readVerses / totalVerses) * 100) : 0,
  };
}

/* The next thing not yet fully read, in canonical order */
function nextUnread(coverage, scopeId) {
  for (const b of scopeBooks(scopeId)) {
    for (let i = 0; i < b.verses.length; i++) {
      if (!chapterDone(coverage, b.name, i + 1)) {
        const read = rangeTotal(coverage[`${b.name} ${i + 1}`]);
        return { book: b.name, ch: i + 1, partial: read > 0, versesRead: read,
                 versesTotal: b.verses[i] };
      }
    }
  }
  return null;
}

/* Suggest a sensible next sitting: the next few unread chapters */
function suggestNext(coverage, scopeId, count = 3) {
  const out = [];
  for (const b of scopeBooks(scopeId)) {
    for (let i = 0; i < b.verses.length; i++) {
      if (!chapterDone(coverage, b.name, i + 1)) {
        out.push({ book: b.name, ch: i + 1 });
        if (out.length >= count) return out;
      }
    }
  }
  return out;
}

function labelChapters(list) {
  const runs = [];
  list.forEach((c) => {
    const last = runs[runs.length - 1];
    if (last && last.book === c.book && c.ch === last.end + 1) last.end = c.ch;
    else runs.push({ book: c.book, start: c.ch, end: c.ch });
  });
  return runs
    .map((r) => (r.start === r.end ? `${r.book} ${r.start}` : `${r.book} ${r.start}–${r.end}`))
    .join(", ");
}

/* ---------------- pacing (optional) ---------------- */
function paceStatus(plan, stats) {
  if (!plan.paced || !plan.targetDays || !plan.startDate) return null;
  const dayMs = 86400000;
  const started = new Date(plan.startDate).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const elapsed = Math.max(1, Math.round((today - started) / dayMs) + 1);

  const expectedVerses = Math.min(stats.totalVerses,
    Math.round((elapsed / plan.targetDays) * stats.totalVerses));
  const diffVerses = stats.readVerses - expectedVerses;
  const versesPerDay = stats.totalVerses / plan.targetDays;
  const daysOff = Math.round(diffVerses / versesPerDay);

  const remaining = Math.max(0, plan.targetDays - elapsed);
  const versesLeft = stats.totalVerses - stats.readVerses;
  const neededPerDay = remaining > 0 ? Math.ceil(versesLeft / remaining) : versesLeft;

  return { elapsed, daysOff, remaining, neededPerDay, onTrack: daysOff >= 0 };
}

function streakOf(log) {
  const dates = [...new Set((log || []).map((r) => r.on))].sort().reverse();
  if (dates.length === 0) return 0;
  const dayMs = 86400000;
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  if (today - new Date(dates[0]).getTime() > dayMs) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    if (new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime() === dayMs) streak++;
    else break;
  }
  return streak;
}

async function loadPlan() {
  try {
    const r = await storage.get("reading-plan");
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function savePlan(p) {
  try { await storage.set("reading-plan", JSON.stringify(p)); return true; }
  catch { return false; }
}

/* ===============================================================
   TOPICS
   ---------------------------------------------------------------
   Topics attach to a reference, not to one note — tag Romans 8:28
   with "patience" once and it surfaces from anywhere you cite it.
   Shape: { "Romans 8:28": ["patience", "suffering"] }
   =============================================================== */
const TopicsContext = React.createContext({ topics: {}, setTopicsFor: () => {} });

const SUGGESTED_TOPICS = [
  "patience", "anxiety", "fear", "grief", "forgiveness", "guidance",
  "gratitude", "hope", "temptation", "provision", "healing", "wisdom",
];

const normTopic = (t) => t.trim().toLowerCase().replace(/\s+/g, " ");

async function loadTopics() {
  try {
    const r = await storage.get("verse-topics");
    return r ? JSON.parse(r.value) : {};
  } catch { return {}; }
}
async function saveTopics(t) {
  try { await storage.set("verse-topics", JSON.stringify(t)); return true; }
  catch { return false; }
}

/* Ask the OS to keep our data out of the eviction queue. */
async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return { supported: false, persisted: false };
    const already = await navigator.storage.persisted();
    const persisted = already || await navigator.storage.persist();
    return { supported: true, persisted };
  } catch { return { supported: false, persisted: false }; }
}

async function storageEstimate() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  } catch { return null; }
}

async function loadDevotions() {
  try {
    const r = await storage.get("devotions");
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}
async function saveDevotions(d) {
  try { await storage.set("devotions", JSON.stringify(d)); return true; }
  catch { return false; }
}

async function loadNotes() {
  try {
    const r = await storage.get("sermon-notes-v2");
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}
async function saveNotes(notes) {
  try { await storage.set("sermon-notes-v2", JSON.stringify(notes)); return true; }
  catch { return false; }
}

/* ===============================================================
   STYLE
   =============================================================== */
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

      /* ==============================================================
         DESIGN NOTES
         A notebook, not a dashboard. Three decisions drive everything:

         1. Text is the interface. Scripture and your own writing are set
            in a serif at reading sizes; the app's own furniture is small,
            quiet sans. Almost nothing is in a box — hierarchy comes from
            type, rules and space, so the screen stays calm when it fills
            up mid-sermon.
         2. One accent. Ink blue for anything actionable. Scripture gets
            a warm ochre rule instead of a second UI colour, so verses
            read as quoted material rather than as another button.
         3. Generous touch targets, tight visual rhythm. 44px minimum on
            anything tappable, but only 1px hairlines between sections.
         ============================================================== */

      * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
      html, body { margin:0; padding:0; background:#F7F3EA; }

      .sn-root {
        /* -----------------------------------------------------------
           Palette: your calls.
           Warm and bright ground, deep forest as the working colour,
           amber reserved for highlighting. Green never sets text —
           it fills, edges and marks. Corners stay soft, never cut.
           ----------------------------------------------------------- */

        /* Ground — warm, bright, low glare */
        --paper:#FDFBF6;
        --card:#FFFFFF;
        --rule:#E9E3D6;
        --rule-soft:#F4EFE4;

        /* Ink — warm near-black, 16:1 on paper */
        --ink:#1A1815;
        --ink-2:#565049;
        --ink-3:#7C7568;

        /* Forest — the working colour. Fills, edges, markers. */
        --accent:#14503F;
        --accent-deep:#0E3A2C;      /* for the rare link or label */
        --accent-wash:#E8F0EB;

        /* Amber — highlighting and scripture, as you asked */
        --ochre:#C08A16;
        --ochre-wash:#FDF3DA;

        /* States */
        --good:#14503F;
        --alert:#9B3B21;

        --r:9px;

        font-family:'Inter',system-ui,sans-serif;
        background:var(--paper);
        color:var(--ink);
        min-height:100vh; max-width:480px; margin:0 auto;
        position:relative; padding-bottom:24px;
        -webkit-font-smoothing:antialiased;
      }

      .sn-serif { font-family:'Lora',Georgia,serif; }
      .sn-mono  { font-family:'IBM Plex Mono',monospace; font-size:.92em; letter-spacing:-.01em; }
      .sn-scroll { padding:16px 18px 32px; }

      /* ---------- header: a masthead, not a chrome bar ---------- */
      .sn-header { padding:14px 18px 12px; background:rgba(253,251,246,.93);
        backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
        border-bottom:1px solid var(--rule); position:sticky; top:0; z-index:15; }
      .sn-header-row { display:flex; align-items:center; gap:12px; }
      .sn-header h1 { margin:0; flex:1; font-family:'Lora',Georgia,serif;
        font-size:19px; font-weight:500; letter-spacing:-.01em; }
      .sn-brand { font-weight:600; }
      .sn-header p { display:none; }         /* the screen speaks for itself */
      .sn-header-sp { display:none; }

      .sn-burger { background:none; border:none; padding:10px 10px 10px 0; margin:-10px 0 -10px -2px;
        cursor:pointer; display:flex; flex-direction:column; gap:4px; }
      .sn-burger span { display:block; width:18px; height:1.5px; background:var(--ink); border-radius:2px; }

      /* ---------- type scale ---------- */
      .sn-secttl { font-size:11px; font-weight:600; letter-spacing:.13em; text-transform:uppercase;
        color:var(--ink-3); margin:26px 0 10px; }
      .sn-label { display:block; font-size:11px; font-weight:600; letter-spacing:.1em;
        text-transform:uppercase; color:var(--ink-3); margin-bottom:7px; }
      .sn-sublbl { font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase;
        color:var(--ink-3); margin-bottom:8px; }
      .sn-note { font-size:12.5px; line-height:1.5; color:var(--ink-3); margin-top:6px; }
      .sn-note.warn { color:var(--alert); }

      /* ---------- fields: underlines, not boxes ---------- */
      .sn-field { margin-bottom:20px; }
      .sn-input, .sn-textarea {
        width:100%; font-family:'Inter',sans-serif; font-size:16px; color:var(--ink);
        background:transparent; border:none; border-bottom:1px solid var(--rule);
        border-radius:0; padding:8px 0; outline:none; transition:border-color .15s;
      }
      .sn-input:focus, .sn-textarea:focus { border-bottom-color:var(--accent); border-bottom-width:1.5px; }
      .sn-input::placeholder, .sn-textarea::placeholder { color:#B3ABA0; }
      .sn-textarea { resize:none; min-height:52px; line-height:1.6; font-size:16px; }
      .sn-textarea.serif { font-size:16.5px; line-height:1.65; }
      select.sn-input { appearance:none; }
      .sn-input-date { font-family:'IBM Plex Mono',monospace; font-size:14px; padding:8px 0;
        min-width:0; width:100%; -webkit-appearance:none; appearance:none; }
      .sn-input-date::-webkit-date-and-time-value { text-align:left; margin:0; }
      .sn-input-date::-webkit-calendar-picker-indicator { padding:0; margin:0; opacity:.4; width:14px; }
      .sn-input-date::-webkit-inner-spin-button, .sn-input-date::-webkit-clear-button { display:none; }

      /* ---------- buttons ---------- */
      .sn-btn { font-family:'Inter',sans-serif; font-weight:600; font-size:15px; border-radius:var(--r);
        border:none; padding:13px 18px; cursor:pointer; min-height:44px;
        transition:opacity .12s, transform .1s; }
      .sn-btn:active { transform:scale(.985); }
      .sn-btn:disabled { opacity:.35; }
      .sn-btn-accent { background:var(--accent); color:#fff; }
      .sn-btn-primary { background:var(--ink); color:var(--paper); }
      .sn-btn-ghost { background:transparent; color:var(--ink-2); border:1px solid var(--rule); }
      .sn-btn-danger { background:transparent; color:var(--alert); border:1px solid #E4CDC5; }
      .sn-btn-full { width:100%; }
      .sn-btn-sm { padding:9px 13px; font-size:13.5px; min-height:38px; }
      .sn-link { background:none; border:none; color:var(--accent-deep); font-size:13px; font-weight:600;
        cursor:pointer; padding:6px 0; font-family:'Inter',sans-serif;
        letter-spacing:0; text-transform:none; }

      /* ---------- home ---------- */
      .sn-greet { padding:4px 0 18px; border-bottom:1px solid var(--rule); margin-bottom:18px; }
      .sn-greet-hi { font-family:'Lora',Georgia,serif; font-size:27px; font-weight:500;
        letter-spacing:-.015em; line-height:1.2; }
      .sn-greet-date { font-size:12.5px; color:var(--ink-3); margin-top:5px;
        letter-spacing:.02em; }

      /* The two things you actually came here to do */
      /* ---------- panels: framed by rules, not boxes ---------- */
      .sn-panel { background:var(--card); border:1px solid var(--rule); border-radius:var(--r);
        padding:16px; margin-bottom:4px; }
      .sn-panel-hd { display:flex; align-items:center; justify-content:space-between; gap:10px;
        font-size:11px; font-weight:600; letter-spacing:.13em; text-transform:uppercase;
        color:var(--ink-3); margin-bottom:14px; }

      /* reading progress: a single honest line */
      .sn-progress-row { display:flex; align-items:baseline; gap:10px; margin-bottom:14px; }
      .sn-progress-num { font-family:'Lora',Georgia,serif; color:var(--ink); flex-shrink:0; }
      .sn-progress-num strong { font-size:32px; font-weight:500; letter-spacing:-.02em; }
      .sn-progress-num span { font-size:15px; color:var(--ink-3); }
      .sn-progress-meta { flex:1; min-width:0; }
      .sn-meter { height:3px; border-radius:2px; background:var(--rule); overflow:hidden; margin-bottom:7px; }
      .sn-meter-fill { height:100%; border-radius:2px;
        background:linear-gradient(90deg, var(--accent) 0%, var(--ochre) 165%); }

      .sn-today-lbl { font-size:11px; font-weight:600; letter-spacing:.12em; text-transform:uppercase;
        color:var(--ink-3); margin-bottom:5px; }
      .sn-today { font-family:'Lora',Georgia,serif; font-size:19px; font-weight:500;
        line-height:1.35; margin-bottom:14px; }
      .sn-today-actions { display:flex; gap:9px; }
      .sn-partial { font-family:'Inter',sans-serif; font-size:12.5px; color:var(--ink-3); font-weight:400; }

      .sn-pace { font-size:12.5px; line-height:1.5; padding:9px 0; margin-bottom:12px;
        border-top:1px solid var(--rule-soft); border-bottom:1px solid var(--rule-soft); }
      .sn-pace.ok { color:var(--good); }
      .sn-pace.behind { color:#8A6410; }

      .sn-scopegrid { display:grid; grid-template-columns:repeat(2,1fr); gap:7px; }
      .sn-scopeopt { padding:11px 9px; border-radius:var(--r); border:1px solid var(--rule);
        background:transparent; color:var(--ink-2); font-family:'Inter',sans-serif;
        font-size:13.5px; font-weight:500; cursor:pointer; min-height:42px; }
      .sn-scopeopt.on { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:600; }
      .sn-paceopts { display:flex; flex-direction:column; gap:7px; }
      .sn-paceopt { text-align:left; padding:12px 13px; border-radius:var(--r);
        border:1px solid var(--rule); background:transparent; cursor:pointer; font-family:'Inter',sans-serif; }
      .sn-paceopt .nm { font-size:14.5px; font-weight:600; color:var(--ink); }
      .sn-paceopt .bl { font-size:12.5px; color:var(--ink-3); margin-top:2px; line-height:1.4; }
      .sn-paceopt.on { border-color:var(--accent); background:var(--accent-wash); }
      .sn-dayopts { display:flex; gap:7px; }
      .sn-dayopt { flex:1; padding:10px 0; border-radius:var(--r); border:1px solid var(--rule);
        background:transparent; font-family:'IBM Plex Mono',monospace; font-size:13px;
        font-weight:600; color:var(--ink-2); cursor:pointer; min-height:40px; }
      .sn-dayopt.on { background:var(--accent); border-color:var(--accent); color:#fff; }
      .sn-planopt { display:flex; align-items:center; justify-content:space-between; gap:10px;
        width:100%; text-align:left; background:transparent; border:none;
        border-bottom:1px solid var(--rule-soft); padding:13px 0; cursor:pointer;
        font-family:'Inter',sans-serif; }
      .sn-planopt .nm { font-size:14.5px; font-weight:600; }
      .sn-planopt .bl { font-size:12px; color:var(--ink-3); margin-top:2px; }
      .sn-planopt .ct { font-size:12px; font-weight:600; color:var(--ink-3); flex-shrink:0; }

      .sn-loglist { margin-top:16px; border-top:1px solid var(--rule-soft); padding-top:2px; }
.sn-logrow { display:grid; width:100%; text-align:left; background:none; border:none;
        grid-template-columns:1fr auto 18px; grid-template-areas:"ref date chev" "tags tags tags";
        column-gap:12px; align-items:center; padding:11px 0; cursor:pointer;
        border-bottom:1px solid var(--rule-soft); font-family:'Inter',system-ui,sans-serif; }
      .sn-logrow .ref { grid-area:ref; font-size:14px; color:var(--ink); overflow:hidden;
        text-overflow:ellipsis; white-space:nowrap; }
      .sn-logrow .dt { grid-area:date; font-family:'IBM Plex Mono',monospace; font-size:11.5px;
        color:var(--ink-3); white-space:nowrap; }
      .sn-logrow .chev { grid-area:chev; font-size:15px; color:var(--ink-3); text-align:right;
        line-height:1; }
      .sn-logrow .tags { grid-area:tags; font-size:11.5px; color:#8A6410; margin-top:3px;
        text-transform:capitalize; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

      /* ---------- topic shortcuts: the heart of the thing ---------- */
      /* topic search — small, sits above the shortcut pills */

      /* scripture text, tag panel, verse find */
      /* copyright / about */
      .sn-legal { font-size:13.5px; line-height:1.65; color:var(--ink-2); margin-bottom:14px; }
      .sn-esvline { margin-bottom:6px; }
      .sn-esvline a { color:var(--ink-3); text-decoration:none; border-bottom:1px solid var(--rule); }
      .sn-about-ft { margin-top:40px; padding-top:18px; border-top:1px solid var(--rule-soft);
        font-size:11.5px; color:#A39C90; text-align:center; letter-spacing:.02em; line-height:1.7;
        font-weight:400; }
      .sn-footlink { display:block; width:100%; margin-top:34px; padding:16px 0;
        border-top:1px solid var(--rule-soft); background:none; border-left:none;
        border-right:none; border-bottom:none; color:var(--ink-3); font-size:12.5px;
        font-family:'Inter',sans-serif; cursor:pointer; text-align:center; letter-spacing:.02em; }
      .sn-drawer-item.foot { margin-top:auto; border-top:1px solid var(--rule-soft);
        border-radius:0; font-size:13.5px; color:var(--ink-3); font-weight:500; padding-top:16px; }
      /* scripture text — same face as the rest of the app, set larger */
      .sn-scripture { font-family:'Inter',system-ui,sans-serif; font-size:17px; line-height:1.7;
        color:var(--ink); border-left:2px solid var(--ochre); padding:2px 0 2px 14px;
        margin:8px 0; }
      .sn-scripture.compact { font-size:16px; line-height:1.65; margin:6px 0 10px; }
      .sn-scripture.dim { color:var(--ink-3); font-style:italic; border-left-color:var(--rule); }
      .sn-scripture.err { font-size:13px; color:var(--alert); border-left-color:#E4CDC5; }
      .sn-scripture-attr { font-family:'Inter',sans-serif; font-size:10px; color:#A39C90;
        margin-top:8px; letter-spacing:.06em; text-transform:uppercase; }
      .sn-scripture-attr a { color:#A39C90; text-decoration:none;
        border-bottom:1px solid var(--rule); margin-left:5px;
        text-transform:lowercase; letter-spacing:.02em; }


      /* reader */
      /* scripture word search */
      .sn-esvsearch { margin-bottom:8px; }
      .sn-hit { padding:13px 0; border-bottom:1px solid var(--rule-soft); }
      .sn-hit-ref { font-size:12px; color:var(--ochre); font-weight:600; margin-bottom:5px; }
      .sn-hit-text { font-size:16.5px; line-height:1.65; color:var(--ink); }
      .sn-hit-ft { display:flex; align-items:center; margin-top:9px; }
      .sn-hit-have { font-size:12px; color:var(--ink-3); }
      .sn-hit-attr { font-size:10px; color:#A39C90; letter-spacing:.06em; text-transform:uppercase;
        padding:10px 0 2px; }
      .sn-hit-attr a { color:#A39C90; text-decoration:none; border-bottom:1px solid var(--rule);
        margin-left:5px; text-transform:lowercase; letter-spacing:.02em; }
      .sn-hit-pager { display:flex; align-items:center; justify-content:space-between; gap:10px;
        padding:12px 0; font-size:12.5px; color:var(--ink-3); }
      .sn-hit-pager button { background:none; border:1px solid var(--rule); border-radius:100px;
        padding:7px 14px; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600;
        color:var(--ink-2); cursor:pointer; }
      .sn-hit-pager button:disabled { opacity:.35; }

      .sn-readhd { display:flex; align-items:baseline; justify-content:space-between; gap:10px;
        margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--rule); }
      .sn-readhd h2 { margin:0; font-size:24px; font-weight:500; letter-spacing:-.01em; }
      .sn-readdone { font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase;
        color:var(--accent); flex-shrink:0; }
      .sn-readch { margin-bottom:26px; }
      .sn-readch-lbl { font-size:11px; color:var(--ink-3); letter-spacing:.08em;
        text-transform:uppercase; margin-bottom:8px; }
      .sn-readch .sn-scripture { font-size:19px; line-height:1.8; border-left:none; padding-left:0; }
      .sn-readft { margin-top:34px; padding-top:20px; border-top:1px solid var(--rule); }
      .sn-readft-lbl { font-size:11px; font-weight:600; letter-spacing:.12em; text-transform:uppercase;
        color:var(--ink-3); margin-bottom:12px; text-align:center; }

      /* daily proverb — reads as a panel, like the plan above it */
      .sn-proverb-text { margin:2px 0 14px; }
      .sn-proverb-text .sn-scripture { font-family:'Inter',system-ui,sans-serif; font-size:19px;
        line-height:1.7; border-left:none; padding-left:0; margin:0; }
      .sn-proverb-text .sn-scripture-attr { display:none; }
      .sn-proverb-noref { font-size:13.5px; color:var(--ink-3); line-height:1.55;
        margin:2px 0 14px; }
      .sn-proverb-done { flex:1; font-size:13px; font-weight:600; color:var(--accent);
        padding:9px 0; }

      /* topical suggestions — reference, text, and one action */
      .sn-suggest { padding:14px 0; border-bottom:1px solid var(--rule-soft); }
      .sn-suggest-hd { display:flex; align-items:center; justify-content:space-between;
        gap:10px; margin-bottom:2px; }
      .sn-suggest-hd .sn-mono { font-size:12.5px; color:#8A6410; font-weight:600; }
      .sn-suggest-text .sn-scripture { border-left:none; padding-left:0; margin:4px 0 0;
        font-size:16.5px; line-height:1.65; }
      .sn-suggest-text .sn-scripture-attr { display:none; }
      .sn-suggest-read { background:none; border:none; color:var(--accent-deep); font-size:13px;
        font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; padding:6px 0 0; }
      .sn-suggest-add { background:transparent; border:1px solid var(--rule); color:var(--ink-2);
        border-radius:100px; font-size:12.5px; font-weight:600; cursor:pointer;
        font-family:'Inter',sans-serif; padding:7px 14px; flex-shrink:0; text-transform:capitalize; }
      .sn-suggest-add:active { background:var(--accent-wash); border-color:var(--accent);
        color:var(--accent-deep); }

      .sn-topicgroup { margin-bottom:22px; }
      .sn-topicgroup-hd { display:flex; align-items:baseline; justify-content:space-between;
        gap:10px; padding-bottom:8px; margin-bottom:4px; border-bottom:1px solid var(--rule); }
      .sn-topicgroup-nm { font-family:'Lora',Georgia,serif; font-size:19px; font-weight:500;
        text-transform:capitalize; }

      /* search fields — same underline language as every other input */
      /* ESV markup — poetry, paragraphs, verse numbers, headings */
      .sn-esvhtml { font-family:'Inter',system-ui,sans-serif; }
      .sn-esvhtml p { margin:0 0 13px; }
      .sn-esvhtml p:last-child { margin-bottom:0; }
      .sn-esvhtml h3 { font-family:'Inter',sans-serif; font-size:11px; font-weight:600;
        letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); margin:22px 0 9px; }
      .sn-esvhtml h3:first-child { margin-top:0; }
      .sn-esvhtml .verse-num, .sn-esvhtml .chapter-num {
        font-family:'IBM Plex Mono',monospace; font-size:.68em; font-weight:600;
        color:var(--ochre); vertical-align:.35em; margin-right:2px; }
      .sn-esvhtml .block-indent { margin:0 0 13px; padding-left:4px; }
      .sn-esvhtml .line, .sn-esvhtml .indent { display:block; text-indent:-14px; padding-left:14px; }
      .sn-esvhtml .indent { padding-left:32px; }
      .sn-esvhtml .decl { display:block; padding-left:14px; }
      .sn-esvhtml .psalm-title, .sn-esvhtml .speaker { font-style:italic; color:var(--ink-2);
        display:block; margin-bottom:9px; font-size:.92em; }
      .sn-esvhtml .footnote, .sn-esvhtml .footnotes { font-size:12.5px; color:var(--ink-3); }
      .sn-esvhtml .footnotes { margin-top:18px; padding-top:12px;
        border-top:1px solid var(--rule-soft); line-height:1.55; }
      .sn-esvhtml .footnotes p { margin:0 0 7px; }
      .sn-esvhtml a { color:var(--ink-3); text-decoration:none; border-bottom:1px dotted var(--rule); }
      .sn-esvhtml .extra_text, .sn-esvhtml .copyright, .sn-esvhtml .audio { display:none; }

      /* tagging panel + reading log rows */
      .sn-tagpanel { background:var(--card); border:1px solid var(--accent); border-radius:var(--r);
        padding:15px; margin-bottom:16px; }
      .sn-tagpanel-hd { display:flex; align-items:center; justify-content:space-between;
        gap:10px; margin-bottom:6px; font-size:14px; font-weight:600; }
      .sn-logopen { padding:10px 0 14px; border-bottom:1px solid var(--rule-soft); }

      /* Bible tab */
      .sn-chapterhd { font-size:21px; font-weight:500; margin:2px 0 14px; }
      .sn-searchalt { background:none; border:1px solid var(--rule); border-radius:100px;
        font-family:'Inter',system-ui,sans-serif; font-size:12px; font-weight:600;
        color:var(--ink-2); padding:6px 12px; cursor:pointer; flex-shrink:0; margin-left:4px; }
      .sn-searchalt:active { background:var(--accent-wash); }

      .sn-biblehd { display:flex; align-items:center; gap:12px; margin:4px 0 18px;
        padding-bottom:14px; border-bottom:1px solid var(--rule); }
      .sn-biblehd h2 { flex:1; margin:0; font-size:23px; font-weight:500; text-align:center;
        letter-spacing:-.01em; }
      .sn-stepbtn { background:none; border:1px solid var(--rule); border-radius:100px;
        width:36px; height:36px; font-size:17px; color:var(--ink-2); cursor:pointer;
        flex-shrink:0; line-height:1; }
      .sn-stepbtn:active { background:var(--accent-wash); }

      .sn-biblebody { font-size:18px; line-height:1.85; }
      .sn-biblebody [data-v] { cursor:pointer; border-radius:3px;
        transition:background .12s, box-shadow .12s; }
      .sn-biblebody [data-v].hl { background:var(--ochre-wash);
        box-shadow:0 0 0 2px var(--ochre-wash); }
      .sn-biblebody [data-v].tagged { box-shadow:inset 0 -2px 0 var(--accent-wash); }
      .sn-biblebody [data-v].sel { background:var(--accent-wash);
        box-shadow:0 0 0 2px var(--accent-wash); }
      .sn-biblebody .sn-esvhtml { font-size:18px; line-height:1.85; }

      .sn-biblebody [data-v].focus { background:var(--ochre-wash); border-radius:3px;
        box-shadow:0 0 0 2px var(--ochre-wash); }
      .sn-focusnote { display:block; width:100%; text-align:left; background:none; border:none;
        border-left:2px solid var(--ochre); padding:2px 0 2px 12px; margin:-6px 0 16px;
        font-family:'Inter',system-ui,sans-serif; font-size:12.5px; color:var(--ink-3);
        cursor:pointer; line-height:1.5; }

      .sn-versebar { position:fixed; bottom:0; left:50%; transform:translateX(-50%);
        width:100%; max-width:480px; background:var(--card); border-top:1px solid var(--rule);
        box-shadow:0 -8px 28px rgba(120,80,40,.12); padding:14px 18px calc(16px + env(safe-area-inset-bottom));
        z-index:40; max-height:62vh; overflow-y:auto; }
      .sn-versebar-hd { display:flex; align-items:center; justify-content:space-between;
        gap:10px; margin-bottom:10px; }
      .sn-versebar-hd .sn-mono { font-size:14px; font-weight:600; color:#8A6410; }
      .sn-hlbtn { width:100%; background:transparent; border:1px solid var(--ochre);
        color:#8A6410; border-radius:var(--r); padding:11px; font-family:'Inter',system-ui,sans-serif;
        font-size:14px; font-weight:600; cursor:pointer; }
      .sn-hlbtn.on { background:var(--ochre-wash); }

      .sn-search { display:flex; align-items:center; gap:11px;
        border-bottom:1px solid var(--rule); padding:6px 0 9px; margin-bottom:16px;
        transition:border-color .15s; }
      .sn-search:focus-within { border-bottom-color:var(--accent); }
      .sn-search .ico { font-size:17px; color:var(--ink-3); flex-shrink:0; line-height:1;
        transform:translateY(-1px); }
      .sn-search input { flex:1; min-width:0; border:none; background:transparent; outline:none;
        font-family:'Inter',system-ui,sans-serif; font-size:16px; color:var(--ink); padding:4px 0; }
      .sn-search input::placeholder { color:#B3ABA0; }
      .sn-search.mono input { font-family:'IBM Plex Mono',monospace; font-size:15px; }
      .sn-search.mono input::placeholder { font-family:'Inter',system-ui,sans-serif; }
      .sn-search .clear { background:none; border:none; color:var(--ink-3); font-size:21px;
        line-height:1; cursor:pointer; padding:4px 0 4px 8px; flex-shrink:0; }

      .sn-topicrow { display:flex; flex-wrap:wrap; gap:7px; }
      .sn-topicpill { display:inline-flex; align-items:center; gap:7px; background:var(--card);
        border:1px solid var(--rule); color:var(--ink); border-radius:100px;
        padding:9px 15px; font-family:'Inter',sans-serif; font-size:14px; font-weight:500;
        text-transform:capitalize; cursor:pointer; min-height:40px; }
      .sn-topicpill .ct { font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--ink-3); }
      .sn-topicpill.hot { border-color:var(--accent); color:var(--accent-deep); font-weight:600; }
      .sn-topicpill.hot .ct { color:var(--accent); }
      .sn-topicpill:active { background:var(--accent-wash); }
      .sn-topicpill.all { border-style:dashed; color:var(--ink-3); text-transform:none; }

      /* ---------- resurfaced verse: set like a pull quote ---------- */
      .sn-resurface { border-left:2px solid var(--ochre); padding:2px 0 2px 15px;
        cursor:pointer; margin:2px 0 6px; }
      .sn-resurface-ref { font-family:'IBM Plex Mono',monospace; font-size:12px; color:#8A6410;
        font-weight:600; letter-spacing:.02em; margin-bottom:7px; }
      .sn-resurface-gist { font-family:'Inter',system-ui,sans-serif; font-size:17px; line-height:1.6;
        color:var(--ink); }
      .sn-resurface-ft { display:flex; align-items:center; flex-wrap:wrap; gap:7px; margin-top:10px; }
      .sn-resurface-ft .ago { margin-left:auto; font-size:11.5px; color:var(--ink-3); }

      /* ---------- lists of entries ---------- */
      .sn-card { background:transparent; border:none; border-bottom:1px solid var(--rule);
        border-radius:0; padding:15px 0; margin:0; position:relative; cursor:pointer; }
      .sn-card:active { background:var(--accent-wash); }
      .sn-ribbon { display:none; }
      .sn-card h3 { margin:0 0 4px; font-family:'Lora',Georgia,serif; font-size:18px;
        font-weight:500; letter-spacing:-.01em; line-height:1.3; padding-right:0; }
      .sn-card .meta { font-size:12px; color:var(--ink-3); margin-bottom:6px; letter-spacing:.01em; }
      .sn-card .snip { font-size:14px; color:var(--ink-2); line-height:1.5; }

      .sn-kind { display:inline-block; font-size:10px; font-weight:600; letter-spacing:.13em;
        text-transform:uppercase; border-radius:0; padding:0; margin-bottom:5px; background:none; }
      .sn-kind-sermon { color:var(--accent); }
      .sn-kind-devotion { color:#8A6410; }

      .sn-recent { display:flex; align-items:center; gap:11px; background:transparent;
        border:none; border-bottom:1px solid var(--rule-soft); border-radius:0;
        padding:13px 0; margin:0; cursor:pointer; font-size:14.5px; min-height:48px; }
      .sn-recent .ttl { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .sn-recent .dt { font-size:11.5px; color:var(--ink-3); flex-shrink:0; }
      .sn-dotkind { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
      .sn-dotkind.ser { background:var(--accent); }
      .sn-dotkind.dev { background:var(--ochre); }

      /* ---------- sermon points ---------- */
      .sn-point { background:var(--card); border:1px solid var(--rule); border-radius:var(--r);
        padding:18px 14px 14px; margin-bottom:12px; position:relative; }
      .sn-point-num { position:absolute; top:-9px; left:14px; background:var(--paper);
        color:var(--ink-3); font-size:10px; font-weight:600; letter-spacing:.13em;
        padding:0 7px; border-radius:0; width:auto; height:auto; display:block; }
      .sn-point-x { position:absolute; top:12px; right:12px; background:none; border:none;
        color:var(--ink-3); font-size:12px; font-weight:500; cursor:pointer; padding:4px; }
      .sn-point-head { width:100%; font-family:'Lora',Georgia,serif; font-size:18px; font-weight:500;
        border:none; border-bottom:1px solid var(--rule); background:transparent;
        padding:4px 0 9px; outline:none; color:var(--ink); margin-bottom:14px; }
      .sn-point-head:focus { border-bottom-color:var(--accent); }
      .sn-point-head::placeholder { color:#B3ABA0; font-style:italic; }

      .sn-row { display:flex; align-items:flex-start; gap:8px; margin-bottom:6px; }
      .sn-marker { font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--ink-3);
        font-weight:600; padding:11px 0 0; min-width:18px; text-align:right; flex-shrink:0;
        background:none; border:none; cursor:pointer; }
      .sn-row textarea { flex:1; font-family:'Inter',sans-serif; font-size:15.5px; line-height:1.55;
        border:none; border-bottom:1px solid transparent; border-radius:0; background:transparent;
        padding:8px 0; outline:none; resize:none; overflow:hidden; color:var(--ink);
        min-height:38px; transition:border-color .15s, height .16s ease; }
      .sn-row textarea:focus { border-bottom-color:var(--accent); background:transparent; box-shadow:none; }
      .sn-row textarea.open { padding:8px 0 10px; }
      .sn-row textarea::placeholder { color:#B3ABA0; }
      .sn-rowtools { display:flex; gap:2px; padding-top:8px; flex-shrink:0; }
      .sn-rowtools button { width:26px; height:26px; border-radius:6px; border:none;
        background:transparent; color:var(--ink-3); font-size:12px; cursor:pointer;
        display:flex; align-items:center; justify-content:center; padding:0; }
      .sn-rowtools button:active { background:var(--rule-soft); }
      .sn-rowtools button:disabled { opacity:.25; }

      /* the V key: small, always in the same place */
      .sn-vbtn { flex-shrink:0; width:26px; height:26px; margin-top:8px; border-radius:6px;
        border:1px solid var(--rule); background:transparent; color:var(--ink-3);
        font-family:'IBM Plex Mono',monospace; font-size:12px; font-weight:600; cursor:pointer;
        display:flex; align-items:center; justify-content:center; padding:0; line-height:1; }
      .sn-vbtn sup { font-size:8px; }
      .sn-vbtn.has { background:var(--ochre-wash); border-color:var(--ochre); color:#8A6410; }

      .sn-stylemenu { background:var(--card); border:1px solid var(--rule); border-radius:var(--r);
        padding:13px; margin:2px 0 12px 26px; box-shadow:0 8px 24px rgba(25,23,19,.09); }
      .sn-stylemenu-hd { font-size:11px; font-weight:600; letter-spacing:.12em; text-transform:uppercase;
        color:var(--ink-3); margin-bottom:9px; }
      .sn-stylemenu-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:7px; }
      .sn-stylemenu-grid button { display:flex; align-items:center; gap:9px; padding:11px 11px;
        border-radius:var(--r); border:1px solid var(--rule); background:transparent; cursor:pointer;
        font-family:'Inter',sans-serif; font-size:13.5px; font-weight:500; color:var(--ink);
        min-height:42px; }
      .sn-stylemenu-grid button.on { border-color:var(--accent); background:var(--accent-wash);
        color:var(--accent-deep); font-weight:600; }
      .sn-stylemenu-grid .pv { font-family:'IBM Plex Mono',monospace; font-size:12px;
        color:var(--ink-3); min-width:15px; }

      /* ---------- scripture: ochre rule, serif, never a button ---------- */
      .sn-chip-row { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
      .sn-chip { display:inline-flex; align-items:center; gap:6px; background:var(--ochre-wash);
        color:var(--ink); border-radius:100px; padding:5px 7px 5px 11px;
        font-size:12.5px; font-weight:500; }
      .sn-chip .sn-mono { color:var(--ink); }
      .sn-chip .sn-mono { font-size:12px; letter-spacing:-.01em; }
      .sn-chip button { background:none; color:#8A6410; border:none; border-radius:50%;
        width:17px; height:17px; font-size:13px; line-height:1; cursor:pointer;
        display:flex; align-items:center; justify-content:center; }
      .sn-chip.has-gist { box-shadow:inset 2px 0 0 var(--ochre); }
      .sn-dot { display:none; }
      .sn-addverse { background:transparent; color:var(--accent); border:1px dashed var(--rule);
        border-radius:100px; padding:6px 13px; font-size:12.5px; font-weight:600; cursor:pointer;
        font-family:'Inter',sans-serif; min-height:32px; }
      .sn-addverse.quiet { color:var(--ink-3); font-weight:500; }

      .sn-gistbox { background:transparent; border-left:2px solid var(--ochre); border-radius:0;
        padding:2px 0 2px 13px; margin-top:10px; }
      .sn-gist-ref { font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:#8A6410;
        font-weight:600; margin-bottom:6px; }
      .sn-gist-read { font-family:'Inter',system-ui,sans-serif; font-size:16px; line-height:1.6;
        color:var(--ink); margin-bottom:6px; }
      .sn-loadtext { background:none; border:none; color:var(--ink-3); font-size:12px; font-weight:600;
        cursor:pointer; padding:6px 0 0; font-family:'Inter',sans-serif; }

      /* ---------- topics ---------- */
      .sn-topicbox { margin-top:14px; padding-top:12px; border-top:1px solid var(--rule-soft); }
      .sn-topic-lbl { font-size:11px; font-weight:600; letter-spacing:.12em; text-transform:uppercase;
        color:var(--ink-3); margin-bottom:8px; }
      .sn-topic { display:inline-flex; align-items:center; gap:6px; background:var(--accent-wash);
        color:var(--accent-deep); border:none; border-radius:100px; padding:6px 7px 6px 12px;
        font-size:13px; font-weight:500; font-family:'Inter',sans-serif; }
      .sn-topic button { background:none; color:var(--accent); border:none; width:16px; height:16px;
        font-size:13px; line-height:1; cursor:pointer; display:flex; align-items:center;
        justify-content:center; }
      .sn-topic.ghost { background:transparent; border:1px solid var(--rule); color:var(--ink-2);
        padding:6px 12px; cursor:pointer; min-height:32px; }
      .sn-topic.ghost.on { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:600; }
      .sn-topic.mini { font-size:11.5px; padding:4px 10px; }
      .sn-topic-input { font-size:15px; padding:8px 0; margin-top:10px; }
      .sn-topic-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
      .sn-topic-card { display:flex; align-items:center; justify-content:space-between; gap:8px;
        background:var(--card); border:1px solid var(--rule); border-radius:var(--r);
        padding:15px 13px; cursor:pointer; font-family:'Inter',sans-serif; text-align:left;
        min-height:56px; }
      .sn-topic-card .name { font-size:15px; font-weight:500; color:var(--ink);
        text-transform:capitalize; overflow:hidden; text-overflow:ellipsis; }
      .sn-topic-card .count { font-family:'IBM Plex Mono',monospace; font-size:12px;
        color:var(--ink-3); flex-shrink:0; }
      .sn-topic-hd { display:flex; align-items:center; justify-content:space-between; gap:10px;
        margin-bottom:16px; }
      .sn-topic-title { font-family:'Lora',Georgia,serif; font-size:24px; font-weight:500;
        text-transform:capitalize; }

      /* ---------- verse index ---------- */
      .sn-freq { display:flex; align-items:center; justify-content:space-between;
        background:transparent; border:none; border-bottom:1px solid var(--rule-soft);
        border-radius:0; padding:13px 0; margin:0; cursor:pointer; min-height:48px; }
      .sn-freq-ct { font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--ink-3);
        background:none; border-radius:0; padding:0; font-weight:500; }
      .sn-srcrow { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink-2);
        padding:7px 0 7px 2px; cursor:pointer; }
      .sn-srcdate { margin-left:auto; font-size:11.5px; color:var(--ink-3); }
      .sn-tseg { display:flex; gap:0; margin-bottom:18px; border-bottom:1px solid var(--rule); }
      .sn-tseg button { flex:1; padding:11px 0 10px; font-size:14px; font-weight:500;
        user-select:none; -webkit-user-select:none;
        border:none; border-bottom:2px solid transparent; background:none; color:var(--ink-3);
        cursor:pointer; margin-bottom:-1px; font-family:'Inter',sans-serif; }
      .sn-tseg button.on { color:var(--ink); font-weight:600; border-bottom-color:var(--accent); }

      /* ---------- detail ---------- */
      .sn-dtl { margin-bottom:24px; }
      .sn-dtl-lbl { font-size:11px; font-weight:600; letter-spacing:.13em; text-transform:uppercase;
        color:var(--ink-3); margin-bottom:8px; }
      .sn-dtl-txt { font-size:16px; line-height:1.65; white-space:pre-wrap; color:var(--ink); }
      .sn-back { background:none; border:none; color:var(--ink-3); font-size:14px; font-weight:500;
        cursor:pointer; padding:4px 0 16px; font-family:'Inter',sans-serif; }
      .sn-hl { background-image:linear-gradient(transparent 55%, var(--ochre-wash) 55%);
        padding:0 2px; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
      .sn-stepno { display:inline-block; font-family:'IBM Plex Mono',monospace; font-size:10px;
        color:#8A6410; margin-right:7px; background:none; width:auto; height:auto;
        border-radius:0; letter-spacing:0; }

      /* ---------- devotion methods ---------- */
      .sn-methods { display:flex; gap:0; border-bottom:1px solid var(--rule); }
      .sn-method { flex:1; padding:10px 4px 9px; font-size:13px; font-weight:500;
        border:none; border-bottom:2px solid transparent; background:none; color:var(--ink-3);
        cursor:pointer; margin-bottom:-1px; font-family:'Inter',sans-serif; letter-spacing:.01em; }
      .sn-method.on { color:var(--ink); font-weight:600; border-bottom-color:var(--ochre); }

      /* ---------- photos ---------- */
      .sn-strip { display:flex; gap:8px; flex-wrap:wrap; }
      .sn-thumb { width:64px; height:64px; border-radius:var(--r); overflow:hidden; padding:0;
        border:1px solid var(--rule); background:var(--card); cursor:pointer; flex-shrink:0;
        display:flex; align-items:center; justify-content:center; }
      .sn-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
      .sn-thumb-ph { color:var(--ink-3); font-size:15px; }
      .sn-thumb.add { flex-direction:column; gap:2px; border-style:dashed; color:var(--ink-3); }
      .sn-thumb.add .ico { font-size:16px; line-height:1; }
      .sn-thumb.add .lbl { font-size:10px; font-weight:600; }
      .sn-photo-sheet { background:var(--paper); width:100%; max-width:480px;
        border-radius:14px 14px 0 0; max-height:92vh; display:flex; flex-direction:column; overflow:hidden; }
      .sn-photo-body { flex:1; overflow:auto; padding:14px; display:flex; align-items:center;
        justify-content:center; background:#E9E4DA; }
      .sn-photo-body img { max-width:100%; max-height:64vh; border-radius:4px; display:block;
        box-shadow:0 8px 28px rgba(25,23,19,.18); }

      /* ---------- verse picker sheet ---------- */
      .sn-overlay { position:fixed; inset:0; background:rgba(25,23,19,.42); z-index:100;
        display:flex; align-items:flex-end; justify-content:center; }
      .sn-sheet { background:var(--paper); width:100%; max-width:480px; border-radius:14px 14px 0 0;
        max-height:88vh; display:flex; flex-direction:column; overflow:hidden; }
      .sn-sheet-hd { padding:16px 18px 13px; border-bottom:1px solid var(--rule); display:flex;
        align-items:center; justify-content:space-between; background:var(--paper); }
      .sn-sheet-hd h3 { margin:0; font-family:'Lora',Georgia,serif; font-size:18px; font-weight:500; }
      .sn-crumb { font-size:12.5px; color:var(--ink-3); margin-top:3px; }
      .sn-sheet-body { overflow-y:auto; padding:14px 16px 22px; -webkit-overflow-scrolling:touch; }
      .sn-x { background:none; border:none; font-size:24px; color:var(--ink-3); cursor:pointer;
        line-height:1; padding:4px 8px; margin:-4px -8px -4px 0; }
      .sn-booklist { display:flex; flex-direction:column; }
      .sn-bookrow { display:flex; align-items:center; gap:10px; padding:14px 2px; cursor:pointer;
        border-bottom:1px solid var(--rule-soft); min-height:50px;
        user-select:none; -webkit-user-select:none; background:none; border-left:none;
        border-right:none; border-top:none; width:100%; text-align:left;
        font-family:'Inter',system-ui,sans-serif; color:var(--ink); }
      .sn-bookrow:active { background:var(--accent-wash); }
      @media (hover: hover) { .sn-bookrow:hover { background:var(--accent-wash); } }
      .sn-bookrow .nm { font-size:16px; font-weight:400; }
      .sn-bookrow .ct { margin-left:auto; font-family:'IBM Plex Mono',monospace;
        font-size:11.5px; color:var(--ink-3); }
      .sn-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:7px; }
      .sn-grid.verses { grid-template-columns:repeat(6,1fr); }
      .sn-cell { aspect-ratio:1; border-radius:var(--r); border:1px solid var(--rule);
        background:var(--card); font-family:'IBM Plex Mono',monospace; font-size:13.5px;
        font-weight:500; color:var(--ink); display:flex; align-items:center;
        justify-content:center; cursor:pointer; }
      .sn-cell:active { background:var(--accent-wash); }
      .sn-cell.sel { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:600; }
      .sn-cell.inrange { background:var(--accent-wash); border-color:#C4D4EE; color:var(--accent-deep); }
      .sn-sheet-ft { padding:13px 16px calc(13px + env(safe-area-inset-bottom));
        border-top:1px solid var(--rule); background:var(--paper); display:flex; gap:10px;
        align-items:center; }
      .sn-hint { font-size:12.5px; color:var(--ink-3); flex:1; }

      /* ---------- drawer ---------- */
      .sn-scrim { position:fixed; inset:0; background:rgba(25,23,19,.38); z-index:80;
        opacity:0; pointer-events:none; transition:opacity .2s; }
      .sn-scrim.on { opacity:1; pointer-events:auto; }
      .sn-drawer { position:fixed; top:0; left:0; bottom:0; width:262px; max-width:82vw; z-index:90;
        background:var(--paper); border-right:1px solid var(--rule);
        transform:translateX(-100%); transition:transform .24s cubic-bezier(.32,.72,0,1);
        padding:18px 12px calc(18px + env(safe-area-inset-bottom));
        display:flex; flex-direction:column; gap:1px; }
      .sn-drawer.on { transform:translateX(0); box-shadow:0 0 40px rgba(25,23,19,.14); }
      .sn-drawer-hd { display:flex; align-items:center; justify-content:space-between;
        padding:4px 8px 18px; border-bottom:1px solid var(--rule); margin-bottom:10px; }
      .sn-drawer-hd .sn-brand { font-family:'Lora',Georgia,serif; font-size:19px; font-weight:600; }
      .sn-drawer-item { display:flex; align-items:center; gap:13px; width:100%; text-align:left;
        background:none; border:none; border-radius:var(--r); padding:13px 12px; cursor:pointer;
        font-family:'Inter',sans-serif; font-size:15px; font-weight:500; color:var(--ink);
        min-height:48px; }
      .sn-drawer-item.on { background:var(--accent-wash); color:var(--accent-deep); font-weight:600; }
      .sn-drawer-item .ico { font-size:15px; width:19px; color:var(--ink-3);
        display:flex; align-items:center; justify-content:center; }
      .sn-drawer-item .ico svg { display:block; }
      .sn-drawer-item.on .ico { color:var(--accent); }
      .sn-drawer-item .ct { margin-left:auto; font-family:'IBM Plex Mono',monospace;
        font-size:11.5px; color:var(--ink-3); }

      /* ---------- misc ---------- */
      .sn-empty { text-align:center; padding:56px 20px; color:var(--ink-3); font-size:14.5px;
        line-height:1.6; }
      .sn-empty .ico { font-size:24px; margin-bottom:12px; opacity:.5; }
      .sn-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
        background:var(--ink); color:var(--paper); font-size:13.5px; font-weight:500;
        padding:11px 18px; border-radius:100px; z-index:60; box-shadow:0 6px 20px rgba(25,23,19,.2); }
      .sn-statrow { display:flex; align-items:center; justify-content:space-between;
        background:transparent; border:none; border-bottom:1px solid var(--rule-soft);
        border-radius:0; padding:13px 0; margin:0; font-size:14.5px; }
      .sn-pill { font-family:'IBM Plex Mono',monospace; font-size:12px; font-weight:500;
        border-radius:0; padding:0; background:none; color:var(--ink-3); }
      .sn-pill.good { color:var(--good); }
      .sn-pill.warn { color:#8A6410; }
      .sn-confirm { border:1px solid var(--accent); border-radius:var(--r); padding:15px;
        margin-top:14px; background:var(--accent-wash); }
      .sn-confirm-hd { font-size:15px; font-weight:600; margin-bottom:7px; }
      .sn-testres { font-size:13px; line-height:1.5; border-radius:var(--r); padding:11px 13px;
        margin-bottom:8px; }
      .sn-testres.ok { background:transparent; color:var(--good); border:1px solid #C9DCD1; }
      .sn-testres.bad { background:transparent; color:var(--alert); border:1px solid #E4CDC5; }
      .sn-check { display:flex; align-items:flex-start; gap:10px; font-size:14.5px; line-height:1.45;
        padding:4px 0; cursor:pointer; }
      .sn-check input { margin-top:3px; accent-color:var(--accent); }
      .sn-callout { border-left:2px solid var(--accent); padding:2px 0 2px 14px; font-size:13.5px;
        line-height:1.55; color:var(--ink-2); margin-bottom:22px; }

      .sn-draftbar { display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--ink-3);
        padding:12px 0 2px; }
      .sn-draftbar.restored { border:none; border-left:2px solid var(--accent); background:transparent;
        color:var(--ink-2); border-radius:0; padding:2px 0 2px 14px; font-size:13.5px;
        margin-bottom:20px; justify-content:space-between; }
      .sn-draftbar.restored button { background:none; border:none; color:var(--accent);
        font-family:'Inter',sans-serif; font-size:13px; font-weight:600; cursor:pointer;
        padding:0; flex-shrink:0; text-decoration:none; }
      .sn-dotsave { width:5px; height:5px; border-radius:50%; background:var(--rule); flex-shrink:0;
        transition:background .2s; }
      .sn-dotsave.on { background:var(--good); }
      .sn-streak { font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:#8A6410;
        background:none; border-radius:0; padding:0; font-weight:500; }

      @media (prefers-reduced-motion: reduce) {
        .sn-drawer, .sn-scrim, .sn-row textarea { transition:none; }
      }
    `}</style>
  );
}

/* ===============================================================
   VERSE PICKER — Book → Chapter → Verse (with optional range)
   =============================================================== */
function VersePicker({ onPick, onClose }) {
  const [stage, setStage] = useState("book");
  const [testament, setTestament] = useState("All");
  const [q, setQ] = useState("");
  const [book, setBook] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [vStart, setVStart] = useState(null);
  const [vEnd, setVEnd] = useState(null);

  const books = useMemo(() => {
    let list = matchBooks(q);
    if (testament !== "All") list = list.filter((b) => b.testament === testament);
    return list;
  }, [q, testament]);

  /* Bounds can be passed explicitly so a confirming tap doesn't have to wait
     for a state update it just triggered. */
  const commit = (a, b) => {
    if (!book || !chapter) return;
    const lo = typeof a === "number" ? Math.min(a, b ?? a) : Math.min(vStart, vEnd ?? vStart);
    const hi = typeof a === "number" ? Math.max(a, b ?? a) : Math.max(vStart, vEnd ?? vStart);
    if (!lo) return;
    onPick(lo === hi ? `${book.name} ${chapter}:${lo}` : `${book.name} ${chapter}:${lo}-${hi}`);
    onClose();
  };

  /* Tapping the selected verse again confirms it, so a single verse takes
     two taps in the same spot rather than a trip to the Add button. */
  const pickVerse = (v) => {
    if (vStart !== null && vEnd === null && v === vStart) { commit(v, v); return; }
    if (vStart !== null && vEnd !== null && (v === vStart || v === vEnd)) {
      commit(Math.min(vStart, vEnd), Math.max(vStart, vEnd));
      return;
    }
    if (vStart === null || vEnd !== null) { setVStart(v); setVEnd(null); }
    else setVEnd(v);
  };

  const crumb = stage === "book" ? "Choose a book"
    : stage === "chapter" ? book.name
    : `${book.name} ${chapter}`;

  return (
    <div className="sn-overlay" onClick={onClose}>
      <div className="sn-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sn-sheet-hd">
          <div>
            <h3>Add verse</h3>
            <div className="sn-crumb">{crumb}</div>
          </div>
          <button className="sn-x" onClick={onClose}>×</button>
        </div>

        <div className="sn-sheet-body">
          {stage === "book" && (
            <>
              <input className="sn-input" placeholder="Jump to a book…" value={q}
                onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
              <div className="sn-tseg">
                {["All", "Old", "New"].map((t) => (
                  <button key={t} className={testament === t ? "on" : ""} onClick={() => setTestament(t)}>
                    {t === "All" ? "All books" : `${t} Testament`}
                  </button>
                ))}
              </div>
              <div className="sn-booklist">
                {books.map((b) => (
                  <div className="sn-bookrow" key={b.name}
                    onClick={() => { setBook(b); setStage("chapter"); }}>
                    <span className="nm">{b.name}</span>
                    <span className="ct">{b.verses.length} ch</span>
                  </div>
                ))}
                {books.length === 0 && <div className="sn-empty">No book matches that.</div>}
              </div>
            </>
          )}

          {stage === "chapter" && (
            <>
              <button className="sn-back" onClick={() => setStage("book")}>‹ All books</button>
              <div className="sn-grid">
                {book.verses.map((_, i) => (
                  <button key={i} className="sn-cell"
                    onClick={() => { setChapter(i + 1); setVStart(null); setVEnd(null); setStage("verse"); }}
                    onDoubleClick={() => { onPick(`${book.name} ${i + 1}`); onClose(); }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </>
          )}

          {stage === "verse" && (
            <>
              <button className="sn-back" onClick={() => setStage("chapter")}>‹ {book.name} chapters</button>
              <div className="sn-grid verses">
                {Array.from({ length: book.verses[chapter - 1] }, (_, i) => i + 1).map((v) => {
                  const lo = vEnd ? Math.min(vStart, vEnd) : vStart;
                  const hi = vEnd ? Math.max(vStart, vEnd) : vStart;
                  const sel = v === vStart || v === vEnd;
                  const inR = vEnd && v > lo && v < hi;
                  return (
                    <button key={v} className={"sn-cell" + (sel ? " sel" : inR ? " inrange" : "")}
                      onClick={() => pickVerse(v)}>{v}</button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {stage === "verse" && (
          <div className="sn-sheet-ft">
            <span className="sn-hint">
              {vStart === null
                ? "Tap a verse, then tap it again to add it."
                : vEnd
                  ? `${book.name} ${chapter}:${Math.min(vStart, vEnd)}-${Math.max(vStart, vEnd)} · tap either end to add`
                  : `${book.name} ${chapter}:${vStart} · tap again to add, or another verse for a range`}
            </span>
            <button className="sn-btn sn-btn-accent sn-btn-sm" disabled={vStart === null}
              onClick={() => commit()}>Add</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Verse chips + "add verse" launcher */
/* A verse entry is { ref, gist }. Older notes stored plain strings. */
const asVerse = (v) => (typeof v === "string" ? { ref: v, gist: "" } : v);
const normVerses = (list) => (list || []).map(asVerse);

/* Topic tag editor for a single reference */
function TopicTags({ refStr, readOnly }) {
  const { topics, setTopicsFor } = React.useContext(TopicsContext);
  const [draft, setDraft] = useState("");
  const mine = topics[refStr] || [];

  const add = (raw) => {
    const t = normTopic(raw);
    if (!t || mine.includes(t)) { setDraft(""); return; }
    setTopicsFor(refStr, [...mine, t]);
    setDraft("");
  };
  const remove = (t) => setTopicsFor(refStr, mine.filter((x) => x !== t));

  const known = Object.values(topics).flat();
  const pool = [...new Set([...known, ...SUGGESTED_TOPICS])];
  const suggestions = draft.trim()
    ? pool.filter((t) => t.startsWith(normTopic(draft)) && !mine.includes(t)).slice(0, 5)
    : pool.filter((t) => !mine.includes(t)).slice(0, 6);

  if (readOnly && mine.length === 0) return null;

  return (
    <div className="sn-topicbox">
      <div className="sn-topic-lbl">Topics</div>
      <div className="sn-chip-row">
        {mine.map((t) => (
          <span className="sn-topic" key={t}>
            {t}
            {!readOnly && <button onClick={() => remove(t)}>×</button>}
          </span>
        ))}
        {mine.length === 0 && readOnly && <span className="sn-note">None yet.</span>}
      </div>

      {!readOnly && (
        <>
          <input className="sn-input sn-topic-input" placeholder="Add a topic, e.g. patience"
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            }} />
          {suggestions.length > 0 && (
            <div className="sn-chip-row" style={{ marginTop: 6 }}>
              {suggestions.map((t) => (
                <button className="sn-topic ghost" key={t} onClick={() => add(t)}>+ {t}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VerseChips({ verses, onChange, label, readOnly, quiet, hideAdd }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const list = normVerses(verses);

  const patch = (i, gist) => onChange(list.map((v, j) => (j === i ? { ...v, gist } : v)));

  return (
    <>
      <div className="sn-chip-row">
        {list.map((v, i) => (
          <span className={"sn-chip" + (v.gist ? " has-gist" : "")} key={v.ref + i}>
            <span className="sn-mono" onClick={() => setEditing(editing === i ? null : i)}
              style={{ cursor: "pointer" }}>{v.ref}</span>
            {v.gist && <span className="sn-dot" title="Has a summary" />}
            {!readOnly && (
              <button onClick={() => { setEditing(null); onChange(list.filter((_, j) => j !== i)); }}>×</button>
            )}
          </span>
        ))}
        {!readOnly && !hideAdd && (
          <button className={"sn-addverse" + (quiet && list.length === 0 ? " quiet" : "")}
            onClick={() => setOpen(true)}>+ {label || "Verse"}</button>
        )}
      </div>

      {/* Expanded summary for the tapped reference */}
      {editing !== null && list[editing] && (
        <div className="sn-gistbox">
          <div className="sn-gist-ref sn-mono">{list[editing].ref}</div>
          <ScriptureText refStr={list[editing].ref} compact />
          {readOnly ? (
            <div className="sn-gist-read">{list[editing].gist || "No summary yet."}</div>
          ) : (
            <textarea className="sn-textarea" style={{ minHeight: 54, fontSize: 14 }}
              placeholder="What does this passage say? In your own words…"
              value={list[editing].gist}
              onChange={(e) => patch(editing, e.target.value)} />
          )}
          <TopicTags refStr={list[editing].ref} readOnly={readOnly} />
          <button className="sn-loadtext" onClick={() => setEditing(null)}>Close</button>
        </div>
      )}

      {open && (
        <VersePicker onClose={() => setOpen(false)}
          onPick={(ref) => {
            if (!list.some((v) => v.ref === ref)) onChange([...list, { ref, gist: "" }]);
          }} />
      )}
    </>
  );
}

/* ===============================================================
   TIERED LIST EDITOR
   =============================================================== */
const LIST_STYLES = [
  { id: "bullet", label: "Bullets" },
  { id: "number", label: "Numbered" },
  { id: "letter", label: "Lettered" },
  { id: "dash", label: "Dashes" },
];

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];

/* One marker per style, the same at every depth — what you pick is what you get. */
function markerFor(style, level, ordinal) {
  switch (style) {
    case "number": return `${ordinal}.`;
    case "letter": return `${String.fromCharCode(64 + ((ordinal - 1) % 26) + 1)}.`;
    case "roman":  return `${ROMAN[(ordinal - 1) % 12]}.`;
    case "dash":   return "–";
    default:       return level === 0 ? "•" : level === 1 ? "◦" : "▪";
  }
}

/* ---------------------------------------------------------------
   Grouping
   Lines that sit at the same depth under the same parent form a
   group, and a group shares one marker style. Change any line in
   the group and the whole group changes. Each nested list is its
   own group with its own style.
--------------------------------------------------------------- */
const ROOT_GROUP = "root";

function layoutItems(items, groupStyles = {}) {
  const parentStack = [];      // most recent item id seen at each level
  const counters = {};         // ordinal per group

  return items.map((it) => {
    const lv = it.level;
    const groupId = lv === 0 ? ROOT_GROUP : (parentStack[lv - 1] || ROOT_GROUP);

    counters[groupId] = (counters[groupId] || 0) + 1;
    parentStack[lv] = it.id;
    parentStack.length = lv + 1;   // deeper parents no longer apply

    const style = groupStyles[groupId] || "bullet";
    return { ...it, groupId, ordinal: counters[groupId], style };
  });
}

/* Older notes kept one style per point; treat it as the root group's style. */
function pointGroupStyles(p) {
  if (p.groupStyles) return p.groupStyles;
  return { [ROOT_GROUP]: p.listStyle || "bullet" };
}

function AutoTextarea({ value, onChange, placeholder, onKeyDown }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);

  /* Idle rows hug their text; the focused row opens up to give room to write. */
  const FOCUSED_MIN = 80;
  const IDLE_MIN = 36;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, focused ? FOCUSED_MIN : IDLE_MIN) + "px";
  }, [value, focused]);

  return (
    <textarea ref={ref} rows={1} value={value} placeholder={placeholder}
      className={focused ? "open" : ""}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)} />
  );
}

function TieredList({ items, groupStyles, onItems, onGroupStyles }) {
  const laid = layoutItems(items, groupStyles);
  const [styleMenu, setStyleMenu] = useState(null);
  const [pickerFor, setPickerFor] = useState(null);   // line id awaiting a verse

  const update = (id, patch) => onItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id) => onItems(items.filter((it) => it.id !== id));
  const addAfter = (idx, level) => {
    const next = [...items];
    next.splice(idx + 1, 0, { id: uid(), text: "", level, verses: [] });
    onItems(next);
  };
  const indent = (it, idx) => {
    const prevLevel = idx > 0 ? items[idx - 1].level : -1;
    const max = Math.min(2, prevLevel + 1);
    if (it.level < max) update(it.id, { level: it.level + 1 });
  };
  const outdent = (it) => { if (it.level > 0) update(it.id, { level: it.level - 1 }); };

  /* Setting a style hits the whole group the line belongs to. */
  const setGroupStyle = (groupId, styleId) => {
    onGroupStyles({ ...groupStyles, [groupId]: styleId });
    setStyleMenu(null);
  };

  const groupSize = (groupId) => laid.filter((x) => x.groupId === groupId).length;

  return (
    <>
      {laid.map((it, idx) => (
        <div key={it.id}>
          <div className="sn-row" style={{ paddingLeft: it.level * 16 }}>
            <button className={"sn-vbtn" + (it.verses.length ? " has" : "")}
              title="Attach a verse to this line"
              onClick={() => setPickerFor(it.id)}>
              V{it.verses.length > 1 ? <sup>{it.verses.length}</sup> : ""}
            </button>

            <button className="sn-marker" title="Change the markers for this list"
              onClick={() => setStyleMenu(styleMenu === it.groupId ? null : it.groupId)}>
              {markerFor(it.style, it.level, it.ordinal)}
            </button>

            <AutoTextarea
              value={it.text}
              placeholder={it.level === 0 ? "Sub-point…" : "Detail…"}
              onChange={(v) => update(it.id, { text: v })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addAfter(idx, it.level); }
                if (e.key === "Tab") { e.preventDefault(); e.shiftKey ? outdent(it) : indent(it, idx); }
                if (e.key === "Backspace" && it.text === "" && items.length > 1) { e.preventDefault(); removeItem(it.id); }
              }}
            />

            <div className="sn-rowtools">
              <button onClick={() => outdent(it)} disabled={it.level === 0} title="Outdent">←</button>
              <button onClick={() => indent(it, idx)}
                disabled={it.level >= Math.min(2, (idx > 0 ? items[idx - 1].level : -1) + 1)} title="Indent">→</button>
              <button onClick={() => removeItem(it.id)} disabled={items.length === 1} title="Remove">×</button>
            </div>
          </div>

          {it.verses.length > 0 && (
            <div style={{ paddingLeft: it.level * 16 + 30, marginBottom: 8 }}>
              <VerseChips verses={it.verses} onChange={(v) => update(it.id, { verses: v })} hideAdd />
            </div>
          )}

          {styleMenu === it.groupId && laid.findIndex((x) => x.groupId === it.groupId) === idx && (
            <div className="sn-stylemenu" style={{ marginLeft: it.level * 18 }}>
              <div className="sn-stylemenu-hd">
                Markers for {groupSize(it.groupId) === 1 ? "this line" : `these ${groupSize(it.groupId)} lines`}
              </div>
              <div className="sn-stylemenu-grid">
                {LIST_STYLES.map((sOpt) => (
                  <button key={sOpt.id} className={it.style === sOpt.id ? "on" : ""}
                    onClick={() => setGroupStyle(it.groupId, sOpt.id)}>
                    <span className="pv">{markerFor(sOpt.id, it.level, 1)}</span>
                    {sOpt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <button className="sn-btn sn-btn-ghost sn-btn-sm" style={{ marginTop: 4 }}
        onClick={() => addAfter(items.length - 1, items[items.length - 1]?.level || 0)}>+ Line</button>

      {pickerFor && (
        <VersePicker onClose={() => setPickerFor(null)}
          onPick={(ref) => {
            const target = items.find((x) => x.id === pickerFor);
            const cur = normVerses(target?.verses || []);
            if (!cur.some((v) => v.ref === ref)) {
              update(pickerFor, { verses: [...cur, { ref, gist: "" }] });
            }
          }} />
      )}
    </>
  );
}

/* ===============================================================
   NOTE FORM
   =============================================================== */
const newItem = (level = 0) => ({ id: uid(), text: "", level, verses: [] });
const newPoint = () => ({ id: uid(), header: "", verses: [], groupStyles: {}, items: [newItem()] });

function emptyNote() {
  return {
    id: uid(), title: "", speaker: "", date: new Date().toISOString().slice(0, 10),
    series: "", mainPassage: [], bigIdea: "", points: [newPoint()],
    application: "", freeNotes: "", photos: [], createdAt: Date.now(),
  };
}


/* ===============================================================
   DRAFTS
   ---------------------------------------------------------------
   Anything typed into a form is written to disk continuously, so
   leaving the screen — switching tabs, taking a call, the OS
   reclaiming memory mid-service — never loses work.
   =============================================================== */
async function loadDraft(kind) {
  try {
    const r = await storage.get("draft-" + kind);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function saveDraft(kind, obj) {
  try { await storage.set("draft-" + kind, JSON.stringify(obj)); return true; }
  catch { return false; }
}
async function clearDraft(kind) {
  try { await storage.delete("draft-" + kind); } catch {}
}

/* Is there anything in here worth keeping? */
function isBlankSermon(n) {
  return !n.title?.trim() && !n.bigIdea?.trim() && !n.speaker?.trim() &&
    !n.series?.trim() && !n.application?.trim() && !n.freeNotes?.trim() &&
    (n.mainPassage || []).length === 0 && (n.photos || []).length === 0 &&
    (n.points || []).every((p) => !p.header?.trim() &&
      (p.verses || []).length === 0 &&
      (p.items || []).every((i) => !i.text?.trim() && (i.verses || []).length === 0));
}
function isBlankDevotion(d) {
  return !d.title?.trim() && !d.mood &&
    (d.passage || []).length === 0 && (d.crossRefs || []).length === 0 &&
    (d.photos || []).length === 0 &&
    Object.values(d.fields || {}).every((v) => !v?.trim());
}

/* Shared autosave wiring for both forms */
function useDraft(kind, value, isBlank, active) {
  const [status, setStatus] = useState("idle");   // idle | saving | saved
  const first = useRef(true);
  const latest = useRef(value);
  latest.current = value;

  /* Debounced save while typing */
  useEffect(() => {
    if (!active) return;
    if (first.current) { first.current = false; return; }
    if (isBlank(value)) return;

    setStatus("saving");
    const t = setTimeout(async () => {
      await saveDraft(kind, value);
      setStatus("saved");
    }, 500);
    return () => clearTimeout(t);
  }, [value, active, kind]);

  /* Flush immediately when the screen goes away or the app is backgrounded,
     so the last few keystrokes before a tab switch aren't stranded in the
     debounce window. */
  useEffect(() => {
    if (!active) return;

    const flush = () => {
      if (!isBlank(latest.current)) saveDraft(kind, latest.current);
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();   // unmounting counts too — this is the tab-switch case
    };
  }, [active, kind]);

  return status;
}

function DraftBar({ status, restored, onDiscard }) {
  if (restored) {
    return (
      <div className="sn-draftbar restored">
        <span>Unsaved draft restored.</span>
        <button onClick={onDiscard}>Discard it</button>
      </div>
    );
  }
  if (status === "idle") return null;
  return (
    <div className="sn-draftbar">
      <span className={"sn-dotsave" + (status === "saved" ? " on" : "")} />
      {status === "saved" ? "Draft saved on this device" : "Saving…"}
    </div>
  );
}

function NoteForm({ initial, onSave, onCancel }) {
  const [note, setNote] = useState(initial || emptyNote());
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(!!initial);
  const set = (k, v) => setNote((n) => ({ ...n, [k]: v }));

  /* Pick up anything left behind last time this screen was open */
  useEffect(() => {
    if (initial) return;
    let alive = true;
    loadDraft("sermon").then((d) => {
      if (!alive) return;
      if (d && !isBlankSermon(d)) { setNote(d); setRestored(true); }
      setReady(true);
    });
    return () => { alive = false; };
  }, [initial]);

  const draftStatus = useDraft("sermon", note, isBlankSermon, ready);

  const discardDraft = async () => {
    await clearDraft("sermon");
    setNote(emptyNote());
    setRestored(false);
  };

  const submit = async () => {
    await clearDraft("sermon");
    onSave(note);
  };

  const cancel = async () => {
    await clearDraft("sermon");
    onCancel();
  };
  const patchPoint = (id, patch) =>
    setNote((n) => ({ ...n, points: n.points.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  return (
    <div className="sn-scroll">
      {restored && <DraftBar restored onDiscard={discardDraft} />}
      <div className="sn-field">
        <label className="sn-label">Sermon title</label>
        <input className="sn-input" placeholder="e.g. Grace That Sustains"
          value={note.title} onChange={(e) => set("title", e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 10, width: "100%" }}>
        <div className="sn-field" style={{ flex: "1 1 auto", minWidth: 0 }}>
          <label className="sn-label">Speaker</label>
          <input className="sn-input" placeholder="Pastor name" value={note.speaker}
            onChange={(e) => set("speaker", e.target.value)} />
        </div>
        <div className="sn-field" style={{ flex: "0 1 124px", minWidth: 0, maxWidth: 124, overflow: "hidden" }}>
          <label className="sn-label">Date</label>
          <input className="sn-input sn-input-date" type="date" value={note.date}
            onChange={(e) => set("date", e.target.value)} />
        </div>
      </div>

      <div className="sn-field">
        <label className="sn-label">Series (optional)</label>
        <input className="sn-input" placeholder="e.g. Book of Romans" value={note.series}
          onChange={(e) => set("series", e.target.value)} />
      </div>

      <div className="sn-field">
        <label className="sn-label">Main passage</label>
        <VerseChips verses={note.mainPassage} onChange={(v) => set("mainPassage", v)} label="Passage" />
      </div>

      <div className="sn-field">
        <label className="sn-label">Big idea</label>
        <textarea className="sn-textarea" placeholder="The one sentence you want to remember…"
          value={note.bigIdea} onChange={(e) => set("bigIdea", e.target.value)} />
      </div>

      <div className="sn-secttl">Sermon points</div>
      {note.points.map((p, i) => (
        <div className="sn-point" key={p.id}>
          <div className="sn-point-num">Point {i + 1}</div>
          {note.points.length > 1 && (
            <button className="sn-point-x"
              onClick={() => set("points", note.points.filter((x) => x.id !== p.id))}>remove</button>
          )}
          <input className="sn-point-head" placeholder="Main point…" value={p.header}
            onChange={(e) => patchPoint(p.id, { header: e.target.value })} style={{ marginTop: 6 }} />
          <div style={{ marginBottom: 12 }}>
            <VerseChips verses={p.verses} onChange={(v) => patchPoint(p.id, { verses: v })} label="Verse" />
          </div>
          <TieredList
            items={p.items}
            groupStyles={pointGroupStyles(p)}
            onItems={(items) => patchPoint(p.id, { items })}
            onGroupStyles={(gs) => patchPoint(p.id, { groupStyles: gs })}
          />
        </div>
      ))}
      <button className="sn-btn sn-btn-ghost sn-btn-full" onClick={() => set("points", [...note.points, newPoint()])}>
        + Add sermon point
      </button>

      <div className="sn-field" style={{ marginTop: 18 }}>
        <label className="sn-label">Photos of handwritten notes</label>
        <PhotoStrip photos={note.photos} onChange={(p) => set("photos", p)} />
      </div>

      <div className="sn-field">
        <label className="sn-label">Application</label>
        <textarea className="sn-textarea" placeholder="What will you do differently this week?"
          value={note.application} onChange={(e) => set("application", e.target.value)} />
      </div>

      <div className="sn-field">
        <label className="sn-label">Other notes</label>
        <textarea className="sn-textarea" placeholder="Quotes, stories, questions to follow up…"
          value={note.freeNotes} onChange={(e) => set("freeNotes", e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        {onCancel && <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }} onClick={cancel}>Cancel</button>}
        <button className="sn-btn sn-btn-accent" style={{ flex: 2 }} disabled={!note.title.trim()}
          onClick={submit}>{initial ? "Save changes" : "Save note"}</button>
      </div>
      <DraftBar status={draftStatus} restored={restored} onDiscard={discardDraft} />
    </div>
  );
}

/* ===============================================================
   DETAIL VIEW
   =============================================================== */
function allVerses(item) {
  if (item.kind === "devotion") {
    return normVerses([...(item.passage || []), ...(item.crossRefs || [])]);
  }
  return normVerses([
    ...(item.mainPassage || []),
    ...(item.points || []).flatMap((p) => [
      ...(p.verses || []),
      ...(p.items || []).flatMap((i) => i.verses || []),
    ]),
  ]);
}

/* Plain-text haystack for searching either kind of entry */
function searchText(item) {
  const base = [item.title, item.date, ...allVerses(item).flatMap((v) => [v.ref, v.gist])];
  if (item.kind === "devotion") {
    return [...base, devotionText(item), item.mood, METHODS[item.method]?.label || ""].join(" ");
  }
  return [...base, item.speaker, item.series, item.bigIdea, item.application, item.freeNotes,
    ...(item.points || []).flatMap((p) => [p.header, ...(p.items || []).map((i) => i.text)]),
  ].join(" ");
}

/* Read-only verse display: reference, plus the summary if one was written */
function VerseList({ verses, indent = 0 }) {
  const list = normVerses(verses);
  if (list.length === 0) return null;
  return (
    <div style={{ paddingLeft: indent, marginBottom: 6 }}>
      <div className="sn-chip-row">
        {list.map((v, i) => <span className="sn-chip" key={i}><span className="sn-mono">{v.ref}</span></span>)}
      </div>
      {list.filter((v) => v.gist?.trim()).map((v, i) => (
        <div className="sn-gistbox" key={i} style={{ marginTop: 6 }}>
          <div className="sn-gist-ref sn-mono">{v.ref}</div>
          <div className="sn-gist-read">{v.gist}</div>
        </div>
      ))}
    </div>
  );
}

function NoteDetail({ note, onBack, onEdit, onDelete }) {
  return (
    <div className="sn-scroll">
      <button className="sn-back" onClick={onBack}>‹ Back</button>
      <h2 className="sn-serif" style={{ margin: "0 0 3px", fontSize: 24, fontWeight: 500, lineHeight: 1.25 }}>{note.title}</h2>
      <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 18 }}>
        {note.speaker && <>{note.speaker} · </>}
        {new Date(note.date + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        {note.series && <> · {note.series}</>}
      </div>

      {note.mainPassage.length > 0 && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Main passage</div>
          <VerseList verses={note.mainPassage} />
        </div>
      )}

      {note.bigIdea && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Big idea</div>
          <div className="sn-dtl-txt" style={{ fontSize: 17, lineHeight: 1.7 }}>
            <span className="sn-hl">{note.bigIdea}</span>
          </div>
        </div>
      )}

      {note.points.some((p) => p.header || p.items.some((i) => i.text)) && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Points</div>
          {note.points.map((p, i) => {
            const items = layoutItems(p.items, pointGroupStyles(p)).filter((it) => it.text.trim());
            if (!p.header && items.length === 0) return null;
            return (
              <div key={p.id} style={{ marginBottom: 16 }}>
                <div className="sn-serif" style={{ fontSize: 17.5, fontWeight: 500, marginBottom: 6 }}>
                  {i + 1}. {p.header}
                </div>
                {p.verses?.length > 0 && <VerseList verses={p.verses} />}
                {items.map((it) => (
                  <div key={it.id} style={{ paddingLeft: it.level * 16, marginBottom: 5 }}>
                    <div style={{ display: "flex", gap: 7, fontSize: 14, lineHeight: 1.45 }}>
                      <span style={{ color: "var(--accent-deep)", fontWeight: 600, minWidth: 16 }}>
                        {markerFor(it.style, it.level, it.ordinal)}
                      </span>
                      <span>{it.text}</span>
                    </div>
                    {it.verses?.length > 0 && <VerseList verses={it.verses} indent={23} />}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {(note.photos || []).length > 0 && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Handwritten</div>
          <PhotoStrip photos={note.photos} readOnly />
        </div>
      )}

      {note.application && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Application</div>
          <div className="sn-dtl-txt">{note.application}</div>
        </div>
      )}
      {note.freeNotes && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Other notes</div>
          <div className="sn-dtl-txt">{note.freeNotes}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="sn-btn sn-btn-danger" style={{ flex: 1 }} onClick={() => onDelete(note.id)}>Delete</button>
        <button className="sn-btn sn-btn-primary" style={{ flex: 2 }} onClick={() => onEdit(note)}>Edit note</button>
      </div>
    </div>
  );
}

/* ===============================================================
   NOTES LIST
   =============================================================== */
function Library({ entries, onOpen }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");   // all | sermon | devotion

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "all" && (e.kind || "sermon") !== filter) return false;
      if (!query) return true;
      return searchText(e).toLowerCase().includes(query);
    });
  }, [entries, q, filter]);

  const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="sn-scroll">
      <div className="sn-tseg" style={{ marginBottom: 10 }}>
        {[["all", "Everything"], ["sermon", "Sermons"], ["devotion", "Devotions"]].map(([id, label]) => (
          <button key={id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      <div className="sn-search">
        <span className="ico">⌕</span>
        <input placeholder="Search everything — verses, topics, words…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button className="clear" onClick={() => setQ("")}>×</button>}
      </div>

      {sorted.length === 0 ? (
        <div className="sn-empty">
          <div className="ico">📖</div>
          {entries.length === 0
            ? "Nothing saved yet. Start with a sermon or a devotion."
            : "Nothing matches that."}
        </div>
      ) : sorted.map((e) => {
        const isDev = e.kind === "devotion";
        const vc = allVerses(e).length;
        return (
          <div className={"sn-card" + (isDev ? " devotion" : "")} key={e.id} onClick={() => onOpen(e)}>
            <div className="sn-ribbon" />
            <div className={"sn-kind " + (isDev ? "sn-kind-devotion" : "sn-kind-sermon")}>
              {isDev ? "Devotion" : "Sermon"}
            </div>
            <h3>{e.title || (isDev ? "Devotion" : "Untitled")}</h3>
            <div className="meta">
              {new Date(e.date + "T00:00:00").toLocaleDateString(undefined,
                { month: "short", day: "numeric", year: "numeric" })}
              {!isDev && e.speaker && <> · {e.speaker}</>}
              {isDev && e.method && e.method !== "free" && <> · {METHODS[e.method]?.label}</>}
              {isDev && e.mood && <> · {e.mood}</>}
              {vc > 0 && <> · {vc} verse{vc > 1 ? "s" : ""}</>}
              {(e.photos || []).length > 0 && <> · {e.photos.length} 📷</>}
            </div>
            {(isDev ? devotionText(e).trim() : e.bigIdea) && (
              <div className="snip">{(isDev ? devotionText(e).trim() : e.bigIdea).slice(0, 140)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===============================================================
   PHOTO STRIP — attach and review pictures of handwritten notes
   =============================================================== */
function PhotoThumb({ meta, onOpen }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    photoStore.get(meta.id).then((d) => { if (alive) setSrc(d); });
    return () => { alive = false; };
  }, [meta.id]);

  return (
    <button className="sn-thumb" onClick={() => onOpen(meta, src)}>
      {src
        ? <img src={src} alt={meta.caption || "Handwritten note"} />
        : <span className="sn-thumb-ph">…</span>}
    </button>
  );
}

function PhotoViewer({ meta, src, onClose, onDelete, onCaption, readOnly }) {
  const [caption, setCaption] = useState(meta.caption || "");
  return (
    <div className="sn-overlay" onClick={onClose}>
      <div className="sn-photo-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sn-sheet-hd">
          <div>
            <h3>Photo</h3>
            <div className="sn-crumb">
              {new Date(meta.addedAt).toLocaleDateString()} · {meta.kb} KB
            </div>
          </div>
          <button className="sn-x" onClick={onClose}>×</button>
        </div>

        <div className="sn-photo-body">
          {src ? <img src={src} alt={caption || "Handwritten note"} />
               : <div className="sn-empty">Image unavailable.</div>}
        </div>

        <div className="sn-sheet-ft" style={{ flexDirection: "column", alignItems: "stretch", gap: 9 }}>
          {readOnly ? (
            caption ? <div className="sn-note" style={{ margin: 0 }}>{caption}</div> : null
          ) : (
            <input className="sn-input" placeholder="Caption — optional"
              value={caption}
              onChange={(e) => { setCaption(e.target.value); onCaption(e.target.value); }} />
          )}
          {!readOnly && (
            <button className="sn-btn sn-btn-danger sn-btn-sm"
              onClick={() => { onDelete(meta.id); onClose(); }}>Remove photo</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoStrip({ photos, onChange, readOnly, label }) {
  const list = photos || [];
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);

  const addFiles = async (files) => {
    setBusy(true); setErr(null);
    const added = [];
    for (const file of Array.from(files).slice(0, 8)) {
      try {
        const { dataUrl, width, height } = await compressImage(file);
        const id = uid();
        await photoStore.put(id, dataUrl);
        added.push({ id, width, height, kb: approxKB(dataUrl), addedAt: Date.now(), caption: "" });
      } catch (e) {
        setErr(e.message || "One image couldn't be added");
      }
    }
    if (added.length) onChange([...list, ...added]);
    setBusy(false);
  };

  const removePhoto = async (id) => {
    await photoStore.del(id);
    onChange(list.filter((p) => p.id !== id));
  };

  const setCaption = (id, caption) =>
    onChange(list.map((p) => (p.id === id ? { ...p, caption } : p)));

  if (readOnly && list.length === 0) return null;

  return (
    <>
      <div className="sn-strip">
        {list.map((meta) => (
          <PhotoThumb key={meta.id} meta={meta}
            onOpen={(m, src) => setViewing({ meta: m, src })} />
        ))}
        {!readOnly && (
          <button className="sn-thumb add" onClick={() => fileRef.current?.click()} disabled={busy}>
            <span className="ico">{busy ? "…" : "＋"}</span>
            <span className="lbl">{busy ? "Adding" : (label || "Photo")}</span>
          </button>
        )}
      </div>

      {!readOnly && (
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
      )}

      {err && <div className="sn-note warn" style={{ marginTop: 6 }}>{err}</div>}

      {viewing && (
        <PhotoViewer meta={viewing.meta} src={viewing.src} readOnly={readOnly}
          onClose={() => setViewing(null)}
          onDelete={removePhoto}
          onCaption={(c) => setCaption(viewing.meta.id, c)} />
      )}
    </>
  );
}

/* ===============================================================
   DEVOTIONS — personal reading, feeding the same verse library
   =============================================================== */
const MOODS = ["grateful", "weary", "anxious", "hopeful", "convicted", "steady"];

/* ---------------------------------------------------------------
   Devotion methods
   Each method is an ordered set of prompts. Step ids are shared
   across methods where they mean the same thing (application,
   prayer), so switching methods keeps what you've already written.
--------------------------------------------------------------- */
const METHODS = {
  free: {
    label: "Free",
    blurb: "No structure — just write.",
    steps: [
      { id: "reflection", label: "Reflection", min: 130,
        placeholder: "What stood out? What is it asking of you?" },
      { id: "prayer", label: "Prayer", min: 90, serif: true,
        placeholder: "What you're bringing to God about this…" },
    ],
  },
  soap: {
    label: "SOAP",
    blurb: "Scripture · Observation · Application · Prayer",
    steps: [
      { id: "scripture", label: "Scripture", min: 90, serif: true,
        hint: "Write the verse out by hand — copying it slows you down enough to notice things.",
        placeholder: "Write out the verse that stood out…" },
      { id: "observation", label: "Observation", min: 110,
        hint: "What's actually happening here? Who's speaking, to whom, and why?",
        placeholder: "What does the passage say…" },
      { id: "application", label: "Application", min: 110,
        hint: "Make it specific and personal — this week, not someday.",
        placeholder: "What does this mean for me…" },
      { id: "prayer", label: "Prayer", min: 90, serif: true,
        placeholder: "Pray it back to God…" },
    ],
  },
  hear: {
    label: "HEAR",
    blurb: "Highlight · Explain · Apply · Respond",
    steps: [
      { id: "highlight", label: "Highlight", min: 80,
        hint: "The verse or phrase that stopped you.",
        placeholder: "What jumped out…" },
      { id: "explain", label: "Explain", min: 110,
        hint: "What did it mean to the original hearers?",
        placeholder: "What's going on in the passage…" },
      { id: "application", label: "Apply", min: 110,
        placeholder: "How this changes something for you…" },
      { id: "respond", label: "Respond", min: 90, serif: true,
        hint: "An action, a confession, or a prayer.",
        placeholder: "What you'll do about it…" },
    ],
  },
  lectio: {
    label: "Lectio",
    blurb: "Read · Meditate · Pray · Rest",
    steps: [
      { id: "lectio", label: "Read", min: 80,
        hint: "Read the passage slowly, twice. Note the word or phrase that draws you.",
        placeholder: "The word or phrase that drew you…" },
      { id: "meditatio", label: "Meditate", min: 110,
        hint: "Sit with it. Why this word, today?",
        placeholder: "What it stirs up…" },
      { id: "oratio", label: "Pray", min: 90, serif: true,
        placeholder: "Your honest response to God…" },
      { id: "contemplatio", label: "Rest", min: 70, serif: true,
        hint: "Nothing to produce here. Note anything that surfaced in the silence.",
        placeholder: "What you're leaving with…" },
    ],
  },
  acts: {
    label: "ACTS",
    blurb: "Adoration · Confession · Thanksgiving · Supplication",
    steps: [
      { id: "adoration", label: "Adoration", min: 90, serif: true,
        hint: "Who God is, not what he's done for you yet.",
        placeholder: "Praise him for who he is…" },
      { id: "confession", label: "Confession", min: 90,
        placeholder: "What you're bringing into the light…" },
      { id: "thanksgiving", label: "Thanksgiving", min: 90,
        placeholder: "What he's done…" },
      { id: "supplication", label: "Supplication", min: 100,
        hint: "For others first, then yourself.",
        placeholder: "What you're asking for…" },
    ],
  },
};

const METHOD_ORDER = ["free", "soap", "hear", "lectio", "acts"];

function emptyDevotion() {
  return {
    kind: "devotion",
    id: uid(),
    date: new Date().toISOString().slice(0, 10),
    title: "",
    method: "soap",
    fields: {},
    passage: [],
    crossRefs: [],
    mood: "",
    photos: [],
    createdAt: Date.now(),
  };
}

/* Older devotions stored reflection/prayer as top-level strings. */
function migrateDevotion(d) {
  if (d.fields) return d;
  return {
    ...d,
    method: d.method || "free",
    fields: { reflection: d.reflection || "", prayer: d.prayer || "" },
  };
}

/* All written text from a devotion, whatever method it used */
const devotionText = (d) => Object.values(migrateDevotion(d).fields || {}).join(" ");

function DevotionForm({ initial, seed, onSave, onCancel }) {
  const [d, setD] = useState(() => {
    if (initial) return migrateDevotion(initial);
    const base = emptyDevotion();
    if (seed) return { ...base, title: seed.title || "", passage: seed.passage || [] };
    return base;
  });
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(!!initial || !!seed);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (initial || seed) { setReady(true); return; }
    let alive = true;
    loadDraft("devotion").then((saved) => {
      if (!alive) return;
      if (saved && !isBlankDevotion(saved)) { setD(migrateDevotion(saved)); setRestored(true); }
      setReady(true);
    });
    return () => { alive = false; };
  }, [initial]);

  const draftStatus = useDraft("devotion", d, isBlankDevotion, ready);

  const discardDraft = async () => {
    await clearDraft("devotion");
    setD(emptyDevotion());
    setRestored(false);
  };
  const submit = async () => { await clearDraft("devotion"); onSave(d); };
  const cancel = async () => { await clearDraft("devotion"); onCancel(); };
  const setField = (id, v) => setD((x) => ({ ...x, fields: { ...x.fields, [id]: v } }));

  const method = METHODS[d.method] || METHODS.free;
  const hasWriting = Object.values(d.fields || {}).some((v) => v && v.trim());

  /* Warn only if switching would strand text the new method has no slot for */
  const switchMethod = (id) => {
    const keepIds = new Set(METHODS[id].steps.map((s) => s.id));
    const stranded = Object.entries(d.fields || {})
      .filter(([k, v]) => v && v.trim() && !keepIds.has(k));
    if (stranded.length &&
        !confirm(`Switching to ${METHODS[id].label} hides ${stranded.length} section${stranded.length > 1 ? "s" : ""} you've written in. The text is kept — switch back to see it again. Continue?`)) {
      return;
    }
    set("method", id);
  };

  return (
    <div className="sn-scroll">
      {restored && <DraftBar restored onDiscard={discardDraft} />}
      <div style={{ display: "flex", gap: 10, width: "100%" }}>
        <div className="sn-field" style={{ flex: "1 1 auto", minWidth: 0 }}>
          <label className="sn-label">Title</label>
          <input className="sn-input" placeholder="Optional — a word for today"
            value={d.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="sn-field" style={{ flex: "0 1 124px", minWidth: 0, maxWidth: 124, overflow: "hidden" }}>
          <label className="sn-label">Date</label>
          <input className="sn-input sn-input-date" type="date" value={d.date}
            onChange={(e) => set("date", e.target.value)} />
        </div>
      </div>

      <div className="sn-field">
        <label className="sn-label">Method</label>
        <div className="sn-methods">
          {METHOD_ORDER.map((id) => (
            <button key={id} className={"sn-method" + (d.method === id ? " on" : "")}
              onClick={() => switchMethod(id)}>{METHODS[id].label}</button>
          ))}
        </div>
        <div className="sn-note">{method.blurb}</div>
      </div>

      <div className="sn-field">
        <label className="sn-label">What you read</label>
        <VerseChips verses={d.passage} onChange={(v) => set("passage", v)} label="Passage" />
      </div>

      <div className="sn-field">
        <label className="sn-label">Where you're at today</label>
        <div className="sn-chip-row">
          {MOODS.map((m) => (
            <button key={m} className={"sn-topic ghost" + (d.mood === m ? " on" : "")}
              onClick={() => set("mood", d.mood === m ? "" : m)}>{m}</button>
          ))}
        </div>
      </div>

      {method.steps.map((step, i) => (
        <div className="sn-field" key={step.id}>
          <label className="sn-label">
            {d.method !== "free" && <span className="sn-stepno">{i + 1}</span>}
            {step.label}
          </label>
          <textarea className={"sn-textarea" + (step.serif ? " serif" : "")}
            style={{ minHeight: step.min }}
            placeholder={step.placeholder}
            value={d.fields[step.id] || ""}
            onChange={(e) => setField(step.id, e.target.value)} />
          {step.hint && <div className="sn-note">{step.hint}</div>}
        </div>
      ))}

      <div className="sn-field">
        <label className="sn-label">Verses this brought to mind</label>
        <VerseChips verses={d.crossRefs} onChange={(v) => set("crossRefs", v)} label="Cross-reference" />
        <div className="sn-note">Tag these by topic and they'll surface when you search that topic later.</div>
      </div>

      <div className="sn-field">
        <label className="sn-label">Photos</label>
        <PhotoStrip photos={d.photos} onChange={(p) => set("photos", p)} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        {onCancel && <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }} onClick={cancel}>Cancel</button>}
        <button className="sn-btn sn-btn-accent" style={{ flex: 2 }}
          disabled={!hasWriting && d.passage.length === 0}
          onClick={submit}>{initial ? "Save changes" : "Save devotion"}</button>
      </div>
      <DraftBar status={draftStatus} restored={restored} onDiscard={discardDraft} />
    </div>
  );
}

function DevotionDetail({ item, onBack, onEdit, onDelete }) {
  const dev = migrateDevotion(item);
  return (
    <div className="sn-scroll">
      <button className="sn-back" onClick={onBack}>‹ Back</button>
      <div className="sn-kind sn-kind-devotion">
        Devotion{dev.method && dev.method !== "free" ? ` · ${METHODS[dev.method]?.label}` : ""}
      </div>
      <h2 className="sn-serif" style={{ margin: "6px 0 3px", fontSize: 24, fontWeight: 500, lineHeight: 1.25 }}>
        {dev.title || "Devotion"}
      </h2>
      <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 18 }}>
        {new Date(dev.date + "T00:00:00").toLocaleDateString(undefined,
          { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        {dev.mood && <> · felt {dev.mood}</>}
      </div>

      {dev.passage.length > 0 && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Read</div>
          <VerseList verses={dev.passage} />
        </div>
      )}

      {(METHODS[dev.method] || METHODS.free).steps
        .filter((step) => (dev.fields[step.id] || "").trim())
        .map((step, i) => (
          <div className="sn-dtl" key={step.id}>
            <div className="sn-dtl-lbl">
              {dev.method !== "free" && <span className="sn-stepno">{i + 1}</span>}
              {step.label}
            </div>
            <div className="sn-dtl-txt">
              {dev.fields[step.id]}
            </div>
          </div>
        ))}

      {dev.crossRefs.length > 0 && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Brought to mind</div>
          <VerseList verses={dev.crossRefs} />
        </div>
      )}

      {(dev.photos || []).length > 0 && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Handwritten</div>
          <PhotoStrip photos={dev.photos} readOnly />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="sn-btn sn-btn-danger" style={{ flex: 1 }} onClick={() => onDelete(dev.id)}>Delete</button>
        <button className="sn-btn sn-btn-primary" style={{ flex: 2 }} onClick={() => onEdit(dev)}>Edit</button>
      </div>
    </div>
  );
}

/* ===============================================================
   VERSE SEARCH TAB — browse by book/chapter/verse or free text
   =============================================================== */
function parseRef(ref) {
  const m = ref.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  return { book: m[1], chapter: +m[2], start: +m[3], end: m[4] ? +m[4] : +m[3] };
}

function TagVersePanel({ refStr, onClose }) {
  return (
    <div className="sn-tagpanel">
      <div className="sn-tagpanel-hd">
        <span className="sn-mono">{refStr}</span>
        <button className="sn-link" onClick={onClose}>Done</button>
      </div>
      <ScriptureText refStr={refStr} compact />
      <TopicTags refStr={refStr} />
    </div>
  );
}

function VerseSearch({ entries, onOpen, jumpTo }) {
  const [mode, setMode] = useState(jumpTo?.ref ? "reference" : "topic");
  const [q, setQ] = useState(jumpTo?.ref || "");
  const [browse, setBrowse] = useState(false);
  const [tagPicker, setTagPicker] = useState(false);
  const [tagging, setTagging] = useState(null);      // ref being tagged
  const [openTopic, setOpenTopic] = useState(jumpTo?.topic || null);
  const [expanded, setExpanded] = useState(null);
  const { topics, setTopicsFor } = React.useContext(TopicsContext);

  /* Every reference that appears in a note, with its summaries and sources */
  const index = useMemo(() => {
    const map = new Map();
    entries.forEach((n) => {
      allVerses(n).forEach(({ ref, gist }) => {
        if (!map.has(ref)) map.set(ref, { ref, parsed: parseRef(ref), gists: [], notes: [] });
        const e = map.get(ref);
        if (!e.notes.some((x) => x.id === n.id)) e.notes.push(n);
        if (gist?.trim() && !e.gists.includes(gist)) e.gists.push(gist);
      });
    });
    /* References tagged with a topic but no longer cited anywhere still belong here */
    Object.keys(topics).forEach((ref) => {
      if (!map.has(ref)) map.set(ref, { ref, parsed: parseRef(ref), gists: [], notes: [] });
    });
    return [...map.values()];
  }, [entries, topics]);

  const byRef = useMemo(() => Object.fromEntries(index.map((e) => [e.ref, e])), [index]);

  /* topic -> refs */
  const topicIndex = useMemo(() => {
    const map = new Map();
    Object.entries(topics).forEach(([ref, list]) => {
      (list || []).forEach((t) => {
        if (!map.has(t)) map.set(t, []);
        map.get(t).push(ref);
      });
    });
    return [...map.entries()]
      .map(([topic, refs]) => ({ topic, refs }))
      .sort((a, b) => b.refs.length - a.refs.length || a.topic.localeCompare(b.topic));
  }, [topics]);

  const query = q.trim().toLowerCase();

  /* Curated passages for the open topic, minus what you already hold */
  const taggedRefs = useMemo(() => new Set(Object.keys(topics)), [topics]);
  const suggestions = useMemo(
    () => (openTopic ? suggestForTopic(openTopic, taggedRefs) : []),
    [openTopic, taggedRefs]
  );

  const VerseRow = ({ e, showTopics }) => (
    <div key={e.ref}>
      <div className="sn-freq" onClick={() => setExpanded(expanded === e.ref ? null : e.ref)}>
        <span className="sn-mono" style={{ fontSize: 13.5 }}>{e.ref}</span>
        <span className="sn-freq-ct">
          {e.notes.length ? `${e.notes.length} note${e.notes.length > 1 ? "s" : ""}` : "tagged"}
        </span>
      </div>

      {showTopics && (topics[e.ref] || []).length > 0 && (
        <div className="sn-chip-row" style={{ marginTop: -4, marginBottom: 9, paddingLeft: 2 }}>
          {(topics[e.ref] || []).map((t) => (
            <button className="sn-topic ghost" key={t}
              onClick={() => { setMode("topic"); setOpenTopic(t); }}>{t}</button>
          ))}
        </div>
      )}

      {expanded === e.ref && (
        <div style={{ marginTop: -4, marginBottom: 12 }}>
          {e.gists.length > 0 && (
            <div className="sn-gistbox" style={{ marginBottom: 8 }}>
              {e.gists.map((g, i) => <div className="sn-gist-read" key={i}>{g}</div>)}
            </div>
          )}
          <TopicTags refStr={e.ref} />
          {e.notes.length > 0 && (
            <div style={{ paddingLeft: 2, marginTop: 8 }}>
              {e.notes.map((n) => (
                <div key={n.id} onClick={() => onOpen(n)} className="sn-srcrow">
                  <span className={"sn-dotkind " + (n.kind === "devotion" ? "dev" : "ser")} />
                  {n.title || (n.kind === "devotion" ? "Devotion" : "Untitled")}
                  <span className="sn-srcdate">
                    {new Date(n.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ---------------- Topic mode ---------------- */
  if (mode === "topic") {
    const shownTopics = query
      ? topicIndex.filter((t) => t.topic.includes(query))
      : topicIndex;

    /* One group per matching topic — yours and the curated ones together,
       so a search lands on verses rather than on something else to tap. */
    const searchGroups = (() => {
      if (!query) return [];
      const names = new Set(shownTopics.map((t) => t.topic));
      searchTopical(query).forEach((h) => names.add(h.topic));
      return [...names].map((topic) => {
        const mine = topicIndex.find((t) => t.topic === topic)?.refs || [];
        return { topic, mine, suggested: suggestForTopic(topic, new Set(mine)) };
      }).filter((g) => g.mine.length || g.suggested.length);
    })();

    return (
      <div className="sn-scroll">
        <div className="sn-tseg" style={{ marginBottom: 12 }}>
          <button className="on">By topic</button>
          <button onClick={() => { setMode("reference"); setOpenTopic(null); }}>By reference</button>
        </div>

        {openTopic ? (
          <>
            <button className="sn-back" onClick={() => setOpenTopic(null)}>‹ All topics</button>
            <div className="sn-topic-hd">
              <span className="sn-topic-title">{openTopic}</span>
              <button className="sn-btn sn-btn-accent sn-btn-sm" onClick={() => setBrowse(true)}>+ Add verse</button>
            </div>
            {(topicIndex.find((t) => t.topic === openTopic)?.refs || []).map((ref) => {
              const e = byRef[ref] || { ref, gists: [], notes: [] };
              return <VerseRow key={ref} e={e} />;
            })}

            <div className="sn-secttl">Find more on {openTopic}</div>
            <ScriptureSearch initialQuery={openTopic} tagTopic={openTopic} taggedRefs={taggedRefs}
              onTag={(ref) => setTopicsFor(ref, [...(topics[ref] || []), openTopic])} />

            {suggestions.length > 0 && (
              <>
                <div className="sn-secttl">Well-known passages on {openTopic}</div>
                <div className="sn-note" style={{ marginTop: -4, marginBottom: 10 }}>
                  Well-known texts on this theme. Add any that belong in your library.
                </div>
                {suggestions.map((ref) => (
                  <SuggestedVerse key={ref} refStr={ref} topic={openTopic}
                    onAdd={(r) => setTopicsFor(r, [...(topics[r] || []), openTopic])}
                    onTagged={setTagging} />
                ))}
              </>
            )}
            {browse && (
              <VersePicker onClose={() => setBrowse(false)}
                onPick={(ref) => {
                  const cur = topics[ref] || [];
                  if (!cur.includes(openTopic)) setTopicsFor(ref, [...cur, openTopic]);
                }} />
            )}
            {tagging && <TagVersePanel refStr={tagging} onClose={() => setTagging(null)} />}
          </>
        ) : (
          <>
            {tagPicker && (
              <VersePicker onClose={() => setTagPicker(false)} onPick={(ref) => setTagging(ref)} />
            )}
            <div className="sn-search">
              <span className="ico">⌕</span>
              <input placeholder="Find a topic, e.g. patience"
                value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button className="clear" onClick={() => setQ("")}>×</button>}
            </div>

            <button className="sn-btn sn-btn-ghost sn-btn-full sn-btn-sm"
              style={{ marginBottom: 16 }} onClick={() => setTagPicker(true)}>
              Tag a verse by topic
            </button>

            {tagging && <TagVersePanel refStr={tagging} onClose={() => setTagging(null)} />}

            {query && searchGroups.length > 0 && (
              <>
                {searchGroups.map((g) => (
                  <div key={g.topic} className="sn-topicgroup">
                    <div className="sn-topicgroup-hd">
                      <span className="sn-topicgroup-nm">{g.topic}</span>
                      <button className="sn-link" onClick={() => { setOpenTopic(g.topic); setQ(""); }}>
                        Open topic
                      </button>
                    </div>

                    {g.mine.map((ref) => {
                      const e = byRef[ref] || { ref, gists: [], notes: [] };
                      return <VerseRow key={g.topic + ref} e={e} />;
                    })}

                    {g.mine.length === 0 && (
                      <div className="sn-note" style={{ margin: "2px 0 10px" }}>
                        Nothing tagged {g.topic} yet — here's where to start.
                      </div>
                    )}

                    {g.suggested.length > 0 && (
                      <>
                        {g.mine.length > 0 && (
                          <div className="sn-sublbl" style={{ marginTop: 14 }}>More on {g.topic}</div>
                        )}
                        {g.suggested.map((ref) => (
                          <SuggestedVerse key={g.topic + "s" + ref} refStr={ref} topic={g.topic}
                            onAdd={(r) => setTopicsFor(r, [...(topics[r] || []), g.topic])}
                            onTagged={setTagging} />
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </>
            )}

            {shownTopics.length === 0 && !query && (
              <div className="sn-empty">
                <div className="ico">🏷</div>
                No topics yet. Tap any verse in a note to tag it.
              </div>
            )}

            {query && searchGroups.length === 0 && (
              <div className="sn-empty">
                <div className="ico">🏷</div>
                Nothing tagged "{query}" yet.
              </div>
            )}

            {!query && shownTopics.length > 0 && (
              <div className="sn-topic-grid">
                {shownTopics.map((t) => (
                  <button className="sn-topic-card" key={t.topic} onClick={() => setOpenTopic(t.topic)}>
                    <span className="name">{t.topic}</span>
                    <span className="count">{t.refs.length}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  /* ---------------- Reference mode ---------------- */
  const results = (query
    ? index.filter((e) =>
        e.ref.toLowerCase().includes(query) ||
        e.gists.some((g) => g.toLowerCase().includes(query)) ||
        (topics[e.ref] || []).some((t) => t.includes(query)))
    : index
  ).sort((a, b) => b.notes.length - a.notes.length);

  return (
    <div className="sn-scroll">
      <div className="sn-tseg" style={{ marginBottom: 12 }}>
        <button onClick={() => setMode("topic")}>By topic</button>
        <button className="on">By reference</button>
      </div>

      <div className="sn-search mono">
        <span className="ico">⌕</span>
        <input placeholder="Find a verse, e.g. Rom 8" value={q}
          onChange={(e) => setQ(e.target.value)} />
        {q && <button className="clear" onClick={() => setQ("")}>×</button>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="sn-btn sn-btn-ghost sn-btn-sm" style={{ flex: 1 }}
          onClick={() => setBrowse(true)}>Browse books</button>
        <button className="sn-btn sn-btn-accent sn-btn-sm" style={{ flex: 1 }}
          onClick={() => setTagPicker(true)}>Tag a verse</button>
      </div>

      {browse && <VersePicker onClose={() => setBrowse(false)} onPick={(ref) => setQ(ref)} />}
      {tagPicker && (
        <VersePicker onClose={() => setTagPicker(false)}
          onPick={(ref) => setTagging(ref)} />
      )}
      {tagging && <TagVersePanel refStr={tagging} onClose={() => setTagging(null)} />}

      {results.length === 0 ? (
        <div className="sn-empty">
          <div className="ico">🔎</div>
          {index.length === 0 ? "No verses saved yet." : "Nothing matches that."}
        </div>
      ) : (
        <>
          <div className="sn-secttl" style={{ marginTop: 0 }}>
            {query ? `Matches (${results.length})` : "Most cited"}
          </div>
          {results.map((e) => <VerseRow key={e.ref} e={e} showTopics />)}
        </>
      )}

      <div className="sn-secttl">Search the whole Bible</div>
      <ScriptureSearch taggedRefs={taggedRefs} onTag={(ref) => setTagging(ref)} />
    </div>
  );
}


/* ---------------------------------------------------------------
   Weekly resurfacing — pulls a passage back up out of your own
   library, favouring ones you haven't touched in a while. Changes
   once a week rather than daily so it has time to sink in.
--------------------------------------------------------------- */
function weekIndex() {
  const start = new Date(2026, 0, 1).getTime();
  return Math.floor((Date.now() - start) / (7 * 86400000));
}

function resurfacedVerse(entries, topics) {
  const map = new Map();
  entries.forEach((e) => {
    allVerses(e).forEach(({ ref, gist }) => {
      if (!map.has(ref)) map.set(ref, { ref, gists: [], lastSeen: e.date, topics: topics[ref] || [] });
      const rec = map.get(ref);
      if (gist?.trim() && !rec.gists.includes(gist)) rec.gists.push(gist);
      if (e.date > rec.lastSeen) rec.lastSeen = e.date;
    });
  });

  /* Something you wrote about is worth more than a bare citation */
  const candidates = [...map.values()]
    .filter((r) => r.gists.length > 0 || r.topics.length > 0)
    .sort((a, b) => (a.lastSeen < b.lastSeen ? -1 : 1));

  if (candidates.length === 0) return null;
  return candidates[weekIndex() % candidates.length];
}

function topTopics(topics, limit = 6) {
  const counts = new Map();
  Object.values(topics).forEach((list) =>
    (list || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }));
}

/* ===============================================================
   ESV TEXT (optional, your own key)
   ---------------------------------------------------------------
   Crossway's terms allow free non-commercial use but cap local
   storage at 500 verses, so the cache here is bounded and evicts
   the oldest passages rather than growing forever. The key belongs
   to you; a proxy URL is offered because a key in client code is
   readable by anyone who opens the page.
   =============================================================== */
const ESV_VERSE_CAP = 450;          // stay under Crossway's 500

const ScriptureContext = React.createContext({ ready: false, get: null });

const defaultScripture = () => ({
  apiKey: "", proxyUrl: "", autoFetch: true,
  verseNumbers: true,     // reader only
  headings: true,         // reader only
  footnotes: false,       // reader only
});

/* Three presentations of the same text. Poetry indentation and paragraphs
   come from the HTML endpoint; the plain endpoint is kept for places where
   a compact single line is what's wanted. */
const PRESETS = {
  reader: (cfg) => ({
    endpoint: "html",
    params: {
      "include-passage-references": "false",
      "include-verse-numbers": cfg.verseNumbers ? "true" : "false",
      "include-first-verse-numbers": cfg.verseNumbers ? "true" : "false",
      "include-headings": cfg.headings ? "true" : "false",
      "include-subheadings": cfg.headings ? "true" : "false",
      "include-footnotes": cfg.footnotes ? "true" : "false",
      "include-footnote-body": cfg.footnotes ? "true" : "false",
      "include-chapter-numbers": "false",
      "include-audio-link": "false",
      "include-short-copyright": "false",
      "include-crossrefs": "false",
      "wrapping-div": "true",
      "div-classes": "esvp",
    },
  }),
  /* Reading with verse-level marking: numbers are always on, because they
     are the anchors used to make each verse tappable. */
  bible: (cfg) => ({
    endpoint: "html",
    params: {
      "include-passage-references": "false",
      "include-verse-numbers": "true",
      "include-first-verse-numbers": "true",
      "include-headings": cfg.headings ? "true" : "false",
      "include-subheadings": cfg.headings ? "true" : "false",
      "include-footnotes": "false",
      "include-chapter-numbers": "false",
      "include-audio-link": "false",
      "include-short-copyright": "false",
      "include-crossrefs": "false",
      "wrapping-div": "true",
      "div-classes": "esvp",
    },
  }),
  /* One verse in a card: no number floating in front of it, but poetry
     lines still break the way the ESV sets them. */
  verse: () => ({
    endpoint: "html",
    params: {
      "include-passage-references": "false",
      "include-verse-numbers": "false",
      "include-first-verse-numbers": "false",
      "include-headings": "false",
      "include-subheadings": "false",
      "include-footnotes": "false",
      "include-chapter-numbers": "false",
      "include-audio-link": "false",
      "include-short-copyright": "false",
      "wrapping-div": "true",
      "div-classes": "esvp esvp-verse",
    },
  }),
  /* Chips and search results — compact plain text. */
  inline: () => ({
    endpoint: "text",
    params: {
      "include-passage-references": "false",
      "include-verse-numbers": "false",
      "include-headings": "false",
      "include-footnotes": "false",
      "include-short-copyright": "false",
    },
  }),
};

/* Format is part of the identity of a cached passage — the same verse
   fetched for the proverb card is different text from the reader's. */
function presetSignature(preset, cfg) {
  if (preset === "reader") {
    return `reader:${cfg.verseNumbers ? 1 : 0}${cfg.headings ? 1 : 0}${cfg.footnotes ? 1 : 0}`;
  }
  if (preset === "bible") return `bible:${cfg.headings ? 1 : 0}`;
  return preset;
}

async function loadScripture() {
  try {
    const r = await storage.get("esv-settings");
    return r ? { ...defaultScripture(), ...JSON.parse(r.value) } : defaultScripture();
  } catch { return defaultScripture(); }
}
async function saveScripture(cfg) {
  try { await storage.set("esv-settings", JSON.stringify(cfg)); return true; }
  catch { return false; }
}

let esvCache = null;
async function esvCacheLoad() {
  if (esvCache) return esvCache;
  try {
    const r = await storage.get("esv-cache");
    esvCache = r ? JSON.parse(r.value) : {};
  } catch { esvCache = {}; }
  return esvCache;
}
async function esvCacheWrite(cache) {
  esvCache = cache;
  try { await storage.set("esv-cache", JSON.stringify(cache)); } catch {}
}
function cacheVerseCount(cache) {
  return Object.values(cache).reduce((n, e) => n + (e.verses || 1), 0);
}
async function esvCachePut(ref, entry) {
  const cache = { ...(await esvCacheLoad()) };
  cache[ref] = { ...entry, at: Date.now() };
  /* Evict oldest until we're back under the cap */
  let refs = Object.entries(cache).sort((a, b) => a[1].at - b[1].at);
  while (cacheVerseCount(cache) > ESV_VERSE_CAP && refs.length > 1) {
    delete cache[refs[0][0]];
    refs = refs.slice(1);
  }
  await esvCacheWrite(cache);
}
async function esvCacheClear() { await esvCacheWrite({}); }

/* Rough verse count so the cap means something */
function refVerseCount(ref) {
  const p = parseReading(ref);
  if (!p) return 1;
  return Math.max(1, p.end - p.start + 1);
}

async function fetchESV(ref, cfg, preset = "inline") {
  const spec = (PRESETS[preset] || PRESETS.inline)(cfg);
  const params = new URLSearchParams({ q: ref, ...spec.params });

  const path = spec.endpoint === "html" ? "passage/html" : "passage/text";
  const url = cfg.proxyUrl
    ? `${cfg.proxyUrl.replace(/\/$/, "")}/${path}?${params}`
    : `https://api.esv.org/v3/${path}/?${params}`;
  const headers = cfg.proxyUrl ? {} : { Authorization: `Token ${cfg.apiKey}` };

  const res = await fetch(url, { headers });
  if (res.status === 401) throw new Error("Key rejected — check it in Backup & storage.");
  if (!res.ok) throw new Error(`ESV returned ${res.status}`);
  const data = await res.json();

  const raw = (data.passages || []).join("\n").trim();
  if (!raw) throw new Error("No passage came back for that reference.");

  return {
    html: spec.endpoint === "html" ? sanitizePassage(raw) : null,
    text: spec.endpoint === "html" ? null : raw,
    verses: refVerseCount(ref),
  };
}

/* Crossway is a trusted source, but markup goes through innerHTML, so
   strip anything scriptable on principle rather than on trust. */
function sanitizePassage(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");
}

async function getScripture(ref, cfg, preset = "inline") {
  const key = `${presetSignature(preset, cfg)}|${ref}`;
  const cache = await esvCacheLoad();
  if (cache[key]) return { ...cache[key], cached: true };
  if (!cfg.apiKey && !cfg.proxyUrl) throw new Error("No ESV key set up yet.");
  const result = await fetchESV(ref, cfg, preset);
  await esvCachePut(key, result);
  return { ...result, cached: false };
}

/* Shows the passage, on demand or automatically. `preset` picks the
   presentation: "reader" for chapters, "verse" for the proverb card,
   "inline" for chips and snippets. */
function ScriptureText({ refStr, compact, preset = "inline" }) {
  const cfg = React.useContext(ScriptureContext);
  const [state, setState] = useState({ status: "idle" });

  const load = async () => {
    setState({ status: "loading" });
    try { setState({ status: "ok", ...(await getScripture(refStr, cfg, preset)) }); }
    catch (e) { setState({ status: "error", message: e.message }); }
  };

  useEffect(() => {
    let alive = true;
    const key = `${presetSignature(preset, cfg)}|${refStr}`;
    esvCacheLoad().then((c) => {
      if (!alive) return;
      if (c[key]) setState({ status: "ok", ...c[key], cached: true });
      else if (cfg.autoFetch && (cfg.apiKey || cfg.proxyUrl)) load();
      else setState({ status: "idle" });
    });
    return () => { alive = false; };
  }, [refStr, preset, cfg.apiKey, cfg.proxyUrl, cfg.autoFetch,
      cfg.verseNumbers, cfg.headings, cfg.footnotes]);

  if (!cfg.apiKey && !cfg.proxyUrl) return null;
  if (state.status === "idle")
    return <button className="sn-loadtext" onClick={load}>Show ESV text</button>;
  if (state.status === "loading")
    return <div className="sn-scripture dim">Loading…</div>;
  if (state.status === "error")
    return <div className="sn-scripture err">{state.message}{" "}
      <button className="sn-loadtext" onClick={load}>Retry</button></div>;

  return (
    <div className={"sn-scripture" + (compact ? " compact" : "")}>
      {state.html
        ? <div className="sn-esvhtml" dangerouslySetInnerHTML={{ __html: state.html }} />
        : state.text}
      <div className="sn-scripture-attr">
        ESV <a href="https://www.esv.org" target="_blank" rel="noreferrer">esv.org</a>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Scripture search — Crossway's /v3/passage/search/ endpoint.
   Results are held in memory only and never written to the verse
   cache: search snippets would otherwise eat into the 500-verse
   storage limit for passages you actually chose to keep.
--------------------------------------------------------------- */
async function searchESV(query, cfg, page = 1) {
  const params = new URLSearchParams({ q: query, "page-size": "20", page: String(page) });
  const url = cfg.proxyUrl
    ? `${cfg.proxyUrl.replace(/\/$/, "")}/search?${params}`
    : `https://api.esv.org/v3/passage/search/?${params}`;
  const headers = cfg.proxyUrl ? {} : { Authorization: `Token ${cfg.apiKey}` };

  const res = await fetch(url, { headers });
  if (res.status === 401) throw new Error("Key rejected — check it in Backup & storage.");
  if (!res.ok) throw new Error(`ESV search returned ${res.status}`);
  const data = await res.json();
  return {
    total: data.total_results || 0,
    page: data.page || page,
    pages: data.total_pages || 1,
    results: (data.results || []).map((r) => ({ ref: r.reference, snippet: r.content })),
  };
}

/* ===============================================================
   TOPICAL INDEX
   ---------------------------------------------------------------
   A starting library of well-known passages by theme, so a topic
   can suggest verses you haven't tagged yet. Curated and bundled,
   not fetched — it works offline and costs nothing. It's a prompt,
   never a replacement for your own reading: every suggestion has
   to be accepted before it enters your library.
   =============================================================== */
const TOPICAL = {
  patience: ["Romans 8:25", "James 5:7-8", "Galatians 5:22-23", "Isaiah 40:31", "Psalms 27:14", "Romans 12:12"],
  anxiety: ["Philippians 4:6-7", "1 Peter 5:6-7", "Matthew 6:25-34", "Psalms 94:19", "John 14:27", "Isaiah 41:10"],
  fear: ["Isaiah 41:10", "Psalms 23:4", "Psalms 27:1", "2 Timothy 1:7", "Joshua 1:9", "Psalms 56:3"],
  grief: ["Psalms 34:18", "Matthew 5:4", "Revelation 21:4", "2 Corinthians 1:3-4", "Psalms 147:3", "John 11:33-35"],
  forgiveness: ["Ephesians 4:32", "Colossians 3:13", "Matthew 6:14-15", "1 John 1:9", "Psalms 103:12", "Luke 23:34"],
  guidance: ["Proverbs 3:5-6", "Psalms 32:8", "Psalms 119:105", "James 1:5", "Isaiah 30:21", "Proverbs 16:9"],
  gratitude: ["1 Thessalonians 5:18", "Psalms 100:4", "Colossians 3:15-17", "Psalms 103:1-5", "Philippians 4:6"],
  hope: ["Romans 15:13", "Lamentations 3:22-24", "Hebrews 6:19", "Romans 5:3-5", "Psalms 42:11", "1 Peter 1:3"],
  temptation: ["1 Corinthians 10:13", "James 1:13-15", "Hebrews 4:15-16", "Matthew 26:41", "Psalms 119:11"],
  provision: ["Philippians 4:19", "Matthew 6:33", "Psalms 23:1", "Matthew 7:11", "2 Corinthians 9:8"],
  healing: ["James 5:14-15", "Psalms 103:2-3", "Isaiah 53:5", "Jeremiah 17:14", "Matthew 11:28-30"],
  wisdom: ["James 1:5", "Proverbs 1:7", "Proverbs 4:6-7", "Colossians 2:2-3", "Psalms 111:10", "James 3:17"],
  anger: ["James 1:19-20", "Ephesians 4:26-27", "Proverbs 15:1", "Proverbs 29:11", "Colossians 3:8"],
  contentment: ["Philippians 4:11-13", "1 Timothy 6:6-8", "Hebrews 13:5", "Psalms 16:5-6", "Ecclesiastes 5:10"],
  humility: ["Philippians 2:3-8", "James 4:6-10", "Micah 6:8", "Proverbs 11:2", "1 Peter 5:5-6"],
  marriage: ["Ephesians 5:22-33", "1 Corinthians 13:4-7", "Genesis 2:24", "Colossians 3:18-19", "Proverbs 31:10-12"],
  parenting: ["Proverbs 22:6", "Ephesians 6:4", "Deuteronomy 6:6-7", "Psalms 127:3-5", "Colossians 3:21"],
  work: ["Colossians 3:23-24", "Proverbs 16:3", "Ecclesiastes 9:10", "1 Corinthians 10:31", "2 Thessalonians 3:10"],
  money: ["1 Timothy 6:9-10", "Proverbs 3:9-10", "Matthew 6:19-21", "Luke 16:13", "Proverbs 22:7"],
  rest: ["Matthew 11:28-30", "Psalms 23:2-3", "Exodus 20:8-11", "Hebrews 4:9-11", "Mark 6:31"],
  doubt: ["Mark 9:24", "James 1:6-8", "John 20:27-29", "Jude 22", "Psalms 73:16-17"],
  suffering: ["Romans 8:18", "Romans 8:28", "1 Peter 4:12-13", "2 Corinthians 4:16-18", "James 1:2-4", "Psalms 34:19"],
  joy: ["Nehemiah 8:10", "Psalms 16:11", "John 15:11", "Philippians 4:4", "Romans 15:13", "James 1:2"],
  peace: ["John 14:27", "Philippians 4:6-7", "Isaiah 26:3", "Colossians 3:15", "Romans 5:1", "Psalms 29:11"],
  love: ["1 Corinthians 13:4-7", "1 John 4:7-12", "John 15:12-13", "Romans 5:8", "1 John 3:16"],
  courage: ["Joshua 1:9", "Deuteronomy 31:6", "1 Corinthians 16:13", "Psalms 31:24", "2 Timothy 1:7"],
  endurance: ["Hebrews 12:1-2", "James 1:12", "Galatians 6:9", "Romans 5:3-4", "2 Timothy 4:7"],
  repentance: ["1 John 1:9", "Acts 3:19", "Psalms 51:10-12", "2 Chronicles 7:14", "Joel 2:12-13"],
  prayer: ["Philippians 4:6-7", "1 Thessalonians 5:16-18", "Matthew 6:9-13", "James 5:16", "Luke 18:1"],
  generosity: ["2 Corinthians 9:6-8", "Proverbs 11:24-25", "Acts 20:35", "Luke 6:38", "1 Timothy 6:17-19"],
  friendship: ["Proverbs 17:17", "Proverbs 27:17", "Ecclesiastes 4:9-12", "John 15:13", "Proverbs 18:24"],
  purity: ["Psalms 119:9-11", "Matthew 5:8", "1 Thessalonians 4:3-5", "Philippians 4:8", "1 Corinthians 6:19-20"],
  justice: ["Micah 6:8", "Isaiah 1:17", "Proverbs 31:8-9", "Amos 5:24", "Psalms 82:3-4"],
  mercy: ["Lamentations 3:22-23", "Titus 3:5", "Matthew 5:7", "Ephesians 2:4-5", "Psalms 103:8"],
  identity: ["Ephesians 2:10", "1 Peter 2:9", "2 Corinthians 5:17", "Galatians 2:20", "Psalms 139:13-14"],
  assurance: ["Romans 8:38-39", "John 10:28-29", "1 John 5:13", "Philippians 1:6", "2 Timothy 1:12"],
  trust: ["Proverbs 3:5-6", "Psalms 56:3-4", "Isaiah 26:3-4", "Jeremiah 17:7-8", "Psalms 20:7"],
  comfort: ["2 Corinthians 1:3-4", "Psalms 23:4", "Matthew 5:4", "Isaiah 66:13", "Psalms 119:50"],
  grace: ["Ephesians 2:8-9", "2 Corinthians 12:9", "Titus 2:11-12", "Romans 5:20-21", "Hebrews 4:16"],
  discipline: ["Hebrews 12:5-11", "Proverbs 3:11-12", "1 Corinthians 9:24-27", "2 Timothy 1:7", "Titus 2:11-12"],

  /* --- sin, named plainly, with the mercy that answers it --- */
  sin: ["Romans 3:23", "Romans 6:23", "1 John 1:8-10", "James 4:17", "Romans 6:12-14", "Psalms 51:1-4"],
  lust: ["Matthew 5:27-28", "Job 31:1", "1 John 2:16", "2 Timothy 2:22", "Romans 13:14", "Colossians 3:5"],
  "sexual immorality": ["1 Corinthians 6:18-20", "1 Thessalonians 4:3-5", "Hebrews 13:4", "Ephesians 5:3", "Proverbs 5:3-8", "1 Corinthians 10:13"],
  stealing: ["Exodus 20:15", "Ephesians 4:28", "Proverbs 10:2", "Leviticus 19:11", "1 Corinthians 6:9-11"],
  bitterness: ["Ephesians 4:31-32", "Hebrews 12:14-15", "Colossians 3:13", "Romans 12:19", "Proverbs 14:10"],
  covetousness: ["Exodus 20:17", "Luke 12:15", "Hebrews 13:5", "Colossians 3:5", "1 Timothy 6:6-10"],
  greed: ["Luke 12:15", "1 Timothy 6:9-10", "Proverbs 11:24-25", "Ecclesiastes 5:10", "Hebrews 13:5"],
  pride: ["Proverbs 16:18", "James 4:6-10", "Proverbs 11:2", "1 Peter 5:5-6", "Galatians 6:3"],
  lying: ["Proverbs 12:22", "Ephesians 4:25", "Colossians 3:9-10", "Proverbs 6:16-19", "John 8:44"],
  gossip: ["Proverbs 16:28", "Proverbs 26:20", "Ephesians 4:29", "James 4:11", "Proverbs 11:13"],
  envy: ["Proverbs 14:30", "James 3:14-16", "Galatians 5:26", "1 Peter 2:1", "Psalms 37:1"],
  drunkenness: ["Ephesians 5:18", "Proverbs 20:1", "Proverbs 23:20-21", "Galatians 5:19-21", "1 Corinthians 6:9-11"],
  laziness: ["Proverbs 6:6-11", "Proverbs 13:4", "2 Thessalonians 3:10-12", "Proverbs 24:30-34", "Colossians 3:23"],
  idolatry: ["Exodus 20:3-5", "1 John 5:21", "Colossians 3:5", "Romans 1:25", "1 Corinthians 10:14"],
  gluttony: ["Proverbs 23:20-21", "Philippians 3:19", "1 Corinthians 6:12", "Proverbs 25:16", "1 Corinthians 10:31"],
  selfishness: ["Philippians 2:3-4", "James 3:16", "Galatians 5:13", "1 Corinthians 10:24", "Romans 15:1-2"],
  unforgiveness: ["Matthew 18:21-35", "Mark 11:25", "Ephesians 4:32", "Colossians 3:13", "Matthew 6:14-15"],
  addiction: ["1 Corinthians 6:12", "1 Corinthians 10:13", "Romans 6:16-18", "2 Peter 2:19", "Galatians 5:1"],
  "self-control": ["Galatians 5:22-23", "1 Corinthians 9:24-27", "Titus 2:11-12", "Proverbs 25:28", "2 Peter 1:5-8"],
  confession: ["1 John 1:9", "James 5:16", "Psalms 32:3-5", "Proverbs 28:13", "Psalms 51:10-12"],
  guilt: ["Romans 8:1", "Psalms 103:10-12", "Isaiah 43:25", "Hebrews 10:19-22", "Micah 7:18-19"],
  shame: ["Romans 10:11", "Psalms 34:5", "Isaiah 61:7", "Hebrews 12:2", "Romans 8:1"],
  "the tongue": ["James 3:2-10", "Proverbs 18:21", "Ephesians 4:29", "Proverbs 15:1", "Psalms 141:3"],
};

/* Suggestions for a topic: exact match first, then near-matches on the
   topic name, minus anything already in your library. */
function suggestForTopic(topic, taggedRefs) {
  const t = normTopic(topic);
  const direct = TOPICAL[t] || [];
  let pool = [...direct];
  if (pool.length < 4) {
    Object.entries(TOPICAL).forEach(([key, refs]) => {
      if (key !== t && (key.includes(t) || t.includes(key))) pool.push(...refs);
    });
  }
  return [...new Set(pool)].filter((r) => !taggedRefs.has(r)).slice(0, 8);
}

/* Free-text search across the topical index */
function searchTopical(query) {
  const q = normTopic(query);
  if (!q) return [];
  const hits = [];
  Object.entries(TOPICAL).forEach(([topic, refs]) => {
    if (topic.includes(q) || q.includes(topic)) hits.push({ topic, refs });
  });
  return hits.slice(0, 4);
}

/* Word search across the whole ESV, with one-tap tagging of any hit */
function ScriptureSearch({ initialQuery, tagTopic, onTag, taggedRefs }) {
  const cfg = React.useContext(ScriptureContext);
  const [q, setQ] = useState(initialQuery || "");
  const [state, setState] = useState({ status: "idle" });
  const hasKey = !!(cfg.apiKey || cfg.proxyUrl);

  const run = async (page = 1) => {
    const query = q.trim();
    if (!query) return;
    setState({ status: "loading" });
    try {
      const r = await searchESV(query, cfg, page);
      setState({ status: "ok", ...r, query });
    } catch (e) {
      setState({ status: "error", message: e.message });
    }
  };

  if (!hasKey) {
    return (
      <div className="sn-callout">
        Word search needs an ESV key — add one under Backup &amp; storage and you can
        search the whole Bible for a phrase, then tag what you find.
      </div>
    );
  }

  return (
    <div className="sn-esvsearch">
      <div className="sn-search">
        <span className="ico">⌕</span>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={tagTopic ? `Search the ESV for "${tagTopic}"` : "Search the ESV for a word or phrase"}
          onKeyDown={(e) => { if (e.key === "Enter") run(1); }} />
        {q && <button className="clear" onClick={() => { setQ(""); setState({ status: "idle" }); }}>×</button>}
      </div>
      <button className="sn-btn sn-btn-accent sn-btn-full sn-btn-sm" onClick={() => run(1)}
        disabled={!q.trim() || state.status === "loading"}>
        {state.status === "loading" ? "Searching…" : "Search scripture"}
      </button>

      {state.status === "error" && <div className="sn-note warn">{state.message}</div>}

      {state.status === "ok" && (
        <>
          <div className="sn-secttl">
            {state.total} result{state.total === 1 ? "" : "s"} for "{state.query}"
          </div>
          {state.results.map((r) => {
            const already = taggedRefs.has(r.ref);
            return (
              <div className="sn-hit" key={r.ref}>
                <div className="sn-hit-ref sn-mono">{r.ref}</div>
                <div className="sn-hit-text">{r.snippet}</div>
                <div className="sn-hit-ft">
                  {already
                    ? <span className="sn-hit-have">In your library</span>
                    : <button className="sn-suggest-add" onClick={() => onTag(r.ref)}>
                        {tagTopic ? `+ ${tagTopic}` : "+ Tag it"}
                      </button>}
                </div>
              </div>
            );
          })}
          <div className="sn-hit-attr">
            ESV <a href="https://www.esv.org" target="_blank" rel="noreferrer">esv.org</a>
          </div>
          {state.pages > 1 && (
            <div className="sn-hit-pager">
              <button disabled={state.page <= 1} onClick={() => run(state.page - 1)}>‹ Back</button>
              <span>{state.page} of {state.pages}</span>
              <button disabled={state.page >= state.pages} onClick={() => run(state.page + 1)}>More ›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* A recommended passage, showing its text. Fetching waits until the row
   is actually on screen, so a search doesn't fire a request for every
   suggestion before you've read the first one. */
function SuggestedVerse({ refStr, topic, onAdd, onTagged }) {
  const cfg = React.useContext(ScriptureContext);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const hasKey = !!(cfg.apiKey || cfg.proxyUrl);

  return (
    <div className="sn-suggest" ref={ref}>
      <div className="sn-suggest-hd">
        <span className="sn-mono">{refStr}</span>
        <button className="sn-suggest-add" onClick={() => onAdd(refStr)}>+ {topic}</button>
      </div>
      {hasKey && visible && (
        <div className="sn-suggest-text">
          <ScriptureText refStr={refStr} preset="verse" />
        </div>
      )}
      {!hasKey && (
        <button className="sn-suggest-read" onClick={() => onTagged(refStr)}>Open it</button>
      )}
    </div>
  );
}

/* ===============================================================
   HIGHLIGHTS
   ---------------------------------------------------------------
   Per-verse marks, kept separately from topics so a verse can be
   highlighted without being filed under anything.
   =============================================================== */
async function loadHighlights() {
  try {
    const r = await storage.get("verse-highlights");
    return r ? JSON.parse(r.value) : {};
  } catch { return {}; }
}
async function saveHighlights(h) {
  try { await storage.set("verse-highlights", JSON.stringify(h)); return true; }
  catch { return false; }
}
const HighlightsContext = React.createContext({ highlights: {}, toggleHighlight: () => {} });

/* Wrap each verse in a tappable span, working on the markup string before
   React renders it. Doing this afterwards by mutating the DOM was fragile:
   the timing depended on effects running after paint, and any re-render
   could discard the changes. This way the spans are part of the markup. */
function markVerses(html) {
  try {
    if (typeof DOMParser === "undefined") return { html, ok: false };
    const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html");
    const root = doc.getElementById("r");
    if (!root) return { html, ok: false };

    const marks = root.querySelectorAll(".verse-num, .chapter-num");
    if (marks.length === 0) return { html, ok: false };

    /* A verse runs until the next number, crossing paragraphs and poetry
       lines, so wrap per block and carry the number forward. */
    let carry = null;
    const blocks = [...root.querySelectorAll("p, .block-indent")];
    if (blocks.length === 0) blocks.push(root);

    blocks.forEach((block) => {
      const kids = [...block.childNodes];
      let current = carry;
      let bucket = [];

      const flush = () => {
        if (current == null || bucket.length === 0) { bucket = []; return; }
        const span = doc.createElement("span");
        span.setAttribute("data-v", String(current));
        block.insertBefore(span, bucket[0]);
        bucket.forEach((n) => span.appendChild(n));
        bucket = [];
      };

      kids.forEach((node) => {
        const isMark = node.nodeType === 1 &&
          (node.classList?.contains("verse-num") || node.classList?.contains("chapter-num"));
        if (isMark) {
          flush();
          const n = parseInt((node.textContent || "").replace(/\D+/g, ""), 10);
          if (!Number.isNaN(n)) current = n;
          bucket.push(node);
          return;
        }
        bucket.push(node);
      });
      flush();
      carry = current;
    });

    const out = root.innerHTML;
    return { html: out, ok: out.includes("data-v=") };
  } catch (e) {
    console.warn("Verse marking failed:", e);
    return { html, ok: false };
  }
}

/* ===============================================================
   BIBLE — read anything, mark it up as you go
   =============================================================== */
function BibleTab({ coverage, onMarkChapters, onDevotion }) {
  const cfg = React.useContext(ScriptureContext);
  const { topics, setTopicsFor } = React.useContext(TopicsContext);
  const { highlights, toggleHighlight } = React.useContext(HighlightsContext);

  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [testament, setTestament] = useState("All");
  const [bookOpen, setBookOpen] = useState(null);
  const [chapter, setChapter] = useState(null);      // { book, ch }
  const [state, setState] = useState({ status: "idle" });
  const [selected, setSelected] = useState(null);    // verse number tapped
  const [focusRange, setFocusRange] = useState(null); // verses you asked for
  const bodyRef = useRef(null);

  const hasKey = !!(cfg.apiKey || cfg.proxyUrl);
  const book = chapter ? bookByName(chapter.book) : null;

  const browseBooks = useMemo(() => {
    let list = matchBooks(q);
    if (testament !== "All") list = list.filter((b) => b.testament === testament);
    return list;
  }, [q, testament]);
  const label = chapter ? `${chapter.book} ${chapter.ch}` : "";

  const open = async (bk, ch, focus) => {
    setChapter({ book: bk, ch });
    setSelected(focus ? focus.start : null);
    setFocusRange(focus || null);
    setState({ status: "loading" });
    try {
      const r = await getScripture(`${bk} ${ch}`, cfg, "bible");
      const marked = r.html ? markVerses(r.html) : { html: null, ok: false };
      setWrapOk(marked.ok);
      setState({ status: "ok", ...r, html: marked.html || r.html });
    } catch (e) {
      setState({ status: "error", message: e.message });
    }
  };

  const step = (delta) => {
    if (!book) return;
    let { ch } = chapter;
    let idx = BOOKS.findIndex((b) => b.name === chapter.book);
    ch += delta;
    if (ch < 1) { idx -= 1; if (idx < 0) return; ch = BOOKS[idx].verses.length; }
    else if (ch > book.verses.length) { idx += 1; if (idx >= BOOKS.length) return; ch = 1; }
    open(BOOKS[idx].name, ch, null);
    window.scrollTo({ top: 0 });
  };

  const [wrapOk, setWrapOk] = useState(true);

  /* Paint highlights without re-fetching */
  useEffect(() => {
    const root = bodyRef.current;
    if (!root || !chapter) return;
    root.querySelectorAll("[data-v]").forEach((el) => {
      const n = parseInt(el.getAttribute("data-v"), 10);
      const ref = `${chapter.book} ${chapter.ch}:${n}`;
      el.classList.toggle("hl", !!highlights[ref]);
      el.classList.toggle("tagged", (topics[ref] || []).length > 0);
      el.classList.toggle("sel", selected === n);
      el.classList.toggle("focus",
        !!focusRange && n >= focusRange.start && n <= focusRange.end);
    });
  }, [highlights, topics, selected, focusRange, state.status, chapter]);

  /* Bring the verse you asked for into view rather than the top of the chapter */
  useEffect(() => {
    if (state.status !== "ok" || !focusRange) return;
    const root = bodyRef.current;
    if (!root) return;
    const el = root.querySelector(`[data-v="${focusRange.start}"]`);
    if (el) {
      requestAnimationFrame(() =>
        el.scrollIntoView({ block: "center", behavior: "smooth" }));
    }
  }, [state.status, focusRange]);

  const onBodyClick = (e) => {
    const el = e.target.closest?.("[data-v]");
    if (!el) return;
    const n = parseInt(el.getAttribute("data-v"), 10);
    setSelected((cur) => (cur === n ? null : n));
  };

  const selRef = chapter && selected ? `${chapter.book} ${chapter.ch}:${selected}` : null;
  const done = chapter ? chapterDone(coverage, chapter.book, chapter.ch) : false;

  return (
    <div className="sn-scroll">
      {chapter ? (
        <div className="sn-search" onClick={() => { setChapter(null); setBookOpen(null); setQ(""); }}>
          <span className="ico">⌕</span>
          <input readOnly placeholder="Choose a book, chapter and verse"
            value={focusRange
              ? `${label}:${focusRange.start}${focusRange.end > focusRange.start ? `-${focusRange.end}` : ""}`
              : label} />
          <button className="clear" onClick={(e) => {
            e.stopPropagation(); setChapter(null); setBookOpen(null); setQ("");
          }}>×</button>
        </div>
      ) : (
        <div className="sn-search">
          <span className="ico">⌕</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setBookOpen(null); }}
            placeholder="Jump to a book, or pick one below" />
          {q && <button className="clear" onClick={() => setQ("")}>×</button>}
          <button className="sn-searchalt" onClick={() => setPicking(true)}>Verse</button>
        </div>
      )}

      {picking && (
        <VersePicker onClose={() => setPicking(false)}
          onPick={(ref) => {
            const parsed = parseReading(ref);
            if (!parsed) return;
            /* A chapter-only pick has no verses to focus; a verse or range does. */
            const whole = parsed.start === 1 && parsed.end === (bookByName(parsed.book)?.verses[parsed.ch - 1] || 0);
            open(parsed.book, parsed.ch, whole ? null : { start: parsed.start, end: parsed.end });
          }} />
      )}

      {!chapter && (
        <>
          <div className="sn-note" style={{ margin: "-4px 0 16px" }}>
            Pick a book, then a chapter. Tap any verse while reading to highlight or tag it.
          </div>

          {!bookOpen ? (
            <>
              <div className="sn-tseg" style={{ marginBottom: 14 }}>
                {["All", "Old", "New"].map((t) => (
                  <button key={t} className={testament === t ? "on" : ""}
                    onClick={() => setTestament(t)}>
                    {t === "All" ? "All books" : `${t} Testament`}
                  </button>
                ))}
              </div>
              <div className="sn-booklist">
                {browseBooks.map((b) => (
                  <button className="sn-bookrow" key={b.name} onClick={() => setBookOpen(b)}>
                    <span className="nm">{b.name}</span>
                    <span className="ct">{b.verses.length} ch</span>
                  </button>
                ))}
                {browseBooks.length === 0 && (
                  <div className="sn-empty">No book matches that.</div>
                )}
              </div>
            </>
          ) : (
            <>
              <button className="sn-back" onClick={() => setBookOpen(null)}>‹ All books</button>
              <div className="sn-chapterhd sn-serif">{bookOpen.name}</div>
              <div className="sn-grid">
                {bookOpen.verses.map((_, i) => (
                  <button key={i} className="sn-cell"
                    onClick={() => { open(bookOpen.name, i + 1, null); setBookOpen(null); }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {chapter && (
        <>
          <div className="sn-biblehd">
            <button className="sn-stepbtn" onClick={() => step(-1)}>‹</button>
            <h2 className="sn-serif">
              {label}{focusRange &&
                `:${focusRange.start}${focusRange.end > focusRange.start ? `-${focusRange.end}` : ""}`}
            </h2>
            <button className="sn-stepbtn" onClick={() => step(1)}>›</button>
          </div>

          {focusRange && (
            <button className="sn-focusnote" onClick={() => { setFocusRange(null); setSelected(null); }}>
              Showing the whole chapter · clear the highlight on those verses
            </button>
          )}

          {!hasKey && (
            <div className="sn-callout">
              Add your ESV key under Backup &amp; storage to read passages here.
            </div>
          )}
          {state.status === "loading" && <div className="sn-empty">Loading {label}…</div>}
          {state.status === "error" && <div className="sn-note warn">{state.message}</div>}

          {state.status === "ok" && (
            <>
              <div className="sn-biblebody" ref={bodyRef} onClick={onBodyClick}>
                {state.html
                  ? <div className="sn-esvhtml" dangerouslySetInnerHTML={{ __html: state.html }} />
                  : <div className="sn-scripture">{state.text}</div>}
              </div>
              {!wrapOk && (
                <div className="sn-note warn">
                  Verse marking isn't available for this passage — the text is
                  still readable, and you can tag verses from the Verses tab.
                </div>
              )}
              <div className="sn-scripture-attr">
                ESV <a href="https://www.esv.org" target="_blank" rel="noreferrer">esv.org</a>
              </div>
            </>
          )}

          <div className="sn-readft">
            <div className="sn-readft-lbl">Finished reading?</div>
            <button className="sn-btn sn-btn-accent sn-btn-full"
              onClick={() => onMarkChapters([{ book: chapter.book, ch: chapter.ch }])}>
              {done ? "Marked as read" : "Mark as read"}
            </button>
            <button className="sn-btn sn-btn-ghost sn-btn-full" style={{ marginTop: 9 }}
              onClick={() => onDevotion([{ book: chapter.book, ch: chapter.ch }])}>
              Write a devotion on this
            </button>
          </div>
        </>
      )}

      {/* verse actions, anchored to the bottom while a verse is selected */}
      {selRef && (
        <div className="sn-versebar">
          <div className="sn-versebar-hd">
            <span className="sn-mono">{selRef}</span>
            <button className="sn-x" onClick={() => setSelected(null)}>×</button>
          </div>
          <button className={"sn-hlbtn" + (highlights[selRef] ? " on" : "")}
            onClick={() => toggleHighlight(selRef)}>
            {highlights[selRef] ? "Remove highlight" : "Highlight this verse"}
          </button>
          <TopicTags refStr={selRef} />
        </div>
      )}
    </div>
  );
}

/* ===============================================================
   READER — read the passage in the app, then act on it
   =============================================================== */
function Reader({ target, coverage, onMarkRead, onDevotion, onBack }) {
  const cfg = React.useContext(ScriptureContext);
  const hasText = !!(cfg.apiKey || cfg.proxyUrl);
  const chapters = target.chapters || [];
  const label = target.label || labelChapters(chapters);
  const done = chapters.every((c) => chapterDone(coverage, c.book, c.ch));

  return (
    <div className="sn-scroll">
      <button className="sn-back" onClick={onBack}>‹ Back</button>

      <div className="sn-readhd">
        <h2 className="sn-serif">{label}</h2>
        {done && <span className="sn-readdone">Already read</span>}
      </div>

      {!hasText && (
        <div className="sn-callout">
          Add your free ESV key under Backup &amp; storage and the text will appear
          here. Until then, read in your Bible and use the buttons below.
        </div>
      )}

      {hasText && chapters.map((c) => (
        <div className="sn-readch" key={`${c.book} ${c.ch}`}>
          <div className="sn-readch-lbl sn-mono">{c.book} {c.ch}</div>
          <ScriptureText refStr={`${c.book} ${c.ch}`} preset="reader" />
        </div>
      ))}

      <div className="sn-readft">
        <div className="sn-readft-lbl">Finished reading?</div>
        <button className="sn-btn sn-btn-accent sn-btn-full" onClick={() => onMarkRead(chapters)}>
          {done ? "Marked as read" : "Mark as read"}
        </button>
        <button className="sn-btn sn-btn-ghost sn-btn-full" style={{ marginTop: 9 }}
          onClick={() => onDevotion(chapters)}>
          Write a devotion on this
        </button>
        <div className="sn-note" style={{ textAlign: "center" }}>
          Writing a devotion marks it read too.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Daily proverb — a single verse, the same one all day for everyone
   on that date, chosen by hashing the date across all 915 verses of
   Proverbs. Crossway has no verse-of-the-day endpoint; their own
   sample does this with chapter lengths, which the app already has.
--------------------------------------------------------------- */
function proverbForToday(dateStr) {
  const book = bookByName("Proverbs");
  if (!book) return null;

  const today = dateStr || new Date().toISOString().slice(0, 10);

  /* FNV-1a with an avalanche finish. A weaker hash walks the book one
     verse per day, since consecutive dates differ by a single character. */
  let h = 0x811c9dc5;
  for (let i = 0; i < today.length; i++) {
    h = (h ^ today.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h = ((h ^ (h >>> 16)) >>> 0);
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h = ((h ^ (h >>> 15)) >>> 0);
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h = ((h ^ (h >>> 16)) >>> 0);

  const total = book.verses.reduce((a, b) => a + b, 0);   // 915 verses
  let n = h % total;
  for (let ch = 0; ch < book.verses.length; ch++) {
    if (n < book.verses[ch]) return { book: "Proverbs", ch: ch + 1, verse: n + 1,
                                      ref: `Proverbs ${ch + 1}:${n + 1}` };
    n -= book.verses[ch];
  }
  return { book: "Proverbs", ch: 1, verse: 1, ref: "Proverbs 1:1" };
}

function ProverbCard({ coverage, onRead, onOpen }) {
  const cfg = React.useContext(ScriptureContext);
  const p = proverbForToday();
  if (!p) return null;

  const ranges = coverage[`${p.book} ${p.ch}`] || [];
  const read = ranges.some(([a, b]) => p.verse >= a && p.verse <= b);
  const hasText = !!(cfg.apiKey || cfg.proxyUrl);

  return (
    <div className="sn-panel">
      <div className="sn-panel-hd">
        <span>Proverb for today</span>
        <button className="sn-link" onClick={() => onOpen([{ book: p.book, ch: p.ch }])}>
          Whole chapter
        </button>
      </div>

      <div className="sn-today-lbl">{p.ref}</div>

      {hasText
        ? <div className="sn-proverb-text"><ScriptureText refStr={p.ref} preset="verse" /></div>
        : <div className="sn-proverb-noref">
            Add an ESV key under Backup &amp; storage to see the verse here.
          </div>}

      <div className="sn-today-actions">
        {read ? (
          <div className="sn-proverb-done">Read today ✓</div>
        ) : (
          <button className="sn-btn sn-btn-accent sn-btn-sm" style={{ flex: 1 }}
            onClick={() => onRead(p.ref)}>Mark read</button>
        )}
      </div>
    </div>
  );
}

/* ===============================================================
   COPYRIGHT & ABOUT
   ---------------------------------------------------------------
   Crossway requires three things of anyone using the ESV API: the
   letters "ESV" with each quotation, a link to esv.org on every
   page showing the text, and the full notice on a copyright page.
   The first two live in ScriptureText; this is the third.
   =============================================================== */
function About({ scripture }) {
  const usingEsv = !!(scripture.apiKey || scripture.proxyUrl);

  return (
    <div className="sn-scroll">
      <div className="sn-secttl" style={{ marginTop: 0 }}>Scripture copyright</div>

      {usingEsv ? (
        <>
          <div className="sn-legal">
            Scripture quotations are from the ESV® Bible (The Holy Bible, English
            Standard Version®), © 2001 by Crossway, a publishing ministry of Good
            News Publishers. Used by permission. All rights reserved.
          </div>
          <div className="sn-legal">
            The ESV text may not be quoted in any publication made available to the
            public by a Creative Commons license. The ESV may not be translated into
            any other language.
          </div>
          <div className="sn-legal">
            "ESV" and "English Standard Version" are registered trademarks of Crossway.
            Use of either trademark requires the permission of Crossway.
          </div>
        </>
      ) : (
        <div className="sn-legal">
          No Bible text is stored or displayed in this app. Verse references are your
          own notation; any summaries are your own words. If you connect an ESV key
          under Backup &amp; storage, Crossway's copyright notice will appear here
          and with every passage.
        </div>
      )}

      <div className="sn-secttl">Verse data</div>
      <div className="sn-legal">
        Book names and the chapter and verse counts used by the reference picker
        follow the standard Protestant canon. These are facts of structure, not
        text, and no translation is reproduced.
      </div>

      <div className="sn-secttl">Your notes</div>
      <div className="sn-legal">
        Everything you write stays on this device. There is no account, no server
        and no analytics. Nothing is transmitted anywhere{usingEsv
          ? ", apart from the passage references sent to Crossway when you request text."
          : "."}
      </div>
      <div className="sn-legal">
        Because the data lives only here, deleting the app or clearing this browser's
        storage removes it permanently. Export a backup from Backup &amp; storage and
        keep it somewhere safe.
      </div>

      <div className="sn-secttl">Typefaces</div>
      <div className="sn-legal">
        Set in Lora, Inter and IBM Plex Mono, all licensed under the SIL Open Font
        License.
      </div>

      <div className="sn-about-ft">
        {usingEsv && (
          <div className="sn-esvline">
            ESV text via <a href="https://www.esv.org" target="_blank" rel="noreferrer">www.esv.org</a>
          </div>
        )}
        John's Notes · built for one reader
      </div>
    </div>
  );
}

/* ===============================================================
   HOME
   =============================================================== */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function PlanSetup({ plan, onSave, onCancel }) {
  const [scopeId, setScopeId] = useState(plan?.scopeId || "all");
  const [paced, setPaced] = useState(plan?.paced ?? false);
  const [targetDays, setTargetDays] = useState(plan?.targetDays || 365);

  const stats = useMemo(() => coverageStats({}, scopeId), [scopeId]);
  const perDay = Math.ceil(stats.totalCh / (targetDays || 1));

  return (
    <div className="sn-panel">
      <div className="sn-panel-hd">
        <span>{plan ? "Change plan" : "Start a reading plan"}</span>
        {plan && <button className="sn-link" onClick={onCancel}>Cancel</button>}
      </div>

      <div className="sn-sublbl">What are you reading through</div>
      <div className="sn-scopegrid">
        {SCOPES.map((sc) => (
          <button key={sc.id} className={"sn-scopeopt" + (scopeId === sc.id ? " on" : "")}
            onClick={() => setScopeId(sc.id)}>{sc.label}</button>
        ))}
      </div>

      <div className="sn-sublbl" style={{ marginTop: 13 }}>Pace</div>
      <div className="sn-paceopts">
        <button className={"sn-paceopt" + (!paced ? " on" : "")} onClick={() => setPaced(false)}>
          <div className="nm">No deadline</div>
          <div className="bl">Read at whatever pace life allows. Progress only.</div>
        </button>
        <button className={"sn-paceopt" + (paced ? " on" : "")} onClick={() => setPaced(true)}>
          <div className="nm">On a timeline</div>
          <div className="bl">Set a finish date and see if you're keeping up.</div>
        </button>
      </div>

      {paced && (
        <div style={{ marginTop: 11 }}>
          <div className="sn-sublbl">Finish in</div>
          <div className="sn-dayopts">
            {[30, 90, 180, 365].map((d) => (
              <button key={d} className={"sn-dayopt" + (targetDays === d ? " on" : "")}
                onClick={() => setTargetDays(d)}>{d}d</button>
            ))}
          </div>
          <div className="sn-note" style={{ marginTop: 6 }}>
            About {perDay} chapter{perDay === 1 ? "" : "s"} a day to finish on time.
          </div>
        </div>
      )}

      <button className="sn-btn sn-btn-accent sn-btn-full" style={{ marginTop: 13 }}
        onClick={() => onSave({ scopeId, paced, targetDays: paced ? targetDays : null })}>
        {plan ? "Save plan" : "Start reading"}
      </button>
      {plan && (
        <div className="sn-note" style={{ marginTop: 7 }}>
          Everything you've already logged is kept — only the goal changes.
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, onSetup, onLog, onQuickRead, onRead, onDevotionFrom }) {
  const [showLog, setShowLog] = useState(false);
  const [openLog, setOpenLog] = useState(null);
  const { topics } = React.useContext(TopicsContext);

  /* Collapse repeats: reading a passage twice shouldn't take two rows. */
  const recentReads = useMemo(() => {
    const seen = new Map();
    [...(plan.log || [])].reverse().forEach((r) => {
      if (!seen.has(r.ref)) seen.set(r.ref, r);
    });
    return [...seen.values()].slice(0, 5);
  }, [plan.log]);
  const coverage = plan.coverage || {};
  const stats = useMemo(() => coverageStats(coverage, plan.scopeId), [coverage, plan.scopeId]);
  const pace = paceStatus(plan, stats);
  const next = nextUnread(coverage, plan.scopeId);
  const suggestion = useMemo(() => suggestNext(coverage, plan.scopeId, 3), [coverage, plan.scopeId]);
  const streak = streakOf(plan.log);
  const scope = SCOPES.find((sc) => sc.id === plan.scopeId);

  return (
    <div className="sn-panel">
      <div className="sn-panel-hd">
        <span>{scope?.label}{plan.paced ? ` · ${plan.targetDays}d` : " · no deadline"}</span>
        <button className="sn-link" onClick={onSetup}>Change</button>
      </div>

      <div className="sn-progress-row">
        <div className="sn-progress-num">
          <strong>{stats.pct}</strong><span>%</span>
        </div>
        <div className="sn-progress-meta">
          <div className="sn-meter"><div className="sn-meter-fill" style={{ width: stats.pct + "%" }} /></div>
          <div className="sn-note" style={{ margin: 0 }}>
            {stats.doneCh} of {stats.totalCh} chapters
            {stats.partialCh > 0 && <> · {stats.partialCh} part-read</>}
            {streak > 1 && <> · <span className="sn-streak">{streak}-day streak</span></>}
          </div>
        </div>
      </div>

      {pace && (
        <div className={"sn-pace" + (pace.onTrack ? " ok" : " behind")}>
          {pace.daysOff === 0 ? "Right on pace."
            : pace.onTrack ? `${pace.daysOff} day${pace.daysOff === 1 ? "" : "s"} ahead.`
            : `${Math.abs(pace.daysOff)} day${Math.abs(pace.daysOff) === 1 ? "" : "s"} behind — no rush.`}
          {pace.remaining > 0 && <> About {pace.neededPerDay} verses a day to finish on time.</>}
        </div>
      )}

      {next ? (
        <>
          <div className="sn-today-lbl">
            {next.partial ? "Partly read — pick up at" : "Next unread"}
          </div>
          <div className="sn-today sn-serif">
            {labelChapters(suggestion)}
            {next.partial && (
              <span className="sn-partial"> ({next.versesRead}/{next.versesTotal} verses in {next.book} {next.ch})</span>
            )}
          </div>
          <div className="sn-today-actions">
            <button className="sn-btn sn-btn-accent sn-btn-sm" style={{ flex: 2 }}
              onClick={() => onRead(suggestion)}>Read now</button>
            <button className="sn-btn sn-btn-ghost sn-btn-sm" style={{ flex: 1 }}
              onClick={() => onQuickRead(`${next.book} ${next.ch}`)}>Mark read</button>
          </div>
        </>
      ) : (
        <div className="sn-today sn-serif" style={{ marginBottom: 10 }}>
          {scope?.label} complete. Well done.
        </div>
      )}

      <button className="sn-btn sn-btn-ghost sn-btn-full sn-btn-sm" style={{ marginTop: 9 }}
        onClick={() => setShowLog(true)}>
        Log something else I read
      </button>

      {showLog && (
        <VersePicker onClose={() => setShowLog(false)} onPick={(ref) => onLog(ref)} />
      )}

      {(plan.log || []).length > 0 && (
        <div className="sn-loglist">
          <div className="sn-sublbl" style={{ marginTop: 12 }}>Recently read</div>
          {recentReads.map((r) => {
            const open = openLog === r.ref;
            const tags = topics[r.ref] || [];
            return (
              <div key={r.ref}>
                <button className="sn-logrow" onClick={() => setOpenLog(open ? null : r.ref)}>
                  <span className="ref sn-mono">{r.ref}</span>
                  <span className="dt">
                    {new Date(r.on + "T00:00:00").toLocaleDateString(undefined,
                      { month: "short", day: "numeric" })}
                  </span>
                  <span className="chev">{open ? "−" : "+"}</span>
                  {tags.length > 0 && (
                    <span className="tags">{tags.slice(0, 3).join(" · ")}
                      {tags.length > 3 ? ` +${tags.length - 3}` : ""}</span>
                  )}
                </button>
                {open && (
                  <div className="sn-logopen">
                    <ScriptureText refStr={r.ref} compact />
                    <TopicTags refStr={r.ref} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Home({ entries, plan, topics, onSetPlan, onLogReading, onDevotionFrom,
                onOpen, onOpenTopic, onAllTopics, onAbout, onRead, onMarkChapters }) {
  const [editingPlan, setEditingPlan] = useState(false);
  const [topicQ, setTopicQ] = useState("");
  const shortcuts = useMemo(() => topTopics(topics, 6), [topics]);
  const allTopics = useMemo(() => topTopics(topics, 999), [topics]);
  const matches = useMemo(() => {
    const q = topicQ.trim().toLowerCase();
    if (!q) return [];
    /* starts-with first, then anywhere — closest guess leads */
    const starts = allTopics.filter((t) => t.topic.startsWith(q));
    const rest = allTopics.filter((t) => !t.topic.startsWith(q) && t.topic.includes(q));
    return [...starts, ...rest].slice(0, 8);
  }, [allTopics, topicQ]);
  const resurfaced = useMemo(() => resurfacedVerse(entries, topics), [entries, topics]);
  const recent = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  const today = new Date().toLocaleDateString(undefined,
    { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="sn-scroll">
      <div className="sn-greet">
        <div className="sn-greet-hi sn-serif">{greeting()}, John</div>
        <div className="sn-greet-date">{today}</div>
      </div>

      {(!plan || editingPlan) ? (
        <PlanSetup plan={plan}
          onSave={(cfg) => { onSetPlan(cfg); setEditingPlan(false); }}
          onCancel={() => setEditingPlan(false)} />
      ) : (
        <PlanCard plan={plan}
          onSetup={() => setEditingPlan(true)}
          onLog={onLogReading}
          onQuickRead={onLogReading}
          onRead={onRead}
          onDevotionFrom={onDevotionFrom} />
      )}

      <ProverbCard coverage={plan?.coverage || {}} onRead={onLogReading} onOpen={onRead} />

      {allTopics.length > 0 && (
        <>
          <div className="sn-secttl">Pray through</div>

          <div className="sn-search">
            <span className="ico">⌕</span>
            <input value={topicQ} onChange={(e) => setTopicQ(e.target.value)}
              placeholder="What are you praying about?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches.length) onOpenTopic(matches[0].topic);
              }} />
            {topicQ && (
              <button className="clear" onClick={() => setTopicQ("")} aria-label="Clear">×</button>
            )}
          </div>

          <div className="sn-topicrow">
            {(topicQ ? matches : shortcuts).map((t, i) => (
              <button className={"sn-topicpill" + (!topicQ && i === 0 ? " hot" : "")} key={t.topic}
                onClick={() => onOpenTopic(t.topic)}>
                {t.topic}<span className="ct">{t.count}</span>
              </button>
            ))}
            {topicQ && matches.length === 0 && (
              <span className="sn-note" style={{ marginTop: 2 }}>
                No topic matches that yet.
              </span>
            )}
            {!topicQ && (
              <button className="sn-topicpill all" onClick={onAllTopics}>All topics ›</button>
            )}
          </div>
        </>
      )}

      {resurfaced && (
        <>
          <div className="sn-secttl">Worth revisiting</div>
          <div className="sn-resurface" onClick={() => onOpenTopic(null, resurfaced.ref)}>
            <div className="sn-resurface-ref sn-mono">{resurfaced.ref}</div>
            {resurfaced.gists[0] && (
              <div className="sn-resurface-gist sn-serif">
                <span className="sn-hl">{resurfaced.gists[0]}</span>
              </div>
            )}
            <div className="sn-resurface-ft">
              {resurfaced.topics.slice(0, 3).map((t) => (
                <span className="sn-topic mini" key={t}>{t}</span>
              ))}
              <span className="ago">
                last noted {new Date(resurfaced.lastSeen + "T00:00:00")
                  .toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="sn-secttl">Recent</div>
          {recent.map((e) => (
            <div className="sn-recent" key={e.id} onClick={() => onOpen(e)}>
              <span className={"sn-dotkind " + (e.kind === "devotion" ? "dev" : "ser")} />
              <span className="ttl">{e.title || (e.kind === "devotion" ? "Devotion" : "Untitled")}</span>
              <span className="dt">
                {new Date(e.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </>
      )}

      <button className="sn-footlink" onClick={onAbout}>Copyright &amp; about</button>
    </div>
  );
}

/* ===============================================================
   DRAWER
   =============================================================== */
/* Drawer icons drawn as SVG so they take the current text colour
   instead of arriving as multicoloured emoji. */
function DrawerIcon({ id, glyph }) {
  const stroke = {
    fill: "none", stroke: "currentColor", strokeWidth: 1.6,
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  if (id === "bible") {
    return (
      <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
        <path d="M4.5 3.2h9.2a1.8 1.8 0 0 1 1.8 1.8v10a1.8 1.8 0 0 1-1.8 1.8H4.5z" {...stroke} />
        <path d="M4.5 3.2a1.4 1.4 0 0 0 0 2.8" {...stroke} />
        <path d="M10.2 7.6v4.6M8.2 9.4h4" {...stroke} />
      </svg>
    );
  }
  if (id === "library") {
    return (
      <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
        <path d="M10 5.6v10" {...stroke} />
        <path d="M10 5.6C8.4 4.4 6.6 4 4 4v10c2.6 0 4.4.4 6 1.6" {...stroke} />
        <path d="M10 5.6C11.6 4.4 13.4 4 16 4v10c-2.6 0-4.4.4-6 1.6" {...stroke} />
      </svg>
    );
  }
  return <span>{glyph}</span>;
}

function Drawer({ open, tab, onClose, onGo, counts }) {
  const items = [
    { id: "home",     icon: "⌂", label: "Home" },
    { id: "sermon",   icon: "✎", label: "New sermon" },
    { id: "devotion", icon: "✻", label: "New devotion" },
    { id: "bible",    icon: "", label: "Bible" },
    { id: "library",  icon: "", label: "Library", count: counts.entries },
    { id: "verses",   icon: "🔎", label: "Verses", count: counts.verses },
    { id: "data",     icon: "⤓", label: "Backup & storage" },
    { id: "about",    icon: "©", label: "Copyright & about", foot: true },
  ];

  return (
    <>
      <div className={"sn-scrim" + (open ? " on" : "")} onClick={onClose} />
      <nav className={"sn-drawer" + (open ? " on" : "")}>
        <div className="sn-drawer-hd">
          <div className="sn-serif sn-brand">John's Notes</div>
          <button className="sn-x" onClick={onClose}>×</button>
        </div>
        {items.map((it) => (
          <button key={it.id}
            className={"sn-drawer-item" + (tab === it.id ? " on" : "") + (it.foot ? " foot" : "")}
            onClick={() => onGo(it.id)}>
            <span className="ico"><DrawerIcon id={it.id} glyph={it.icon} /></span>
            <span className="lbl">{it.label}</span>
            {it.count > 0 && <span className="ct">{it.count}</span>}
          </button>
        ))}
      </nav>
    </>
  );
}

/* ===============================================================
   DATA — export, import, storage health
   =============================================================== */
function exportFilename() {
  return `johns-notes-${new Date().toISOString().slice(0, 10)}.json`;
}

function DataPanel({ notes, devotions, topics, plan, scripture, onSaveEsv, onImport, onFlash }) {
  const [esv, setEsvLocal] = useState(scripture);
  const [esvTesting, setEsvTesting] = useState(false);
  const [esvResult, setEsvResult] = useState(null);
  const [esvCached, setEsvCached] = useState(0);
  useEffect(() => { esvCacheLoad().then((c) => setEsvCached(cacheVerseCount(c))); }, []);
  const [persist, setPersist] = useState({ supported: false, persisted: false });
  const [est, setEst] = useState(null);
  const [pending, setPending] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    requestPersistence().then(setPersist);
    storageEstimate().then(setEst);
  }, []);

  const doExport = async (withPhotos) => {
    let photoBlobs = undefined;
    if (withPhotos) {
      photoBlobs = {};
      const all = [...notes, ...devotions].flatMap((e) => e.photos || []);
      for (const p of all) {
        const d = await photoStore.get(p.id);
        if (d) photoBlobs[p.id] = d;
      }
    }
    const payload = {
      app: "johns-notes",
      version: 1,
      exportedAt: new Date().toISOString(),
      counts: { notes: notes.length, devotions: devotions.length, taggedRefs: Object.keys(topics).length },
      notes, devotions, topics, plan,
      ...(photoBlobs ? { photoBlobs } : {}),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = exportFilename();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onFlash(withPhotos ? "Backup with photos downloaded" : "Backup downloaded");
  };

  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || (!Array.isArray(data.notes) && !Array.isArray(data.devotions))) {
          throw new Error("That file isn't a John's Notes backup.");
        }
        setPending(data);
      } catch (err) {
        onFlash(err.message || "Couldn't read that file");
      }
    };
    reader.onerror = () => onFlash("Couldn't read that file");
    reader.readAsText(file);
  };

  const apply = (mode) => {
    onImport(pending, mode);
    setPending(null);
  };

  const allPhotos = [...notes, ...devotions].flatMap((e) => e.photos || []);
  const photoCount = allPhotos.length;
  const photoMB = (allPhotos.reduce((sum, p) => sum + (p.kb || 0), 0) / 1024).toFixed(1);

  const pct = est && est.quota ? Math.min(100, (est.usage / est.quota) * 100) : null;
  const kb = est ? Math.round(est.usage / 1024) : null;

  return (
    <div className="sn-scroll">
      <div className="sn-secttl" style={{ marginTop: 0 }}>Backup</div>
      <div className="sn-note" style={{ marginBottom: 12 }}>
        Everything lives on this phone alone. A backup file is the only way to move
        your notes to a new device or recover them if this one is lost.
      </div>
      <button className="sn-btn sn-btn-accent sn-btn-full" onClick={() => doExport(false)}>
        Export {notes.length + devotions.length} entries
      </button>
      <button className="sn-btn sn-btn-ghost sn-btn-full" style={{ marginTop: 8 }}
        onClick={() => doExport(true)} disabled={photoCount === 0}>
        Export with {photoCount} photo{photoCount === 1 ? "" : "s"} (~{photoMB} MB)
      </button>
      <div className="sn-note" style={{ marginTop: 7 }}>
        Save it to iCloud, Drive, or email it to yourself. Monthly is plenty. The
        text-only file is small and quick; include photos before switching phones.
      </div>

      <div className="sn-secttl">Restore</div>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
      <button className="sn-btn sn-btn-ghost sn-btn-full" onClick={() => fileRef.current?.click()}>
        Choose a backup file
      </button>

      {pending && (
        <div className="sn-confirm">
          <div className="sn-confirm-hd">
            That file holds {pending.notes?.length || 0} sermon
            {(pending.notes?.length || 0) === 1 ? "" : "s"} and{" "}
            {pending.devotions?.length || 0} devotion
            {(pending.devotions?.length || 0) === 1 ? "" : "s"}.
          </div>
          <div className="sn-note" style={{ marginBottom: 10 }}>
            Merge keeps what's already here and adds anything missing. Replace wipes
            this phone's notes first — there's no undo.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="sn-btn sn-btn-ghost sn-btn-sm" style={{ flex: 1 }}
              onClick={() => setPending(null)}>Cancel</button>
            <button className="sn-btn sn-btn-danger sn-btn-sm" style={{ flex: 1 }}
              onClick={() => apply("replace")}>Replace</button>
            <button className="sn-btn sn-btn-accent sn-btn-sm" style={{ flex: 1 }}
              onClick={() => apply("merge")}>Merge</button>
          </div>
        </div>
      )}

      <div className="sn-secttl">ESV text (optional)</div>
      <div className="sn-note" style={{ marginBottom: 12 }}>
        With your own free key from api.esv.org, passage text appears under any
        reference. Without one the app works exactly as it does now — references
        and your own summaries.
      </div>

      <div className="sn-field">
        <label className="sn-label">Access key</label>
        <input className="sn-input sn-mono" type="password" placeholder="Token from api.esv.org"
          value={esv.apiKey} onChange={(e) => setEsvLocal({ ...esv, apiKey: e.target.value })} />
        <div className="sn-note warn">
          A key in the app is readable by anyone who inspects the page, and Crossway
          forbids sharing it. Fine on your own phone; use a proxy if you ever share this.
        </div>
      </div>

      <div className="sn-field">
        <label className="sn-label">Proxy URL (optional)</label>
        <input className="sn-input sn-mono" placeholder="https://your-server.com/bible"
          value={esv.proxyUrl} onChange={(e) => setEsvLocal({ ...esv, proxyUrl: e.target.value })} />
      </div>

      <label className="sn-check">
        <input type="checkbox" checked={esv.autoFetch}
          onChange={(e) => setEsvLocal({ ...esv, autoFetch: e.target.checked })} />
        Load text automatically when a reference is shown
      </label>

      <div className="sn-sublbl" style={{ marginTop: 16 }}>Reading view</div>
      <label className="sn-check">
        <input type="checkbox" checked={esv.verseNumbers}
          onChange={(e) => setEsvLocal({ ...esv, verseNumbers: e.target.checked })} />
        Verse numbers
      </label>
      <label className="sn-check">
        <input type="checkbox" checked={esv.headings}
          onChange={(e) => setEsvLocal({ ...esv, headings: e.target.checked })} />
        Section headings and psalm titles
      </label>
      <label className="sn-check">
        <input type="checkbox" checked={esv.footnotes}
          onChange={(e) => setEsvLocal({ ...esv, footnotes: e.target.checked })} />
        Footnotes
      </label>
      <div className="sn-note">
        These apply to the reading page only. The daily proverb always shows without
        a verse number, and inline snippets stay plain.
      </div>

      <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
        <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }} disabled={esvTesting}
          onClick={async () => {
            setEsvTesting(true); setEsvResult(null);
            try {
              const r = await getScripture("John 11:35", esv);
              setEsvResult({ ok: true, text: r.text.slice(0, 90) });
            } catch (err) { setEsvResult({ ok: false, text: err.message }); }
            setEsvTesting(false);
          }}>
          {esvTesting ? "Testing…" : "Test key"}
        </button>
        <button className="sn-btn sn-btn-accent" style={{ flex: 1 }}
          onClick={async () => { await onSaveEsv(esv); onFlash("ESV settings saved"); }}>
          Save
        </button>
      </div>

      {esvResult && (
        <div className={"sn-testres " + (esvResult.ok ? "ok" : "bad")} style={{ marginTop: 10 }}>
          {esvResult.ok ? `Working — returned: ${esvResult.text}` : esvResult.text}
        </div>
      )}

      <div className="sn-statrow" style={{ marginTop: 10 }}>
        <span>Passage cache</span>
        <span className="sn-pill">{esvCached} / {ESV_VERSE_CAP} verses</span>
      </div>
      <div className="sn-note" style={{ marginBottom: 4 }}>
        Crossway caps local storage at 500 verses, so the oldest passages drop off
        automatically. Changing the options above stores a fresh copy in the new
        format, so clearing the cache after a change keeps it tidy.
        {esvCached > 0 && (
          <> <button className="sn-loadtext" onClick={async () => {
            await esvCacheClear(); setEsvCached(0); onFlash("Passage cache cleared");
          }}>Clear now</button></>
        )}
      </div>

      <div className="sn-secttl">Storage</div>
      <div className="sn-statrow">
        <span>Protected from cleanup</span>
        <span className={"sn-pill " + (persist.persisted ? "good" : "warn")}>
          {persist.persisted ? "Yes" : persist.supported ? "Not granted" : "Unavailable"}
        </span>
      </div>
      {!persist.persisted && (
        <div className="sn-note" style={{ marginBottom: 10 }}>
          {persist.supported
            ? "Your browser hasn't marked this data as persistent. Installing the app to your home screen usually earns it. Keep exporting either way."
            : "This browser can't guarantee persistence. Export regularly."}
        </div>
      )}
      {est && (
        <>
          <div className="sn-statrow">
            <span>Used</span>
            <span className="sn-pill">{kb} KB</span>
          </div>
          {pct !== null && (
            <div className="sn-meter"><div className="sn-meter-fill" style={{ width: Math.max(1, pct) + "%" }} /></div>
          )}
        </>
      )}
      <div className="sn-note" style={{ marginTop: 8 }}>
        {notes.length} sermon{notes.length === 1 ? "" : "s"} · {devotions.length} devotion
        {devotions.length === 1 ? "" : "s"} · {Object.keys(topics).length} tagged reference
        {Object.keys(topics).length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/* ===============================================================
   APP
   =============================================================== */
function App() {
  const [notes, setNotes] = useState([]);
  const [devotions, setDevotions] = useState([]);
  const [topics, setTopics] = useState({});
  const [plan, setPlan] = useState(null);
  const [scripture, setScripture] = useState(defaultScripture());
  const [highlights, setHighlights] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [seed, setSeed] = useState(null);        // prefill for a new devotion
  const [jumpTo, setJumpTo] = useState(null);    // topic or ref to open in Verses
  const [reading, setReading] = useState(null);  // { chapters, label } in the reader
  const [viewing, setViewing] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadScripture().then(setScripture);
    loadHighlights().then(setHighlights);
    Promise.all([loadNotes(), loadDevotions(), loadTopics(), loadPlan()]).then(([n, d, t, p]) => {
      setNotes(n); setDevotions(d); setTopics(t); setPlan(p);
      setLoading(false);
    });
    requestPersistence();
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1700); };

  const setTopicsFor = async (ref, list) => {
    const next = { ...topics };
    if (list.length === 0) delete next[ref];
    else next[ref] = list;
    setTopics(next);
    await saveTopics(next);
  };
  const topicsValue = useMemo(() => ({ topics, setTopicsFor }), [topics]);

  const saveEsv = async (cfg) => { setScripture(cfg); await saveScripture(cfg); };

  const toggleHighlight = async (ref) => {
    const next = { ...highlights };
    if (next[ref]) delete next[ref]; else next[ref] = true;
    setHighlights(next);
    await saveHighlights(next);
  };
  const highlightsValue = useMemo(() => ({ highlights, toggleHighlight }), [highlights]);

  const entries = useMemo(
    () => [...notes.map((n) => ({ ...n, kind: "sermon" })), ...devotions],
    [notes, devotions]
  );
  const verseCount = useMemo(
    () => new Set(entries.flatMap((e) => allVerses(e).map((v) => v.ref))).size,
    [entries]
  );

  const persistNotes = async (next) => {
    setNotes(next);
    if (!(await saveNotes(next))) flash("Couldn't save — try again");
  };
  const persistDevotions = async (next) => {
    setDevotions(next);
    if (!(await saveDevotions(next))) flash("Couldn't save — try again");
  };

  /* ---- reading plan ---- */
  const choosePlan = async (cfg) => {
    const next = {
      ...cfg,
      startDate: plan?.startDate || new Date().toISOString().slice(0, 10),
      coverage: plan?.coverage || {},     // reading already logged is never lost
      log: plan?.log || [],
    };
    setPlan(next); await savePlan(next);
    flash(plan ? "Plan updated" : "Plan started");
  };

  /* One entry point for everything that counts as reading */
  const logReading = async (ref, quiet) => {
    const base = plan || {
      scopeId: "all", paced: false, targetDays: null,
      startDate: new Date().toISOString().slice(0, 10), coverage: {}, log: [],
    };
    const coverage = addToCoverage(base.coverage || {}, ref);
    const next = {
      ...base,
      coverage,
      log: [...(base.log || []), { ref, on: new Date().toISOString().slice(0, 10) }].slice(-200),
    };
    setPlan(next); await savePlan(next);
    if (!quiet) flash(`${ref} marked read`);
  };

  /* Reading a chapter counts even if no plan is running — the coverage
     record is the app's memory of what you've read, plan or not. */
  const markChapters = async (chapters) => {
    let base = plan || {
      scopeId: "all", paced: false, targetDays: null,
      startDate: new Date().toISOString().slice(0, 10), coverage: {}, log: [],
    };
    let coverage = base.coverage || {};
    const log = [...(base.log || [])];
    const on = new Date().toISOString().slice(0, 10);
    chapters.forEach((c) => {
      const ref = `${c.book} ${c.ch}`;
      coverage = addToCoverage(coverage, ref);
      log.push({ ref, on });
    });
    const next = { ...base, coverage, log: log.slice(-200) };
    setPlan(next); await savePlan(next);
    flash(chapters.length === 1
      ? `${chapters[0].book} ${chapters[0].ch} marked read`
      : `${chapters.length} chapters marked read`);
  };

  const openReader = (chapters) => {
    setReading({ chapters, label: labelChapters(chapters) });
    setViewing(null);
    setTab("read");
  };

  const devotionFromDay = (chapters) => {
    setSeed({
      title: labelChapters(chapters),
      passage: chapters.map((c) => ({ ref: `${c.book} ${c.ch}`, gist: "" })),
      readRefs: chapters.map((c) => `${c.book} ${c.ch}`),
    });
    setEditing(null);
    setTab("devotion");
  };

  const handleSaveNote = async (note) => {
    const exists = notes.some((n) => n.id === note.id);
    await persistNotes(exists ? notes.map((n) => (n.id === note.id ? note : n)) : [note, ...notes]);
    setEditing(null); setViewing(null); setTab("library");
    flash(exists ? "Sermon updated" : "Sermon saved");
  };
  const handleSaveDevotion = async (d) => {
    const item = { ...d, kind: "devotion" };
    const exists = devotions.some((x) => x.id === item.id);
    await persistDevotions(exists ? devotions.map((x) => (x.id === item.id ? item : x)) : [item, ...devotions]);
    /* Writing on a passage counts as having read it */
    if (plan) {
      for (const v of normVerses(item.passage || [])) await logReading(v.ref, true);
    }
    setEditing(null); setSeed(null); setViewing(null); setTab("library");
    flash(exists ? "Devotion updated" : "Devotion saved");
  };
  const handleDelete = async (id, kind) => {
    const source = kind === "devotion" ? devotions : notes;
    const doomed = source.find((x) => x.id === id);
    for (const p of doomed?.photos || []) { try { await photoStore.del(p.id); } catch {} }
    if (kind === "devotion") await persistDevotions(devotions.filter((x) => x.id !== id));
    else await persistNotes(notes.filter((n) => n.id !== id));
    setViewing(null);
    flash("Deleted");
  };

  const openForEdit = (item) => {
    setEditing(item); setViewing(null); setSeed(null);
    setTab(item.kind === "devotion" ? "devotion" : "sermon");
  };

  const handleImport = async (data, mode) => {
    if (data.photoBlobs) {
      for (const [id, dataUrl] of Object.entries(data.photoBlobs)) {
        try { await photoStore.put(id, dataUrl); } catch {}
      }
    }
    const inNotes = (data.notes || []).map((n) => ({ ...n, kind: "sermon" }));
    const inDevs = (data.devotions || []).map((d) => ({ ...d, kind: "devotion" }));
    const inTopics = data.topics || {};

    if (mode === "replace") {
      await persistNotes(inNotes); await persistDevotions(inDevs);
      setTopics(inTopics); await saveTopics(inTopics);
      if (data.plan) { setPlan(data.plan); await savePlan(data.plan); }
      flash(`Replaced with ${inNotes.length + inDevs.length} entries`);
      return;
    }
    const mergeById = (mine, theirs) => {
      const ids = new Set(mine.map((x) => x.id));
      return [...mine, ...theirs.filter((x) => !ids.has(x.id))];
    };
    const nextNotes = mergeById(notes, inNotes);
    const nextDevs = mergeById(devotions, inDevs);
    const nextTopics = { ...topics };
    Object.entries(inTopics).forEach(([ref, list]) => {
      nextTopics[ref] = [...new Set([...(nextTopics[ref] || []), ...list])];
    });
    await persistNotes(nextNotes); await persistDevotions(nextDevs);
    setTopics(nextTopics); await saveTopics(nextTopics);
    const added = (nextNotes.length - notes.length) + (nextDevs.length - devotions.length);
    flash(added ? `Added ${added} new entries` : "Already up to date");
  };

  const openInVerses = (topic, ref) => {
    setJumpTo({ topic: topic || null, ref: ref || null });
    setViewing(null);
    setTab("verses");
  };

  const go = (id) => {
    setDrawer(false);
    setViewing(null);
    if (id !== "verses") setJumpTo(null);
    if (id === "sermon" || id === "devotion") { setEditing(null); setSeed(null); }
    setTab(id);
  };

  if (loading) {
    return <div className="sn-root"><GlobalStyle />
      <div className="sn-empty" style={{ paddingTop: 90 }}>Loading your notes…</div></div>;
  }

  const titles = {
    home: "John's Notes",
    sermon: editing ? "Edit sermon" : "New sermon",
    devotion: editing ? "Edit devotion" : "New devotion",
    library: viewing ? (viewing.kind === "devotion" ? "Devotion" : "Sermon") : "Library",
    read: reading?.label || "Reading",
    bible: "Bible",
    verses: "Verses",
    data: "Backup & storage",
    about: "Copyright & about",
  };

  return (
    <TopicsContext.Provider value={topicsValue}>
    <ScriptureContext.Provider value={scripture}>
    <HighlightsContext.Provider value={highlightsValue}>
    <div className="sn-root">
      <GlobalStyle />

      <div className="sn-header">
        <div className="sn-header-row">
          <button className="sn-burger" onClick={() => setDrawer(true)} title="Menu">
            <span /><span /><span />
          </button>
          <h1 className={"sn-serif" + (tab === "home" ? " sn-brand" : "")}>{titles[tab]}</h1>
          <span className="sn-header-sp" />
        </div>
      </div>

      <Drawer open={drawer} tab={tab} onClose={() => setDrawer(false)} onGo={go}
        counts={{ entries: entries.length, verses: verseCount }} />

      {tab === "home" && (
        <Home entries={entries} plan={plan} topics={topics} onAbout={() => go("about")}
          onRead={openReader} onMarkChapters={markChapters}
          onSetPlan={choosePlan} onLogReading={logReading}
          onDevotionFrom={devotionFromDay}
          onOpen={(e) => { setViewing(e); setTab("library"); }}
          onOpenTopic={openInVerses}
          onAllTopics={() => openInVerses(null, null)} />
      )}

      {tab === "sermon" && (
        <NoteForm key={editing ? editing.id : "blank-sermon"}
          initial={editing && editing.kind !== "devotion" ? editing : null}
          onSave={handleSaveNote}
          onCancel={() => { setEditing(null); setTab(editing ? "library" : "home"); }} />
      )}

      {tab === "devotion" && (
        <DevotionForm key={editing ? editing.id : (seed ? "seed-" + seed.planDay : "blank-devotion")}
          initial={editing && editing.kind === "devotion" ? editing : null}
          seed={seed}
          onSave={handleSaveDevotion}
          onCancel={() => { setEditing(null); setSeed(null); setTab(editing ? "library" : "home"); }} />
      )}

      {tab === "library" && !viewing && <Library entries={entries} onOpen={setViewing} />}
      {tab === "library" && viewing && (
        viewing.kind === "devotion"
          ? <DevotionDetail item={viewing} onBack={() => setViewing(null)}
              onEdit={openForEdit} onDelete={(id) => handleDelete(id, "devotion")} />
          : <NoteDetail note={viewing} onBack={() => setViewing(null)}
              onEdit={openForEdit} onDelete={(id) => handleDelete(id, "sermon")} />
      )}

      {tab === "verses" && (
        <VerseSearch entries={entries} jumpTo={jumpTo}
          key={jumpTo ? (jumpTo.topic || jumpTo.ref || "all") : "verses"}
          onOpen={(e) => { setViewing(e); setTab("library"); }} />
      )}

      {tab === "read" && reading && (
        <Reader target={reading} coverage={plan?.coverage || {}}
          onMarkRead={async (ch) => { await markChapters(ch); setTab("home"); }}
          onDevotion={(ch) => { devotionFromDay(ch); }}
          onBack={() => setTab("home")} />
      )}

      {tab === "bible" && (
        <BibleTab coverage={plan?.coverage || {}} onMarkChapters={markChapters}
          onDevotion={devotionFromDay} />
      )}

      {tab === "about" && <About scripture={scripture} />}

      {tab === "data" && (
        <DataPanel notes={notes} devotions={devotions} topics={topics} plan={plan}
          scripture={scripture} onSaveEsv={saveEsv}
          onImport={handleImport} onFlash={flash} />
      )}

      {toast && <div className="sn-toast">{toast}</div>}
    </div>
    </HighlightsContext.Provider>
    </ScriptureContext.Provider>
    </TopicsContext.Provider>
  );
}

/* --------------------------------------------------------------- */
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
