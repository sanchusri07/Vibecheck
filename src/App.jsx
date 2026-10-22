import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./App.css";

const MOODS = [
  { name: "Happy", emoji: "☀️", color: "#E8C98A" },
  { name: "Calm", emoji: "🌿", color: "#8FC9C0" },
  { name: "Anxious", emoji: "☁️", color: "#B6A6E8" },
  { name: "Sad", emoji: "🌧️", color: "#8FA8D4" },
  { name: "Tired", emoji: "🌙", color: "#C2B5CF" },
  { name: "Excited", emoji: "✨", color: "#E5A9C8" },
];

const todayKey = () => new Date().toLocaleDateString("en-CA");

const HELPLINES = [
  {
    name: "Tele-MANAS — India",
    number: "14416",
    detail: "Free mental health support, available 24/7.",
  },
  {
    name: "Emergency services — India",
    number: "112",
    detail: "For immediate danger or an urgent emergency.",
  },
];

function BlackDog({ small = false }) {
  return (
    <div
      className={`vc-dog ${small ? "vc-dog-small" : ""}`}
      aria-label="Cute black dog companion"
      role="img"
    >
      <span className="vc-dog-ear vc-dog-ear-left" />
      <span className="vc-dog-ear vc-dog-ear-right" />
      <span className="vc-dog-face">
        <span className="vc-dog-eye vc-dog-eye-left" />
        <span className="vc-dog-eye vc-dog-eye-right" />
        <span className="vc-dog-muzzle">
          <span className="vc-dog-nose" />
          <span className="vc-dog-mouth" />
        </span>
        <span className="vc-dog-blush vc-dog-blush-left" />
        <span className="vc-dog-blush vc-dog-blush-right" />
      </span>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("home");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [selectedMood, setSelectedMood] = useState("");
  const [checkinText, setCheckinText] = useState("");
  const [todayCheckin, setTodayCheckin] = useState(null);
  const [allCheckins, setAllCheckins] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(todayKey());

  const [journalText, setJournalText] = useState("");
  const [journalMood, setJournalMood] = useState("");
  const [journalEntries, setJournalEntries] = useState([]);
  const [calendarDate, setCalendarDate] = useState(todayKey());

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contacts, setContacts] = useState([]);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "Hey, friend 🐾 I'm your little black-dog companion. You don't need to explain everything perfectly. What's on your mind?",
    },
  ]);

  

  if (authLoading) {
    return (
      <main className="vc-shell">
        <section className="vc-card">
          <BlackDog />
          <h2>Finding your little corner of the galaxy…</h2>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="vc-shell">
        <section className="vc-card vc-setup">
          <BlackDog />
          <p className="vc-eyebrow">WELCOME TO VIBECHECK</p>
          <h1>Your little galaxy is waiting ✨</h1>
          <p className="vc-muted">
            Please sign in through your existing VibeCheck login page to
            continue. Your journal and contacts are available only after
            authentication.
          </p>
          <button
            className="vc-primary"
            type="button"
            onClick={() => (window.location.href = "/")}
          >
            Go to login
          </button>
        </section>
      </main>
    );
  }

  const pages = [
    { id: "home", label: "Home", emoji: "✦" },
    { id: "breathe", label: "Focus & Breathe", emoji: "🌬️" },
    { id: "buddy", label: "Talk it out", emoji: "🐾" },
    { id: "journal", label: "Journal", emoji: "📔" },
    { id: "calendar", label: "Mood Calendar", emoji: "🗓️" },
    { id: "support", label: "Support", emoji: "🫶" },
  ];

  return (
    <main className="vc-shell">
      <header className="vc-header">
        <div>
          <p className="vc-eyebrow">YOUR PERSONAL GALAXY</p>
          <h1>
            Vibe<span>Check</span> ✦
          </h1>
          <p className="vc-muted">A small pause. A little more room to breathe.</p>
        </div>

        
      </header>

      <nav className="vc-nav" aria-label="Main navigation">
        {pages.map((item) => (
          <button
            key={item.id}
            type="button"
            className={page === item.id ? "active" : ""}
            onClick={() => setPage(item.id)}
          >
            {item.emoji} {item.label}
          </button>
        ))}
      </nav>

      {notice && (
        <div className="vc-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}

      {page === "home" && renderHome()}
      {page === "breathe" && renderBreathing()}
      {page === "buddy" && renderChat()}
      {page === "journal" && renderJournal()}
      {page === "calendar" && renderMoodCalendar()}
      {page === "support" && renderSupport()}

      <footer className="vc-footer">
        Made with care, for the days that feel like a lot. ✦
      </footer>
    </main>
  );
}

export default App;