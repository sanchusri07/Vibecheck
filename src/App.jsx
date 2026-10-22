import { useEffect, useMemo, useRef, useState } from "react";
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

function GroundingPopup({ mood, onClose, onBoxBreathing }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      count: 5,
      label: "things you can SEE",
      prompt: "Look around and name five things you can see.",
    },
    {
      count: 4,
      label: "things you can FEEL",
      prompt: "Notice four things you can physically feel.",
    },
    {
      count: 3,
      label: "things you can HEAR",
      prompt: "Listen for three sounds around you.",
    },
    {
      count: 2,
      label: "things you can SMELL",
      prompt: "Notice two scents, or two smells you like.",
    },
    {
      count: 1,
      label: "thing you can TASTE",
      prompt: "Notice one taste, or take a sip of water.",
    },
  ];

  return (
    <div className="vc-modal-backdrop">
      <section
        className="vc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grounding-title"
      >
        <button
          type="button"
          className="vc-modal-close"
          aria-label="Close grounding exercise"
          onClick={onClose}
        >
          ×
        </button>

        <p className="vc-eyebrow">
          A GENTLE PAUSE · {mood.toUpperCase()}
        </p>

        <h2 id="grounding-title">
          Let's come back to the present 🌿
        </h2>

        <p className="vc-muted">
          There's no rush. Go at your own pace, and skip anything
          that doesn't feel comfortable.
        </p>

        <p className="vc-grounding-progress">
          Step {step + 1} of {steps.length}
        </p>

        <div className="vc-grounding-number">
          {steps[step].count}
        </div>

        <h3>{steps[step].label}</h3>
        <p>{steps[step].prompt}</p>

        <div className="vc-actions">
          {step < steps.length - 1 ? (
            <button
              className="vc-primary"
              type="button"
              onClick={() => setStep((value) => value + 1)}
            >
              Next step →
            </button>
          ) : (
            <button
              className="vc-primary"
              type="button"
              onClick={onClose}
            >
              I'm done ✨
            </button>
          )}

          <button
            className="vc-quiet"
            type="button"
            onClick={onClose}
          >
            Maybe later
          </button>

          <button
            className="vc-quiet"
            type="button"
            onClick={onBoxBreathing}
          >
            Try box breathing
          </button>
        </div>
      </section>
    </div>
  );
}

function BoxBreathingPopup({ onClose }) {
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);

  const phases = [
    "Breathe in",
    "Hold gently",
    "Breathe out",
    "Rest gently",
  ];

  useEffect(() => {
    if (!running) return;

    const timer = setTimeout(() => {
      setPhaseIndex((index) => (index + 1) % phases.length);
    }, 4000);

    return () => clearTimeout(timer);
  }, [running, phaseIndex]);

  return (
    <div className="vc-modal-backdrop">
      <section
        className="vc-modal vc-box-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="box-title"
      >
        <button
          type="button"
          className="vc-modal-close"
          aria-label="Close box breathing"
          onClick={onClose}
        >
          ×
        </button>

        <p className="vc-eyebrow">FOUR GENTLE STEPS</p>
        <h2 id="box-title">Box breathing 🌬️</h2>

        <p className="vc-muted">
          Follow only if it feels comfortable. You can breathe
          normally or stop at any time.
        </p>

        <div
          className={`vc-box-circle ${
            running ? "vc-box-circle-active" : ""
          }`}
          aria-live="polite"
        >
          <div>
            <span>{running ? "4" : "✦"}</span>
            <p>
              {running ? phases[phaseIndex] : "Ready when you are"}
            </p>
          </div>
        </div>

        <p className="vc-muted">
          Inhale · Hold · Exhale · Hold
        </p>

        <div className="vc-actions">
          {!running ? (
            <button
              className="vc-primary"
              type="button"
              onClick={() => {
                setPhaseIndex(0);
                setRunning(true);
              }}
            >
              Start gently
            </button>
          ) : (
            <button
              className="vc-primary"
              type="button"
              onClick={() => setRunning(false)}
            >
              Pause
            </button>
          )}

          <button
            className="vc-quiet"
            type="button"
            onClick={onClose}
          >
            Close exercise
          </button>
        </div>
      </section>
    </div>
  );
}

