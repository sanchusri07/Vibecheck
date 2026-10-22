
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

const SOOTHING_SOUNDS = [
  {
    id: "rain",
    name: "Gentle Rain",
    emoji: "🌧️",
    description: "Soft rainfall for a quiet moment.",
    src: "/sounds/rain.mp3",
  },
  {
    id: "waves",
    name: "Ocean Waves",
    emoji: "🌊",
    description: "Gentle waves rolling onto the shore.",
    src: "/sounds/waves.mp3",
  },
  {
    id: "birds",
    name: "Forest Birds",
    emoji: "🐦",
    description: "Birdsong and peaceful forest ambience.",
    src: "/sounds/birds.mp3",
  },
  {
    id: "fireplace",
    name: "Fireplace",
    emoji: "🔥",
    description: "Soft, cozy crackling sounds.",
    src: "/sounds/fireplace.mp3",
  },
  {
    id: "crickets",
    name: "Night Crickets",
    emoji: "🌙",
    description: "Sounds of a quiet night.",
    src: "/sounds/crickets.mp3",
  },
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

  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState("Ready when you are");
  const [breathCount, setBreathCount] = useState(0);

  // Soothing Sounds feature
  const [activeSound, setActiveSound] = useState("rain");
  const [customSound, setCustomSound] = useState(null);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [soundError, setSoundError] = useState("");
  const [soundPlaying, setSoundPlaying] = useState(false);

  const uid = user?.uid;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!uid) return;

    let active = true;

    async function loadData() {
      try {
        const [checkinSnapshot, journalSnapshot, contactSnapshot] =
          await Promise.all([
            getDocs(collection(db, "users", uid, "checkins")),
            getDocs(
              query(
                collection(db, "users", uid, "journals"),
                orderBy("createdAt", "desc")
              )
            ),
            getDocs(collection(db, "users", uid, "emergencyContacts")),
          ]);

        if (!active) return;

        const checkins = checkinSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setTodayCheckin(
          checkins.find((item) => item.date === todayKey()) || null
        );

        setJournalEntries(
          journalSnapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );

        setContacts(
          contactSnapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      } catch (error) {
        console.error("Could not load VibeCheck data:", error);
        if (active) {
          setNotice(
            "We couldn't load some saved data. Please check your connection and Firestore rules."
          );
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [uid]);

  // Clean up uploaded audio when the component is removed or the file changes.
  useEffect(() => {
    return () => {
      if (customSound?.src) {
        URL.revokeObjectURL(customSound.src);
      }
    };
  }, [customSound]);

  const entriesForSelectedDate = useMemo(
    () => journalEntries.filter((entry) => entry.date === calendarDate),
    [journalEntries, calendarDate]
  );

  const monthEntries = useMemo(() => {
    const prefix = calendarDate.slice(0, 7);
    return journalEntries.filter((entry) =>
      String(entry.date || "").startsWith(prefix)
    );
  }, [journalEntries, calendarDate]);

  async function saveCheckin() {
    if (!uid) return;

    if (!selectedMood) {
      setNotice("Choose the vibe that feels closest to how you feel today.");
      return;
    }

    if (!checkinText.trim()) {
      setNotice("Add a few words about what's on your mind today.");
      return;
    }

    setBusy(true);
    setNotice("");

    const data = {
      date: todayKey(),
      mood: selectedMood,
      reflection: checkinText.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "users", uid, "checkins", todayKey()), data);
      setTodayCheckin({ ...data });
      setNotice("Your check-in is saved. Thank you for pausing for yourself ✨");
    } catch (error) {
      console.error(error);
      setNotice("Your check-in couldn't be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveJournal() {
    if (!uid) return;

    if (!journalText.trim()) {
      setNotice("Write a little something before saving your journal.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const data = {
        date: todayKey(),
        mood: journalMood || selectedMood || "Not specified",
        text: journalText.trim(),
        createdAt: serverTimestamp(),
      };

      const saved = await addDoc(
        collection(db, "users", uid, "journals"),
        data
      );

      setJournalEntries((previous) => [
        {
          ...data,
          id: saved.id,
          createdAt: new Date(),
        },
        ...previous,
      ]);

      setJournalText("");
      setJournalMood("");
      setCalendarDate(todayKey());
      setNotice("Your little page has been saved 🌙");
    } catch (error) {
      console.error(error);
      setNotice("The journal entry couldn't be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveContact() {
    if (!uid) return;

    if (!contactName.trim() || !contactPhone.trim()) {
      setNotice("Please add both a contact name and a phone number.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const data = {
        name: contactName.trim(),
        phone: contactPhone.trim(),
        createdAt: serverTimestamp(),
      };

      const saved = await addDoc(
        collection(db, "users", uid, "emergencyContacts"),
        data
      );

      setContacts((previous) => [...previous, { ...data, id: saved.id }]);
      setContactName("");
      setContactPhone("");
      setNotice("Your contact has been saved.");
    } catch (error) {
      console.error(error);
      setNotice("Couldn't save the contact. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendChatMessage(event) {
    event?.preventDefault();

    const message = chatInput.trim();
    if (!message || busy) return;

    const updatedMessages = [
      ...chatMessages,
      { role: "user", content: message },
    ];

    setChatMessages(updatedMessages);
    setChatInput("");
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "The chat service is unavailable.");
      }

      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            data.reply ||
            "I'm here with you. Want to tell me a little more?",
        },
      ]);
    } catch (error) {
      console.error(error);
      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Oh, my little paws got tangled connecting just now 🐾 Please try again in a moment. You can still take a slow breath while we reconnect.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!breathing) return;

    const phases = [
      { label: "Breathe in gently…", duration: 4000, count: 1 },
      { label: "Breathe out slowly…", duration: 6000, count: 0 },
    ];

    let phaseIndex = 0;
    let timeout;

    function nextPhase() {
      const phase = phases[phaseIndex];
      setBreathPhase(phase.label);
      if (phase.count) setBreathCount((count) => count + 1);

      timeout = setTimeout(() => {
        phaseIndex = (phaseIndex + 1) % phases.length;
        nextPhase();
      }, phase.duration);
    }

    nextPhase();

    return () => clearTimeout(timeout);
  }, [breathing]);

  function stopBreathing() {
    setBreathing(false);
    setBreathPhase("Ready when you are");
  }

  function handleSoundUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      setSoundError("Please choose an audio file.");
      event.target.value = "";
      return;
    }

    if (customSound?.src) {
      URL.revokeObjectURL(customSound.src);
    }

    const src = URL.createObjectURL(file);

    setCustomSound({
      id: "custom",
      name: file.name.replace(/\.[^/.]+$/, ""),
      emoji: "🎵",
      description: "Your own sound, ready for a quiet moment.",
      src,
    });

    setActiveSound("custom");
    setSoundError("");
    setSoundPlaying(false);
    event.target.value = "";
  }

  function renderHome() {
    return (
      <>
        <section className="vc-card vc-welcome">
          <div>
            <p className="vc-eyebrow">A LITTLE SPACE FOR YOU</p>
            <h2>Hey there, stargazer ✨</h2>
            <p className="vc-muted">
              You don't have to figure everything out today. Take five minutes
              to check in, breathe, or simply be.
            </p>
          </div>
          <BlackDog />
        </section>

        <section className="vc-card">
          <p className="vc-eyebrow">YOUR DAILY PAUSE</p>
          <h2>How are you feeling today?</h2>
          <p className="vc-muted">
            There are no right or wrong answers. Pick whatever feels closest.
          </p>

          <div className="vc-moods">
            {MOODS.map((mood) => (
              <button
                key={mood.name}
                type="button"
                className={`vc-mood-option ${
                  selectedMood === mood.name ? "selected" : ""
                }`}
                onClick={() => setSelectedMood(mood.name)}
                style={{ "--mood-color": mood.color }}
              >
                <span>{mood.emoji}</span>
                {mood.name}
              </button>
            ))}
          </div>

          <label htmlFor="daily-reflection">
            What's making you feel this way today?
          </label>
          <textarea
            id="daily-reflection"
            rows="4"
            value={checkinText}
            onChange={(event) => setCheckinText(event.target.value)}
            placeholder="A thought, a moment, a tiny thing… anything is okay."
          />

          {todayCheckin && (
            <p className="vc-soft">
              Today's check-in is saved. You can update it whenever you need.
            </p>
          )}

          <button
            className="vc-primary"
            type="button"
            onClick={saveCheckin}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save my check-in"}
          </button>
        </section>

        <section className="vc-feature-grid">
          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("breathe")}
          >
            <span className="vc-feature-icon">🌬️</span>
            <h3>Focus & Breathe</h3>
            <p className="vc-muted">A small breathing break, just for you.</p>
          </button>

          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("buddy")}
          >
            <BlackDog small />
            <h3>Talk it out</h3>
            <p className="vc-muted">Chat with your little black-dog companion.</p>
          </button>

          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("journal")}
          >
            <span className="vc-feature-icon">📔</span>
            <h3>Your journal</h3>
            <p className="vc-muted">Leave today's thoughts on a page.</p>
          </button>

          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("support")}
          >
            <span className="vc-feature-icon">🫶</span>
            <h3>Your support</h3>
            <p className="vc-muted">Your contacts and helpful helplines.</p>
          </button>

          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("sounds")}
          >
            <span className="vc-feature-icon">🎧</span>
            <h3>Soothing Sounds</h3>
            <p className="vc-muted">
              Rain, waves, and little sounds for a softer moment.
            </p>
          </button>
        </section>
      </>
    );
  }

  function renderBreathing() {
    return (
      <section className="vc-card vc-breathing">
        <p className="vc-eyebrow">SLOW DOWN A LITTLE</p>
        <h2>Let's breathe together</h2>
        <p className="vc-muted">
          Follow the circle at a comfortable pace. If focusing on your breath
          feels uncomfortable, stop and simply notice the room around you.
        </p>

        <div
          className={`vc-breath-circle ${breathing ? "is-breathing" : ""}`}
          aria-live="polite"
        >
          <div className="vc-breath-inner">
            <span>✦</span>
            <p>{breathPhase}</p>
          </div>
        </div>

        <p className="vc-soft">
          {breathing
            ? `Breathing cycle ${breathCount}`
            : "Try a gentle inhale, then a slower exhale."}
        </p>

        <div className="vc-actions">
          {!breathing ? (
            <button
              className="vc-primary"
              type="button"
              onClick={() => {
                setBreathCount(0);
                setBreathing(true);
              }}
            >
              Begin breathing
            </button>
          ) : (
            <button
              className="vc-quiet"
              type="button"
              onClick={stopBreathing}
            >
              Finish for now
            </button>
          )}
          <button
            className="vc-quiet"
            type="button"
            onClick={() => setPage("home")}
          >
            Back to home
          </button>
        </div>
      </section>
    );
  }

  function renderChat() {
    return (
      <section className="vc-card vc-chat-card">
        <div className="vc-chat-heading">
          <BlackDog />
          <div>
            <p className="vc-eyebrow">YOUR LITTLE COMPANION</p>
            <h2>Hey, I'm Buddy 🐾</h2>
            <p className="vc-muted">
              No pressure. No perfect words required.
            </p>
          </div>
        </div>

        <div className="vc-chat-messages" aria-live="polite">
          {chatMessages.map((message, index) => (
            <div
              key={`${index}-${message.role}`}
              className={`vc-chat-bubble ${
                message.role === "user" ? "vc-chat-user" : "vc-chat-buddy"
              }`}
            >
              {message.role !== "user" && <span>🐾 </span>}
              {message.content}
            </div>
          ))}
          {busy && <p className="vc-soft">Buddy is thinking… 🐾</p>}
        </div>

        <form className="vc-chat-form" onSubmit={sendChatMessage}>
          <input
            aria-label="Your message"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Tell Buddy what's on your mind…"
            maxLength={2000}
          />
          <button className="vc-primary" type="submit" disabled={busy}>
            Send
          </button>
        </form>

        <p className="vc-soft">
          Buddy is an AI companion, not a human or therapist. Avoid sharing
          passwords, addresses, or other sensitive personal details.
        </p>
      </section>
    );
  }

  function renderJournal() {
    return (
      <>
        <section className="vc-card">
          <p className="vc-eyebrow">YOUR LITTLE CORNER</p>
          <h2>Dear diary… 🌙</h2>
          <p className="vc-muted">
            This page is yours. Write a few lines, or a lot. You don't have to
            make sense of everything right now.
          </p>

          <label htmlFor="journal-mood">Today's vibe</label>
          <div className="vc-moods">
            {MOODS.map((mood) => (
              <button
                key={mood.name}
                type="button"
                className={`vc-mood-option ${
                  journalMood === mood.name ? "selected" : ""
                }`}
                onClick={() => setJournalMood(mood.name)}
                style={{ "--mood-color": mood.color }}
              >
                <span>{mood.emoji}</span>
                {mood.name}
              </button>
            ))}
          </div>

          <label htmlFor="journal-entry">What would you like to remember?</label>
          <textarea
            id="journal-entry"
            rows="6"
            value={journalText}
            onChange={(event) => setJournalText(event.target.value)}
            placeholder="A little win, a hard moment, a random thought…"
          />

          <button
            className="vc-primary"
            type="button"
            onClick={saveJournal}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save today's page"}
          </button>
        </section>

        <section className="vc-card vc-calendar-card">
          <p className="vc-eyebrow">YOUR MOOD CALENDAR</p>
          <h2>Look back gently</h2>
          <label htmlFor="journal-date">Choose a date</label>
          <input
            id="journal-date"
            type="date"
            value={calendarDate}
            onChange={(event) => setCalendarDate(event.target.value)}
          />

          <div className="vc-calendar-dots">
            {monthEntries.map((entry) => {
              const mood = MOODS.find((item) => item.name === entry.mood);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`vc-calendar-day ${
                    entry.date === calendarDate ? "selected" : ""
                  }`}
                  onClick={() => setCalendarDate(entry.date)}
                  title={`${entry.date}: ${entry.mood || "Journal entry"}`}
                >
                  <span>{Number(entry.date.slice(-2))}</span>
                  <span
                    className="vc-calendar-dot"
                    style={{ background: mood?.color || "#bda7ff" }}
                  />
                </button>
              );
            })}
          </div>

          <h3>Pages from {calendarDate}</h3>

          {entriesForSelectedDate.length === 0 ? (
            <p className="vc-muted">
              No journal page for this date yet. That's okay; every day doesn't
              need to be documented.
            </p>
          ) : (
            entriesForSelectedDate.map((entry) => (
              <article className="vc-entry" key={entry.id}>
                <p className="vc-entry-mood">
                  {MOODS.find((item) => item.name === entry.mood)?.emoji || "🌙"}{" "}
                  {entry.mood}
                </p>
                <p>{entry.text}</p>
              </article>
            ))
          )}
        </section>

        <section className="vc-card">
          <h3>Recent pages</h3>
          {journalEntries.length === 0 ? (
            <p className="vc-muted">
              Your journal will grow one small page at a time.
            </p>
          ) : (
            journalEntries.slice(0, 5).map((entry) => (
              <button
                className="vc-entry vc-entry-button"
                key={entry.id}
                type="button"
                onClick={() => setCalendarDate(entry.date || todayKey())}
              >
                <strong>
                  {entry.date} · {entry.mood || "A little reflection"}
                </strong>
                <p>{entry.text}</p>
              </button>
            ))
          )}
        </section>
      </>
    );
  }

  function renderSupport() {
    return (
      <>
        <section className="vc-card">
          <p className="vc-eyebrow">PEOPLE IN YOUR CORNER</p>
          <h2>Your trusted contacts 🫶</h2>
          <p className="vc-muted">
            Add people you feel safe reaching out to. VibeCheck does not
            automatically call them or send alerts.
          </p>

          <label htmlFor="contact-name">Contact name</label>
          <input
            id="contact-name"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Someone you trust"
          />

          <label htmlFor="contact-phone">Phone number</label>
          <input
            id="contact-phone"
            type="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="Include country code if needed"
          />

          <button
            className="vc-primary"
            type="button"
            onClick={saveContact}
            disabled={busy}
          >
            Save contact
          </button>

          {contacts.map((contact) => (
            <div className="vc-entry" key={contact.id}>
              <strong>{contact.name}</strong>
              <p>{contact.phone}</p>
              <a href={`tel:${contact.phone}`}>Call this contact</a>
            </div>
          ))}
        </section>

        <section className="vc-card">
          <p className="vc-eyebrow">SUPPORT WHEN YOU NEED IT</p>
          <h2>You're not alone.</h2>
          <p className="vc-muted">
            If you need support, consider reaching out to someone you trust or
            a qualified professional.
          </p>

          {HELPLINES.map((line) => (
            <article className="vc-entry" key={line.number}>
              <h3>{line.name}</h3>
              <p>{line.detail}</p>
              <a href={`tel:${line.number}`}>Call {line.number}</a>
            </article>
          ))}

          <p className="vc-soft">
            If you or someone else is in immediate danger in India, call 112.
            For mental health support, Tele-MANAS is available at 14416.
          </p>
        </section>
      </>
    );
  }

  function renderSoothingSounds() {
    const selectedSound =
      activeSound === "custom" && customSound
        ? customSound
        : SOOTHING_SOUNDS.find((sound) => sound.id === activeSound) ||
          SOOTHING_SOUNDS[0];

    return (
      <section className="vc-card vc-sounds-page">
        <p className="vc-eyebrow">YOUR LITTLE SOUND SANCTUARY</p>
        <h2>A softer moment 🎧</h2>
        <p className="vc-muted">
          Choose a sound, get comfortable, and give yourself a few quiet
          minutes. There's nothing you need to achieve here.
        </p>

        <div className="vc-sounds-grid">
          {SOOTHING_SOUNDS.map((sound) => (
            <button
              key={sound.id}
              type="button"
              className={`vc-sound-card ${
                activeSound === sound.id ? "selected" : ""
              }`}
              onClick={() => {
                setActiveSound(sound.id);
                setSoundError("");
                setSoundPlaying(false);
              }}
            >
              <span className="vc-sound-emoji">{sound.emoji}</span>
              <strong>{sound.name}</strong>
              <span className="vc-sound-description">
                {sound.description}
              </span>
            </button>
          ))}

          {customSound && (
            <button
              type="button"
              className={`vc-sound-card ${
                activeSound === "custom" ? "selected" : ""
              }`}
              onClick={() => {
                setActiveSound("custom");
                setSoundError("");
                setSoundPlaying(false);
              }}
            >
              <span className="vc-sound-emoji">🎵</span>
              <strong>{customSound.name}</strong>
              <span className="vc-sound-description">Your uploaded sound</span>
            </button>
          )}
        </div>

        <div className="vc-sound-player">
          <div className="vc-sound-player-heading">
            <span className="vc-sound-emoji">{selectedSound.emoji}</span>
            <div>
              <p className="vc-eyebrow">NOW SELECTED</p>
              <h3>{selectedSound.name}</h3>
              <p className="vc-muted">{selectedSound.description}</p>
            </div>
          </div>

          <audio
            key={selectedSound.src}
            className="vc-audio"
            controls
            loop
            preload="none"
            src={selectedSound.src}
            onPlay={() => {
              setSoundPlaying(true);
              setSoundError("");
            }}
            onPause={() => setSoundPlaying(false)}
            onError={() => {
              setSoundPlaying(false);
              setSoundError(
                "This sound file isn't available yet. Add the matching MP3 file to your public/sounds folder."
              );
            }}
            ref={(element) => {
              if (element) element.volume = soundVolume;
            }}
          >
            Your browser does not support audio playback.
          </audio>

          <label htmlFor="sound-volume">
            Volume: {Math.round(soundVolume * 100)}%
          </label>
          <input
            id="sound-volume"
            className="vc-volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={soundVolume}
            onChange={(event) =>
              setSoundVolume(Number(event.target.value))
            }
          />

          <p className="vc-soft" aria-live="polite">
            {soundPlaying
              ? "Take your time. You can pause whenever you like. ✨"
              : "Press play when you're ready."}
          </p>

          {soundError && (
            <p className="vc-sound-error" role="status">
              {soundError}
            </p>
          )}
        </div>

        <div className="vc-sound-upload">
          <h3>Bring your own sound 🎶</h3>
          <p className="vc-muted">
            Choose an audio file from your device. It can be played here during
            this session; it isn't uploaded to your VibeCheck account.
          </p>
          <label className="vc-upload-label" htmlFor="custom-sound">
            Choose an audio file
          </label>
          <input
            id="custom-sound"
            type="file"
            accept="audio/*"
            onChange={handleSoundUpload}
          />
          <p className="vc-soft">
            Your file stays local to this browser session. If you refresh the
            page, you'll need to select it again.
          </p>
        </div>

        <div className="vc-actions">
          <button
            className="vc-quiet"
            type="button"
            onClick={() => setPage("home")}
          >
            Back to home
          </button>
        </div>
      </section>
    );
  }

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
    { id: "support", label: "Support", emoji: "🫶" },
    { id: "sounds", label: "Soothing Sounds", emoji: "🎧" },
  ];

  return (
    <main className="vc-shell">
      <header className="vc-header">
        <div>
          <p className="vc-eyebrow">YOUR PERSONAL GALAXY</p>
          <h1>
            Vibe<span>Check</span> ✦
          </h1>
          <p className="vc-muted">
            A small pause. A little more room to breathe.
          </p>
        </div>

        <button
          className="vc-quiet"
          type="button"
          onClick={() => auth.signOut()}
        >
          Sign out
        </button>
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
      {page === "support" && renderSupport()}
      {page === "sounds" && renderSoothingSounds()}

      <footer className="vc-footer">
        Made with care, for the days that feel like a lot. ✦
      </footer>
    </main>
  );
}

export default App;
