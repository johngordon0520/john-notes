/* ===============================================================
   John's Notes — offline sermon & devotion notebook
   Runs entirely on-device. No network calls, no accounts, no keys.
   Text lives in localStorage; photos live in IndexedDB.
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
      @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      html, body { margin: 0; padding: 0; }

      .sn-root {
        /* Ink & ground */
        --ink:#232746; --ink-soft:#69719A; --sky:#E7EFFA; --card:#FCFDFF; --line:#D2DEF0;
        /* Iris — the primary accent (structure, labels, confirm) */
        --iris:#6D4FB0; --iris-deep:#513C88; --iris-tint:#E9E1F8;
        /* Plum — the secondary accent (scripture) */
        --plum:#8A4FA8; --plum-tint:#F1E6F8;
        font-family:'Figtree',sans-serif; background:var(--sky); color:var(--ink);
        min-height:100vh; max-width:480px; margin:0 auto; position:relative; padding-bottom:86px;
        -webkit-font-smoothing:antialiased;
      }
      .sn-serif { font-family:'Newsreader',Georgia,serif; letter-spacing:-.005em; }
      .sn-mono { font-family:'IBM Plex Mono',monospace; letter-spacing:.01em; }
      .sn-scroll { padding:18px 16px 10px; }

      .sn-header { padding:22px 16px 14px; border-bottom:1px solid var(--line);
        background:linear-gradient(180deg,#F3F7FE 0%,var(--sky) 100%); }
      .sn-header h1 { margin:0; font-size:24px; font-weight:500; letter-spacing:-.015em;
        font-variation-settings:'opsz' 40; }
      .sn-brand { color:var(--iris-deep); }
      .sn-header p { margin:4px 0 0; font-size:12.5px; color:var(--ink-soft); letter-spacing:.005em; }
      .sn-screen-name { color:var(--plum); font-weight:600; }
      .sn-screen-sep { color:var(--line); margin:0 5px; }

      .sn-btn { font-family:'Figtree',sans-serif; font-weight:600; font-size:14px; border-radius:9px;
        border:none; padding:11px 15px; cursor:pointer; transition:transform .12s, opacity .12s; }
      .sn-btn:active { transform:scale(.97); }
      .sn-btn:disabled { opacity:.42; }
      .sn-btn-primary { background:var(--ink); color:var(--card); }
      .sn-btn-iris { background:var(--iris); color:#fff; }
      .sn-btn-ghost { background:transparent; color:var(--ink-soft); border:1px solid var(--line); }
      .sn-btn-danger { background:var(--plum-tint); color:var(--plum); }
      .sn-btn-full { width:100%; }
      .sn-btn-sm { padding:7px 10px; font-size:12.5px; border-radius:7px; }

      .sn-field { margin-bottom:15px; }
      .sn-label { display:block; font-size:10.5px; font-weight:700; text-transform:uppercase;
        letter-spacing:.1em; color:var(--iris-deep); margin-bottom:6px; }
      .sn-input, .sn-textarea { width:100%; font-family:'Figtree',sans-serif; font-size:15px; color:var(--ink);
        background:var(--card); border:1px solid var(--line); border-radius:9px; padding:11px 12px; outline:none; }
      .sn-input:focus, .sn-textarea:focus { border-color:var(--iris); }
      .sn-textarea { resize:vertical; min-height:60px; line-height:1.45; }
      .sn-input::placeholder,.sn-textarea::placeholder { color:#A3AFC4; }
      .sn-input-date {
        -webkit-appearance:none; appearance:none;
        font-family:'IBM Plex Mono',monospace; font-size:13px; padding:11px 9px;
        min-width:0; width:100%; max-width:100%; display:block; box-sizing:border-box;
        overflow:hidden; text-overflow:clip;
      }
      .sn-input-date::-webkit-date-and-time-value { text-align:left; margin:0; min-width:0; padding:0; }
      .sn-input-date::-webkit-calendar-picker-indicator { padding:0; margin:0; opacity:.5;
        width:13px; height:13px; flex-shrink:0; }
      .sn-input-date::-webkit-datetime-edit { padding:0; min-width:0; }
      .sn-input-date::-webkit-datetime-edit-fields-wrapper { padding:0; }
      .sn-input-date::-webkit-inner-spin-button,
      .sn-input-date::-webkit-clear-button { display:none; -webkit-appearance:none; }

      .sn-chip-row { display:flex; flex-wrap:wrap; gap:6px; }
      .sn-chip { display:inline-flex; align-items:center; gap:6px; background:var(--plum-tint);
        color:var(--plum); border-radius:100px; padding:5px 6px 5px 11px; font-size:12.5px; font-weight:500; }
      .sn-chip .sn-mono { font-size:11.5px; }
      .sn-chip button { background:var(--plum); color:#fff; border:none; border-radius:50%; width:16px;
        height:16px; font-size:10px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      .sn-addverse { background:var(--plum-tint); color:var(--plum); border:1px dashed var(--plum);
        border-radius:100px; padding:5px 12px; font-size:12.5px; font-weight:600; cursor:pointer;
        font-family:'Figtree',sans-serif; }
      .sn-addverse.quiet { background:transparent; border-color:#C6D2E6; color:var(--ink-soft);
        font-weight:500; padding:4px 11px; font-size:12px; }

      /* Sermon point block */
      .sn-point { background:var(--card); border:1px solid var(--line); border-radius:12px;
        padding:16px 13px 13px; margin-bottom:12px; position:relative; }
      .sn-point-num { position:absolute; top:-10px; left:12px; background:var(--ink); color:var(--sky);
        font-size:11px; font-weight:700; width:21px; height:21px; border-radius:50%;
        display:flex; align-items:center; justify-content:center; }
      .sn-point-x { position:absolute; top:9px; right:10px; background:none; border:none;
        color:var(--ink-soft); font-size:12px; font-weight:600; cursor:pointer; }
      .sn-point-head { width:100%; font-family:'Newsreader',Georgia,serif; font-size:18px; font-weight:500;
        border:none; border-bottom:1.5px solid var(--iris-tint); background:transparent;
        padding:2px 0 6px; outline:none; color:var(--ink); margin-bottom:10px; }
      .sn-point-head:focus { border-bottom-color:var(--iris); }
      .sn-point-head::placeholder { color:#A9B4C8; font-style:italic; }

      @media (prefers-reduced-motion: reduce) {
        .sn-row textarea { transition:none; }
      }

      /* Tiered list rows */
      .sn-row { display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; }
      .sn-marker { font-size:13px; color:var(--iris-deep); font-weight:600; padding-top:13px;
        min-width:20px; text-align:right; flex-shrink:0; }
      .sn-row textarea { flex:1; font-family:'Figtree',sans-serif; font-size:14.5px; line-height:1.55;
        border:1px solid var(--line); border-radius:9px; background:#F4F8FE; padding:9px 12px;
        outline:none; resize:none; overflow:hidden; color:var(--ink); min-height:40px;
        transition:height .16s ease, padding .16s ease, border-color .12s, background .12s,
          box-shadow .12s; }
      .sn-row textarea.open { padding:11px 12px; }
      .sn-row textarea:focus { border-color:var(--iris); background:#fff;
        box-shadow:0 0 0 3px rgba(109,79,176,.1); }
      .sn-row textarea::placeholder { color:#A9B4C8; }
      .sn-rowtools { display:flex; gap:3px; padding-top:10px; flex-shrink:0; }
      .sn-rowtools button { width:24px; height:24px; border-radius:6px; border:1px solid var(--line);
        background:var(--card); color:var(--ink-soft); font-size:12px; cursor:pointer;
        display:flex; align-items:center; justify-content:center; padding:0; }
      .sn-rowtools button:disabled { opacity:.3; }

      .sn-styleseg { display:flex; gap:4px; margin:2px 0 10px; }
      .sn-styleseg button { flex:1; font-size:11px; font-weight:600; padding:6px 0; border-radius:7px;
        border:1px solid var(--line); background:var(--card); color:var(--ink-soft); cursor:pointer; }
      .sn-styleseg button.on { background:var(--iris-tint); border-color:var(--iris); color:var(--iris-deep); }

      /* Nav */
      .sn-nav { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:480px;
        background:var(--card); border-top:1px solid var(--line); display:flex;
        padding:7px 10px calc(7px + env(safe-area-inset-bottom)); box-shadow:0 -6px 20px rgba(81,60,136,.08); z-index:20; }
      .sn-nav-btn { flex:1; background:none; border:none; cursor:pointer; display:flex; flex-direction:column;
        align-items:center; gap:3px; padding:6px 0; border-radius:10px; color:var(--ink-soft);
        font-family:'Figtree',sans-serif; font-size:11px; font-weight:600; }
      .sn-nav-btn.on { color:var(--iris-deep); background:var(--iris-tint); }
      .sn-nav-ico { font-size:17px; line-height:1; }

      /* Cards */
      .sn-card { background:var(--card); border:1px solid var(--line); border-radius:13px;
        padding:15px 15px 13px; margin-bottom:11px; position:relative; cursor:pointer; }
      .sn-ribbon { position:absolute; top:-1px; right:17px; width:15px; height:25px; background:var(--iris);
        clip-path:polygon(0 0,100% 0,100% 100%,50% 78%,0 100%); }
      .sn-card h3 { margin:0 0 4px; font-size:18px; font-weight:500; padding-right:26px;
        font-family:'Newsreader',Georgia,serif; letter-spacing:-.01em; }
      .sn-card .meta { font-size:12px; color:var(--ink-soft); margin-bottom:7px; }
      .sn-card .snip { font-size:13px; opacity:.8; line-height:1.4; }

      .sn-empty { text-align:center; padding:48px 20px; color:var(--ink-soft); font-size:14px; }
      .sn-empty .ico { font-size:28px; margin-bottom:9px; }
      .sn-secttl { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em;
        color:var(--iris-deep); margin:20px 0 9px; }

      .sn-dtl { margin-bottom:17px; }
      .sn-dtl-lbl { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.07em;
        color:var(--iris-deep); margin-bottom:5px; }
      .sn-dtl-txt { font-size:15px; line-height:1.65; white-space:pre-wrap; }
      .sn-back { background:none; border:none; color:var(--ink-soft); font-size:14px; font-weight:600;
        cursor:pointer; padding:2px 0 12px; }

      .sn-toast { position:fixed; bottom:96px; left:50%; transform:translateX(-50%); background:var(--ink);
        color:var(--sky); font-size:13px; font-weight:500; padding:9px 16px; border-radius:100px; z-index:60; }

      /* Picker modal */
      .sn-overlay { position:fixed; inset:0; background:rgba(35,39,70,.42); z-index:100;
        display:flex; align-items:flex-end; justify-content:center; }
      .sn-sheet { background:var(--sky); width:100%; max-width:480px; border-radius:18px 18px 0 0;
        max-height:88vh; display:flex; flex-direction:column; overflow:hidden; }
      .sn-sheet-hd { padding:14px 16px 10px; border-bottom:1px solid var(--line); display:flex;
        align-items:center; justify-content:space-between; background:var(--card); }
      .sn-sheet-hd h3 { margin:0; font-size:16px; font-weight:600; font-family:'Newsreader',Georgia,serif; }
      .sn-crumb { font-size:12px; color:var(--ink-soft); margin-top:2px; }
      .sn-sheet-body { overflow-y:auto; padding:12px 14px 20px; -webkit-overflow-scrolling:touch; }
      .sn-x { background:none; border:none; font-size:20px; color:var(--ink-soft); cursor:pointer; line-height:1; }

      .sn-tseg { display:flex; gap:6px; margin-bottom:12px; }
      .sn-tseg button { flex:1; padding:8px 0; font-size:12.5px; font-weight:600; border-radius:8px;
        border:1px solid var(--line); background:var(--card); color:var(--ink-soft); cursor:pointer; }
      .sn-tseg button.on { background:var(--ink); border-color:var(--ink); color:var(--sky); }

      .sn-booklist { display:flex; flex-direction:column; }
      .sn-bookrow { display:flex; align-items:center; gap:10px; padding:11px 10px; border-radius:9px;
        cursor:pointer; border-bottom:1px solid var(--line); }
      .sn-bookrow:active { background:var(--iris-tint); }
      .sn-bookrow .nm { font-size:14.5px; font-weight:500; }
      .sn-bookrow .ct { margin-left:auto; font-size:11px; color:var(--ink-soft); }

      .sn-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; }
      .sn-grid.verses { grid-template-columns:repeat(6,1fr); }
      .sn-cell { aspect-ratio:1; border-radius:9px; border:1px solid var(--line); background:var(--card);
        font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:600; color:var(--ink);
        display:flex; align-items:center; justify-content:center; cursor:pointer; }
      .sn-cell:active { background:var(--iris-tint); }
      .sn-cell.sel { background:var(--iris); border-color:var(--iris); color:#fff; }
      .sn-cell.inrange { background:var(--iris-tint); border-color:var(--iris); color:var(--iris-deep); }

      .sn-sheet-ft { padding:11px 14px calc(11px + env(safe-area-inset-bottom)); border-top:1px solid var(--line);
        background:var(--card); display:flex; gap:9px; align-items:center; }
      .sn-hint { font-size:12px; color:var(--ink-soft); flex:1; }

      .sn-chip.has-gist { border:1px solid var(--plum); }
      .sn-dot { width:5px; height:5px; border-radius:50%; background:var(--plum); flex-shrink:0; }
      .sn-gistbox { background:#F4F8FE; border-left:3px solid var(--plum); border-radius:0 9px 9px 0;
        padding:9px 11px; margin-top:8px; }
      .sn-gist-ref { font-size:11.5px; color:var(--plum); font-weight:600; margin-bottom:6px; }
      .sn-gist-read { font-size:15px; line-height:1.65; font-family:'Newsreader',Georgia,serif;
        margin-bottom:5px; color:var(--ink); }
      .sn-loadtext { background:none; border:none; color:var(--ink-soft); font-size:11.5px; font-weight:600;
        cursor:pointer; padding:4px 0 0; font-family:'Figtree',sans-serif; }

      /* Topics */
      .sn-topicbox { margin-top:10px; }
      .sn-topic-lbl { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em;
        color:var(--iris-deep); margin-bottom:6px; }
      .sn-topic { display:inline-flex; align-items:center; gap:5px; background:var(--iris-tint);
        color:var(--iris-deep); border:none; border-radius:100px; padding:5px 6px 5px 11px;
        font-size:12.5px; font-weight:600; font-family:'Figtree',sans-serif; }
      .sn-topic button { background:var(--iris); color:#fff; border:none; border-radius:50%;
        width:15px; height:15px; font-size:9px; line-height:1; cursor:pointer;
        display:flex; align-items:center; justify-content:center; }
      .sn-topic.ghost { background:transparent; border:1px dashed var(--iris); color:var(--iris);
        padding:5px 11px; cursor:pointer; font-weight:500; }
      .sn-topic-input { font-size:14px; padding:9px 11px; margin-top:8px; }

      .sn-topic-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:9px; }
      .sn-topic-card { display:flex; align-items:center; justify-content:space-between; gap:8px;
        background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 13px;
        cursor:pointer; font-family:'Figtree',sans-serif; text-align:left; }
      .sn-topic-card .name { font-size:14.5px; font-weight:600; color:var(--ink);
        text-transform:capitalize; overflow:hidden; text-overflow:ellipsis; }
      .sn-topic-card .count { background:var(--iris-tint); color:var(--iris-deep); font-weight:700;
        font-size:11.5px; border-radius:100px; padding:2px 8px; flex-shrink:0; }

      .sn-topic-hd { display:flex; align-items:center; justify-content:space-between; gap:10px;
        margin-bottom:13px; }
      .sn-topic-title { font-family:'Newsreader',Georgia,serif; font-size:21px; font-weight:500;
        text-transform:capitalize; color:var(--iris-deep); }

      /* Devotions, library kinds, data panel */
      .sn-header-row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .sn-datahtn { background:none; border:1px solid transparent; border-radius:8px; font-size:19px;
        line-height:1; color:var(--ink-soft); cursor:pointer; padding:4px 10px; letter-spacing:.06em; }
      .sn-datahtn.on { background:var(--iris-tint); border-color:var(--iris); color:var(--iris-deep); }

      .sn-kind { display:inline-block; font-size:9.5px; font-weight:700; text-transform:uppercase;
        letter-spacing:.11em; border-radius:100px; padding:3px 8px; margin-bottom:6px; }
      .sn-kind-sermon { background:var(--iris-tint); color:var(--iris-deep); }
      .sn-kind-devotion { background:var(--plum-tint); color:var(--plum); }
      .sn-card.devotion .sn-ribbon { background:var(--plum); }

      .sn-topic.ghost.on { background:var(--plum-tint); border-style:solid; border-color:var(--plum);
        color:var(--plum); font-weight:600; }

      .sn-srcrow { display:flex; align-items:center; gap:7px; font-size:12.5px; color:var(--ink-soft);
        padding:4px 0; cursor:pointer; }
      .sn-dotkind { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
      .sn-dotkind.ser { background:var(--iris); }
      .sn-dotkind.dev { background:var(--plum); }
      .sn-srcdate { margin-left:auto; font-size:11px; opacity:.75; }

      .sn-confirm { background:var(--card); border:1px solid var(--iris); border-radius:12px;
        padding:13px; margin-top:11px; }
      .sn-confirm-hd { font-size:14px; font-weight:600; margin-bottom:6px; }
      .sn-statrow { display:flex; align-items:center; justify-content:space-between;
        background:var(--card); border:1px solid var(--line); border-radius:10px;
        padding:11px 13px; margin-bottom:8px; font-size:13.5px; }
      .sn-pill { font-size:11.5px; font-weight:700; border-radius:100px; padding:3px 9px;
        background:var(--iris-tint); color:var(--iris-deep); }
      .sn-pill.good { background:#DCEBDF; color:#33603D; }
      .sn-pill.warn { background:var(--plum-tint); color:var(--plum); }
      .sn-meter { height:6px; border-radius:100px; background:var(--line); overflow:hidden; margin-bottom:6px; }
      .sn-meter-fill { height:100%; background:var(--iris); border-radius:100px; }

      /* Photos */
      .sn-strip { display:flex; gap:8px; flex-wrap:wrap; }
      .sn-thumb { width:72px; height:72px; border-radius:10px; overflow:hidden; padding:0;
        border:1px solid var(--line); background:var(--card); cursor:pointer; flex-shrink:0;
        display:flex; align-items:center; justify-content:center; }
      .sn-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
      .sn-thumb-ph { color:var(--ink-soft); font-size:16px; }
      .sn-thumb.add { flex-direction:column; gap:3px; border-style:dashed; border-color:var(--iris);
        color:var(--iris-deep); font-family:'Figtree',sans-serif; }
      .sn-thumb.add .ico { font-size:18px; line-height:1; }
      .sn-thumb.add .lbl { font-size:10.5px; font-weight:600; }
      .sn-thumb.add:disabled { opacity:.55; }

      .sn-photo-sheet { background:var(--sky); width:100%; max-width:480px; border-radius:18px 18px 0 0;
        max-height:92vh; display:flex; flex-direction:column; overflow:hidden; }
      .sn-photo-body { flex:1; overflow:auto; padding:12px; display:flex; align-items:center;
        justify-content:center; background:#DCE6F5; }
      .sn-photo-body img { max-width:100%; max-height:64vh; border-radius:8px; display:block;
        box-shadow:0 6px 20px rgba(81,60,136,.18); }

      /* Devotion methods */
      .sn-methods { display:flex; gap:5px; flex-wrap:wrap; }
      .sn-method { flex:1 1 auto; min-width:56px; padding:9px 6px; font-size:12.5px; font-weight:700;
        letter-spacing:.02em; border-radius:9px; border:1px solid var(--line); background:var(--card);
        color:var(--ink-soft); cursor:pointer; font-family:'Figtree',sans-serif; }
      .sn-method.on { background:var(--plum); border-color:var(--plum); color:#fff; }
      .sn-stepno { display:inline-flex; align-items:center; justify-content:center;
        width:15px; height:15px; border-radius:50%; background:var(--plum); color:#fff;
        font-size:9px; font-weight:700; margin-right:6px; vertical-align:middle; letter-spacing:0; }
      .sn-textarea.serif { font-family:'Newsreader',Georgia,serif; font-size:15.5px; line-height:1.6; }

      .sn-freq { display:flex; align-items:center; justify-content:space-between; background:var(--card);
        border:1px solid var(--line); border-radius:10px; padding:11px 13px; margin-bottom:8px; cursor:pointer; }
      .sn-freq-ct { background:var(--iris-tint); color:var(--iris-deep); font-weight:700; font-size:11.5px;
        border-radius:100px; padding:2px 9px; }
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

  const commit = () => {
    if (!book || !chapter || !vStart) return;
    const ref = vEnd && vEnd !== vStart
      ? `${book.name} ${chapter}:${Math.min(vStart, vEnd)}-${Math.max(vStart, vEnd)}`
      : `${book.name} ${chapter}:${vStart}`;
    onPick(ref);
    onClose();
  };

  const pickVerse = (v) => {
    if (vStart === null || (vStart !== null && vEnd !== null)) {
      setVStart(v); setVEnd(null);
    } else if (v === vStart) {
      setVEnd(null);
    } else {
      setVEnd(v);
    }
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
                    onClick={() => { setChapter(i + 1); setVStart(null); setVEnd(null); setStage("verse"); }}>
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
              {vStart === null ? "Tap a verse. Tap a second for a range."
                : vEnd ? `${book.name} ${chapter}:${Math.min(vStart, vEnd)}-${Math.max(vStart, vEnd)}`
                : `${book.name} ${chapter}:${vStart} · tap another for a range`}
            </span>
            <button className="sn-btn sn-btn-iris sn-btn-sm" disabled={vStart === null} onClick={commit}>Add</button>
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

function VerseChips({ verses, onChange, label, readOnly, quiet }) {
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
        {!readOnly && (
          <button className={"sn-addverse" + (quiet && list.length === 0 ? " quiet" : "")}
            onClick={() => setOpen(true)}>+ {label || "Verse"}</button>
        )}
      </div>

      {/* Expanded summary for the tapped reference */}
      {editing !== null && list[editing] && (
        <div className="sn-gistbox">
          <div className="sn-gist-ref sn-mono">{list[editing].ref}</div>
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

function markerFor(style, level, ordinal) {
  if (style === "dash") return level === 0 ? "—" : level === 1 ? "–" : "·";
  if (style === "bullet") return level === 0 ? "•" : level === 1 ? "◦" : "▪";
  if (style === "number") {
    if (level === 0) return `${ordinal}.`;
    if (level === 1) return `${String.fromCharCode(96 + ((ordinal - 1) % 26) + 1)}.`;
    return `${ROMAN[(ordinal - 1) % 12]}.`;
  }
  if (style === "letter") {
    if (level === 0) return `${String.fromCharCode(64 + ((ordinal - 1) % 26) + 1)}.`;
    if (level === 1) return `${ordinal}.`;
    return `${ROMAN[(ordinal - 1) % 12]}.`;
  }
  return "•";
}

/* Compute the ordinal of each item within its own level+parent run */
function withOrdinals(items) {
  const counters = [0, 0, 0];
  return items.map((it) => {
    const lv = it.level;
    counters[lv] += 1;
    for (let k = lv + 1; k < 3; k++) counters[k] = 0;
    return { ...it, ordinal: counters[lv] };
  });
}

function AutoTextarea({ value, onChange, placeholder, onKeyDown }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);

  /* Idle rows hug their text; the focused row opens up to give room to write. */
  const FOCUSED_MIN = 92;
  const IDLE_MIN = 40;

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

function TieredList({ items, style, onItems, onStyle }) {
  const withOrd = withOrdinals(items);

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

  return (
    <>
      <div className="sn-styleseg">
        {LIST_STYLES.map((s) => (
          <button key={s.id} className={style === s.id ? "on" : ""} onClick={() => onStyle(s.id)}>{s.label}</button>
        ))}
      </div>

      {withOrd.map((it, idx) => (
        <div key={it.id}>
          <div style={{ paddingLeft: it.level * 18 + 28, marginBottom: 6 }}>
            <VerseChips verses={it.verses} onChange={(v) => update(it.id, { verses: v })}
              label="Verse" quiet />
          </div>
          <div className="sn-row" style={{ paddingLeft: it.level * 18 }}>
            <span className="sn-marker">{markerFor(style, it.level, it.ordinal)}</span>
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
        </div>
      ))}

      <button className="sn-btn sn-btn-ghost sn-btn-sm" style={{ marginTop: 4 }}
        onClick={() => addAfter(items.length - 1, 0)}>+ Line</button>
    </>
  );
}

/* ===============================================================
   NOTE FORM
   =============================================================== */
const newItem = (level = 0) => ({ id: uid(), text: "", level, verses: [] });
const newPoint = () => ({ id: uid(), header: "", verses: [], listStyle: "bullet", items: [newItem()] });

function emptyNote() {
  return {
    id: uid(), title: "", speaker: "", date: new Date().toISOString().slice(0, 10),
    series: "", mainPassage: [], bigIdea: "", points: [newPoint()],
    application: "", freeNotes: "", photos: [], createdAt: Date.now(),
  };
}

function NoteForm({ initial, onSave, onCancel }) {
  const [note, setNote] = useState(initial || emptyNote());
  const set = (k, v) => setNote((n) => ({ ...n, [k]: v }));
  const patchPoint = (id, patch) =>
    setNote((n) => ({ ...n, points: n.points.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  return (
    <div className="sn-scroll">
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
          <div className="sn-point-num">{i + 1}</div>
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
            items={p.items} style={p.listStyle}
            onItems={(items) => patchPoint(p.id, { items })}
            onStyle={(s) => patchPoint(p.id, { listStyle: s })}
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
        {onCancel && <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>}
        <button className="sn-btn sn-btn-iris" style={{ flex: 2 }} disabled={!note.title.trim()}
          onClick={() => onSave(note)}>{initial ? "Save changes" : "Save note"}</button>
      </div>
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
          <div className="sn-dtl-txt sn-serif" style={{ fontSize: 18, lineHeight: 1.55, fontWeight: 400 }}>{note.bigIdea}</div>
        </div>
      )}

      {note.points.some((p) => p.header || p.items.some((i) => i.text)) && (
        <div className="sn-dtl">
          <div className="sn-dtl-lbl">Points</div>
          {note.points.map((p, i) => {
            const items = withOrdinals(p.items).filter((it) => it.text.trim());
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
                      <span style={{ color: "var(--iris-deep)", fontWeight: 600, minWidth: 16 }}>
                        {markerFor(p.listStyle, it.level, it.ordinal)}
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

      <div className="sn-field">
        <input className="sn-input" placeholder="Search everything — verses, topics, words…"
          value={q} onChange={(e) => setQ(e.target.value)} />
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

function DevotionForm({ initial, onSave, onCancel }) {
  const [d, setD] = useState(initial ? migrateDevotion(initial) : emptyDevotion());
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
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
        {onCancel && <button className="sn-btn sn-btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>}
        <button className="sn-btn sn-btn-iris" style={{ flex: 2 }}
          disabled={!hasWriting && d.passage.length === 0}
          onClick={() => onSave(d)}>{initial ? "Save changes" : "Save devotion"}</button>
      </div>
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
            <div className={"sn-dtl-txt" + (step.serif ? " sn-serif" : "")}
              style={step.serif ? { fontSize: 16, lineHeight: 1.6 } : undefined}>
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

function VerseSearch({ entries, onOpen }) {
  const [mode, setMode] = useState("topic");   // topic | reference
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState(false);
  const [openTopic, setOpenTopic] = useState(null);
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
              <button className="sn-btn sn-btn-iris sn-btn-sm" onClick={() => setBrowse(true)}>+ Add verse</button>
            </div>
            {(topicIndex.find((t) => t.topic === openTopic)?.refs || []).map((ref) => {
              const e = byRef[ref] || { ref, gists: [], notes: [] };
              return <VerseRow key={ref} e={e} />;
            })}
            {browse && (
              <VersePicker onClose={() => setBrowse(false)}
                onPick={(ref) => {
                  const cur = topics[ref] || [];
                  if (!cur.includes(openTopic)) setTopicsFor(ref, [...cur, openTopic]);
                }} />
            )}
          </>
        ) : (
          <>
            <input className="sn-input" placeholder="Find a topic, e.g. patience"
              value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 14 }} />

            {shownTopics.length === 0 ? (
              <div className="sn-empty">
                <div className="ico">🏷</div>
                {topicIndex.length === 0
                  ? "No topics yet. Tap any verse in a note to tag it."
                  : "No topic matches that."}
              </div>
            ) : (
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

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input className="sn-input sn-mono" style={{ flex: 1, fontSize: 14, minWidth: 0 }}
          placeholder="Filter, e.g. Rom 8" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="sn-btn sn-btn-primary" onClick={() => setBrowse(true)}>Browse</button>
      </div>

      {browse && <VersePicker onClose={() => setBrowse(false)} onPick={(ref) => setQ(ref)} />}

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
    </div>
  );
}


/* ===============================================================
   DATA — export, import, storage health
   =============================================================== */
function exportFilename() {
  return `johns-notes-${new Date().toISOString().slice(0, 10)}.json`;
}

function DataPanel({ notes, devotions, topics, onImport, onFlash }) {
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
      notes, devotions, topics,
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
      <button className="sn-btn sn-btn-iris sn-btn-full" onClick={() => doExport(false)}>
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
            <button className="sn-btn sn-btn-iris sn-btn-sm" style={{ flex: 1 }}
              onClick={() => apply("merge")}>Merge</button>
          </div>
        </div>
      )}

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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("sermon");   // sermon | devotion | library | verses | data
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    Promise.all([loadNotes(), loadDevotions(), loadTopics()]).then(([n, d, t]) => {
      setNotes(n); setDevotions(d); setTopics(t); setLoading(false);
    });
    requestPersistence();   // ask once, early
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

  /* Sermons and devotions in one stream for the library and verse index */
  const entries = useMemo(
    () => [...notes.map((n) => ({ ...n, kind: "sermon" })), ...devotions],
    [notes, devotions]
  );

  const persistNotes = async (next) => {
    setNotes(next);
    if (!(await saveNotes(next))) flash("Couldn't save — try again");
  };
  const persistDevotions = async (next) => {
    setDevotions(next);
    if (!(await saveDevotions(next))) flash("Couldn't save — try again");
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
    setEditing(null); setViewing(null); setTab("library");
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
    setEditing(item);
    setViewing(null);
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
      await persistNotes(inNotes);
      await persistDevotions(inDevs);
      setTopics(inTopics); await saveTopics(inTopics);
      flash(`Replaced with ${inNotes.length + inDevs.length} entries`);
      return;
    }

    // Merge: existing entries win on id collision, topics union
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

    await persistNotes(nextNotes);
    await persistDevotions(nextDevs);
    setTopics(nextTopics); await saveTopics(nextTopics);
    const added = (nextNotes.length - notes.length) + (nextDevs.length - devotions.length);
    flash(added ? `Added ${added} new entries` : "Already up to date");
  };

  if (loading) {
    return <div className="sn-root"><GlobalStyle />
      <div className="sn-empty" style={{ paddingTop: 90 }}>Loading your notes…</div></div>;
  }

  const subtitle = {
    sermon: editing ? "Editing a sermon." : "Capture it while it's fresh.",
    devotion: editing ? "Editing a devotion." : "Sit with it and write.",
    library: "Everything you've kept, in one place.",
    verses: "Your verses, by topic.",
    data: "Backup, restore, and storage.",
  }[tab];

  return (
    <TopicsContext.Provider value={topicsValue}>
    <div className="sn-root">
      <GlobalStyle />
      <div className="sn-header">
        <div className="sn-header-row">
          <h1 className="sn-serif sn-brand">John's Notes</h1>
          <button className={"sn-datahtn" + (tab === "data" ? " on" : "")}
            title="Backup & storage"
            onClick={() => { setViewing(null); setTab(tab === "data" ? "library" : "data"); }}>⋯</button>
        </div>
        <p>{subtitle}</p>
      </div>

      {tab === "sermon" && (
        <NoteForm key={editing ? editing.id : "blank-sermon"}
          initial={editing && editing.kind !== "devotion" ? editing : null}
          onSave={handleSaveNote}
          onCancel={editing ? () => { setEditing(null); setTab("library"); } : null} />
      )}

      {tab === "devotion" && (
        <DevotionForm key={editing ? editing.id : "blank-devotion"}
          initial={editing && editing.kind === "devotion" ? editing : null}
          onSave={handleSaveDevotion}
          onCancel={editing ? () => { setEditing(null); setTab("library"); } : null} />
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
        <VerseSearch entries={entries} onOpen={(e) => { setViewing(e); setTab("library"); }} />
      )}

      {tab === "data" && (
        <DataPanel notes={notes} devotions={devotions} topics={topics}
          onImport={handleImport} onFlash={flash} />
      )}

      {toast && <div className="sn-toast">{toast}</div>}

      <div className="sn-nav">
        <button className={"sn-nav-btn" + (tab === "sermon" ? " on" : "")}
          onClick={() => { setEditing(null); setViewing(null); setTab("sermon"); }}>
          <span className="sn-nav-ico">✎</span>Sermon</button>
        <button className={"sn-nav-btn" + (tab === "devotion" ? " on" : "")}
          onClick={() => { setEditing(null); setViewing(null); setTab("devotion"); }}>
          <span className="sn-nav-ico">✻</span>Devotion</button>
        <button className={"sn-nav-btn" + (tab === "library" ? " on" : "")}
          onClick={() => { setViewing(null); setTab("library"); }}>
          <span className="sn-nav-ico">📖</span>Library</button>
        <button className={"sn-nav-btn" + (tab === "verses" ? " on" : "")}
          onClick={() => setTab("verses")}>
          <span className="sn-nav-ico">🔎</span>Verses</button>
      </div>
    </div>
    </TopicsContext.Provider>
  );
}

/* --------------------------------------------------------------- */
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