function SoothingSounds() {
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState("rain");
  const audioRef = useRef(null);

  function stopSound() {
    if (audioRef.current) {
      audioRef.current.nodes.forEach((node) => {
        try {
          node.stop?.();
          node.disconnect();
        } catch {}
      });

      audioRef.current.context.close();
      audioRef.current = null;
    }

    setPlaying(false);
  }

  async function toggleSound() {
    if (playing) {
      stopSound();
      return;
    }

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    await context.resume();

    const master = context.createGain();
    master.gain.value = 0.035;
    master.connect(context.destination);

    const nodes = [];

    if (sound === "tone") {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = 220;
      oscillator.connect(master);
      oscillator.start();
      nodes.push(oscillator);
    } else {
      const bufferSize = context.sampleRate * 2;
      const buffer = context.createBuffer(
        1,
        bufferSize,
        context.sampleRate
      );

      const channel = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        channel[i] = (Math.random() * 2 - 1) * 0.5;
      }

      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = context.createBiquadFilter();
      filter.type = sound === "rain" ? "lowpass" : "bandpass";
      filter.frequency.value = sound === "rain" ? 900 : 500;

      noise.connect(filter);
      filter.connect(master);
      noise.start();

      nodes.push(noise, filter);
    }

    audioRef.current = { context, nodes };
    setPlaying(true);
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.nodes.forEach((node) => {
          try {
            node.stop?.();
            node.disconnect();
          } catch {}
        });

        audioRef.current.context.close();
      }
    };
  }, []);

  return (
    <section className="vc-card vc-sounds">
      <p className="vc-eyebrow">A LITTLE AMBIENCE</p>
      <h2>Soothing sounds 🎵</h2>

      <p className="vc-muted">
        Choose a gentle background sound for your pause.
      </p>

      <label htmlFor="vc-sound-choice">Choose a sound</label>

      <select
        id="vc-sound-choice"
        value={sound}
        onChange={(event) => {
          if (playing) stopSound();
          setSound(event.target.value);
        }}
      >
        <option value="rain">Rain-like noise</option>
        <option value="waves">Soft ambient noise</option>
        <option value="tone">Gentle tone</option>
      </select>

      <div className="vc-actions">
        <button
          className="vc-primary"
          type="button"
          onClick={toggleSound}
        >
          {playing ? "Stop sound ■" : "Play sound ▶"}
        </button>
      </div>

      <p className="vc-soft">
        Keep your volume low and comfortable.
      </p>
    </section>
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
  const [showGrounding, setShowGrounding] = useState(false);
  const [showBoxBreathing, setShowBoxBreathing] = useState(false);
  const [groundingMood, setGroundingMood] = useState("");

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
        const [
          checkinSnapshot,
          journalSnapshot,
          contactSnapshot,
        ] = await Promise.all([
          getDocs(collection(db, "users", uid, "checkins")),
          getDocs(
            query(
              collection(db, "users", uid, "journals"),
              orderBy("createdAt", "desc")
            )
          ),
          getDocs(
            collection(db, "users", uid, "emergencyContacts")
          ),
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

  const entriesForSelectedDate = useMemo(
    () => journalEntries.filter(
      (entry) => entry.date === calendarDate
    ),
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
      setNotice(
        "Choose the vibe that feels closest to how you feel today."
      );
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
      await setDoc(
        doc(db, "users", uid, "checkins", todayKey()),
        data
      );

      setTodayCheckin({ ...data });

      setNotice(
        "Your check-in is saved. Thank you for pausing for yourself ✨"
      );
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

      setContacts((previous) => [
        ...previous,
        { ...data, id: saved.id },
      ]);

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
        throw new Error(
          data.error || "The chat service is unavailable."
        );
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
      {
        label: "Breathe in gently…",
        duration: 4000,
        count: 1,
      },
      {
        label: "Breathe out slowly…",
        duration: 6000,
        count: 0,
      },
    ];

    let phaseIndex = 0;
    let timeout;

    function nextPhase() {
      const phase = phases[phaseIndex];

      setBreathPhase(phase.label);

      if (phase.count) {
        setBreathCount((count) => count + 1);
      }

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

  function renderHome() {
    return (
      <>
        <section className="vc-card vc-welcome">
          <div>
            <p className="vc-eyebrow">A LITTLE SPACE FOR YOU</p>
            <h2>Hey there, stargazer ✨</h2>
            <p className="vc-muted">
              You don't have to figure everything out today.
              Take five minutes to check in, breathe, or simply be.
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
                onClick={() => {
                  setSelectedMood(mood.name);

                  if (
                    ["Anxious", "Sad", "Tired"].includes(mood.name)
                  ) {
                    setGroundingMood(mood.name);
                    setShowGrounding(true);
                  }
                }}
                style={{ "--mood-color": mood.color }}
              >
                <span>{mood.emoji}</span>
                {mood.name}
              </button>
            ))}
          </div>

          <label htmlFor="checkin-text">
            What's making you feel this way today?
          </label>

          <textarea
            id="checkin-text"
            rows="4"
            value={checkinText}
            onChange={(event) => setCheckinText(event.target.value)}
            placeholder="You can write a little or a lot. This space is yours…"
          />

          <button
            className="vc-primary"
            type="button"
            onClick={saveCheckin}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save my check-in"}
          </button>

          {todayCheckin && (
            <p className="vc-soft">
              Today's check-in is saved. You can update it whenever you need.
            </p>
          )}
        </section>

        <section className="vc-feature-grid">
          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("breathe")}
          >
            <span className="vc-feature-icon">🌬️</span>
            <h3>Take a breath</h3>
            <p className="vc-muted">
              A gentle breathing pause, at your own pace.
            </p>
          </button>

          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("buddy")}
          >
            <BlackDog small />
            <h3>Talk it out</h3>
            <p className="vc-muted">
              Chat with your little black-dog companion.
            </p>
          </button>

          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("journal")}
          >
            <span className="vc-feature-icon">📔</span>
            <h3>Your journal</h3>
            <p className="vc-muted">
              Leave today's thoughts on a page.
            </p>
          </button>

          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("support")}
          >
            <span className="vc-feature-icon">🫶</span>
            <h3>Your support</h3>
            <p className="vc-muted">
              Your contacts and helpful helplines.
            </p>
          </button>
        </section>

        <SoothingSounds />
      </>
    );
  }
  function renderBreathing() {
    return (
      <section className="vc-card vc-breathing">
        <p className="vc-eyebrow">SLOW DOWN A LITTLE</p>
        <h2>Let's breathe together</h2>

        <p className="vc-muted">
          Follow the circle at a comfortable pace. If focusing on
          your breath feels uncomfortable, stop and simply notice
          the room around you.
        </p>

        <div
          className={`vc-breath-circle ${
            breathing ? "is-breathing" : ""
          }`}
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
                message.role === "user"
                  ? "vc-chat-user"
                  : "vc-chat-buddy"
              }`}
            >
              {message.role !== "user" && <span>🐾 </span>}
              {message.content}
            </div>
          ))}

          {busy && (
            <p className="vc-soft">Buddy is thinking… 🐾</p>
          )}
        </div>

        <form
          className="vc-chat-form"
          onSubmit={sendChatMessage}
        >
          <input
            aria-label="Your message"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Tell Buddy what's on your mind…"
            maxLength={2000}
          />

          <button
            className="vc-primary"
            type="submit"
            disabled={busy}
          >
            Send
          </button>
        </form>

        <p className="vc-soft">
          Buddy is an AI companion, not a human or therapist.
          Avoid sharing passwords, addresses, or other sensitive
          personal details.
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
            This page is yours. Write a few lines, or a lot.
            You don't have to make sense of everything right now.
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

          <label htmlFor="journal-entry">
            What would you like to remember?
          </label>

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
              const mood = MOODS.find(
                (item) => item.name === entry.mood
              );

              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`vc-calendar-day ${
                    entry.date === calendarDate ? "selected" : ""
                  }`}
                  onClick={() => setCalendarDate(entry.date)}
                  title={`${entry.date} — ${entry.mood}`}
                >
                  <span>
                    {Number(String(entry.date).slice(-2))}
                  </span>

                  <span
                    className="vc-calendar-dot"
                    style={{
                      backgroundColor: mood?.color || "#a994f5",
                    }}
                  />
                </button>
              );
            })}
          </div>

          <h3>
            Entries for{" "}
            {calendarDate}
          </h3>

          {entriesForSelectedDate.length === 0 ? (
            <p className="vc-muted">
              No journal entries for this date yet. That's okay.
            </p>
          ) : (
            entriesForSelectedDate.map((entry) => {
              const mood = MOODS.find(
                (item) => item.name === entry.mood
              );

              return (
                <article
                  className="vc-card"
                  key={entry.id}
                >
                  <p className="vc-eyebrow">
                    {mood?.emoji || "🌙"} {entry.mood}
                  </p>
                  <p>{entry.text}</p>
                </article>
              );
            })
          )}
        </section>
      </>
    );
  }

  function renderSupport() {
    return (
      <>
        <section className="vc-card">
          <p className="vc-eyebrow">YOU DON'T HAVE TO DO IT ALONE</p>
          <h2>Your support circle 🫶</h2>

          <p className="vc-muted">
            Add someone you trust so you can find their contact
            information when you need it.
          </p>

          <label htmlFor="contact-name">Contact name</label>
          <input
            id="contact-name"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="A trusted friend or family member"
          />

          <label htmlFor="contact-phone">Phone number</label>
          <input
            id="contact-phone"
            type="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="Phone number"
          />

          <button
            className="vc-primary"
            type="button"
            onClick={saveContact}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save trusted contact"}
          </button>
        </section>

        <section className="vc-card">
          <p className="vc-eyebrow">PEOPLE YOU CAN REACH</p>
          <h2>Your saved contacts</h2>

          {contacts.length === 0 ? (
            <p className="vc-muted">
              Your support circle is empty for now.
            </p>
          ) : (
            contacts.map((contact) => (
              <div className="vc-codebox" key={contact.id}>
                <div>
                  <strong>{contact.name}</strong>
                  <p className="vc-muted">{contact.phone}</p>
                </div>

                <a href={`tel:${contact.phone}`}>
                  Call
                </a>
              </div>
            ))
          )}
        </section>

        <section className="vc-card">
          <p className="vc-eyebrow">HELP IS AVAILABLE</p>
          <h2>Support helplines</h2>

          <p className="vc-muted">
            If you need support, consider reaching out to a
            trained professional or someone you trust.
          </p>

          {HELPLINES.map((line) => (
            <div className="vc-codebox" key={line.number}>
              <div>
                <strong>{line.name}</strong>
                <p className="vc-muted">{line.detail}</p>
                <strong>{line.number}</strong>
              </div>

              <a href={`tel:${line.number}`}>
                Call
              </a>
            </div>
          ))}
        </section>
      </>
    );
  }

  if (authLoading) {
    return (
      <main className="vc-shell">
        <section className="vc-card">
          <p className="vc-eyebrow">VIBECHECK ✦</p>
          <h2>Getting your little space ready…</h2>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="vc-shell">
        <section className="vc-card">
          <p className="vc-eyebrow">VIBECHECK ✦</p>
          <h2>Welcome to your little space 🌙</h2>

          <p className="vc-muted">
            Please sign in to continue to your VibeCheck dashboard.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="vc-shell">
      <header className="vc-header">
        <div>
          <p className="vc-eyebrow">YOUR PERSONAL PAUSE</p>
          <h1>VibeCheck ✦</h1>
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
        <button
          type="button"
          className={page === "home" ? "active" : ""}
          onClick={() => setPage("home")}
        >
          Home
        </button>

        <button
          type="button"
          className={page === "breathe" ? "active" : ""}
          onClick={() => setPage("breathe")}
        >
          Breathe
        </button>

        <button
          type="button"
          className={page === "buddy" ? "active" : ""}
          onClick={() => setPage("buddy")}
        >
          Buddy
        </button>

        <button
          type="button"
          className={page === "journal" ? "active" : ""}
          onClick={() => setPage("journal")}
        >
          Journal
        </button>

        <button
          type="button"
          className={page === "support" ? "active" : ""}
          onClick={() => setPage("support")}
        >
          Support
        </button>
      </nav>

      {notice && (
        <div className="vc-notice" role="status">
          {notice}
          <button
            type="button"
            className="vc-notice-close"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {showGrounding && (
        <GroundingPopup
          mood={groundingMood}
          onClose={() => setShowGrounding(false)}
          onBoxBreathing={() => {
            setShowGrounding(false);
            setShowBoxBreathing(true);
          }}
        />
      )}

      {showBoxBreathing && (
        <BoxBreathingPopup
          onClose={() => setShowBoxBreathing(false)}
        />
      )}

      {page === "home" && renderHome()}
      {page === "breathe" && renderBreathing()}
      {page === "buddy" && renderChat()}
      {page === "journal" && renderJournal()}
      {page === "support" && renderSupport()}

      <footer className="vc-footer">
        Made with care, for the days that feel like a lot. ✦
      </footer>
    </main>
  );
}

export default App;