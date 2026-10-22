
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
  { name: "Overwhelmed", emoji: "🫧", color: "#B6A6E8" },
  { name: "Stressed", emoji: "🌧️", color: "#8FA8D4" },
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

const MOOD_CARDS = [
  {
    emoji: "🌙",
    title: "For the days you feel exhausted",
    message:
      "You don't have to solve everything today. Rest is allowed. Taking one small step, or taking a break, is enough for now.",
    prompt: "What is one thing you can give yourself permission to pause?",
    color: "#C2B5CF",
  },
  {
    emoji: "☁️",
    title: "For the moments you feel anxious",
    message:
      "You don't need to figure out the whole future right now. Come back to this moment. You can take things one step at a time.",
    prompt: "What is one small thing you can focus on right now?",
    color: "#B6A6E8",
  },
  {
    emoji: "🌧️",
    title: "For when you're feeling low",
    message:
      "You don't have to pretend to be okay. Your feelings deserve space, even when you can't explain them. Be gentle with yourself today.",
    prompt: "What would you say to a friend who felt the way you do?",
    color: "#8FA8D4",
  },
  {
    emoji: "🌿",
    title: "A little reminder to slow down",
    message:
      "You are allowed to move at your own pace. You don't have to compare your journey with someone else's.",
    prompt: "Can you take five quiet minutes just for yourself?",
    color: "#8FC9C0",
  },
  {
    emoji: "☀️",
    title: "For when you need a little hope",
    message:
      "A difficult day isn't the whole story. Small moments of comfort count, and you are allowed to begin again tomorrow.",
    prompt: "What is one small thing that might make today a little easier?",
    color: "#E8C98A",
  },
  {
    emoji: "✨",
    title: "For when you forget your worth",
    message:
      "You are more than your grades, productivity, mistakes, or what other people think of you. You deserve kindness, including from yourself.",
    prompt: "What is one quality you appreciate about yourself?",
    color: "#E5A9C8",
  },
];

const CHECKIN_MOODS = [
  ...MOODS.filter(
    (mood) => !["Anxious", "Sad", "Tired", "Overwhelmed", "Stressed"].includes(mood.name)
  ),
  ...MOODS.filter((mood) =>
    ["Anxious", "Overwhelmed", "Stressed", "Sad", "Tired"].includes(mood.name)
  ),
];

const GROUNDING_STEPS = [
  {
    number: 5,
    emoji: "👀",
    sense: "things you can SEE",
    prompt: "Look around slowly. Name five things you can see.",
  },
  {
    number: 4,
    emoji: "🤲",
    sense: "things you can FEEL",
    prompt:
      "Notice four things you can physically feel, like your feet on the floor or the fabric of your clothes.",
  },
  {
    number: 3,
    emoji: "👂",
    sense: "things you can HEAR",
    prompt: "Listen gently. Notice three sounds around you.",
  },
  {
    number: 2,
    emoji: "🌸",
    sense: "things you can SMELL",
    prompt:
      "Notice two smells, if you can. It's okay if you can't identify any.",
  },
  {
    number: 1,
    emoji: "🍃",
    sense: "thing you can TASTE",
    prompt:
      "Notice one taste, or choose another comfortable sensation if tasting isn't suitable.",
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

  // Login check-in popup
  const [showLoginCheckin, setShowLoginCheckin] = useState(true);
  const [loginMood, setLoginMood] = useState("");
  const [showExerciseChoice, setShowExerciseChoice] = useState(false);

  // Daily check-in
  const [selectedMood, setSelectedMood] = useState("");
  const [checkinText, setCheckinText] = useState("");
  const [todayCheckin, setTodayCheckin] = useState(null);

  // Journal
  const [journalText, setJournalText] = useState("");
  const [journalMood, setJournalMood] = useState("");
  const [journalEntries, setJournalEntries] = useState([]);
  const [calendarDate, setCalendarDate] = useState(todayKey());

  // Trusted contacts
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contacts, setContacts] = useState([]);

  // Breathing
  const [breathing, setBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState("Ready when you are");
  const [breathCount, setBreathCount] = useState(0);

  // Grounding
  const [groundingStep, setGroundingStep] = useState(0);

  // Mood Cards
  const [moodCardIndex, setMoodCardIndex] = useState(0);

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

        const savedCheckin =
          checkins.find((item) => item.date === todayKey()) || null;

        setTodayCheckin(savedCheckin);

        if (savedCheckin) {
          setSelectedMood(savedCheckin.mood || "");
          setCheckinText(savedCheckin.reflection || "");
        }

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

  // Four equal phases for box breathing.
  useEffect(() => {
    if (!breathing) return;

    const phases = [
      { label: "Breathe in gently…", duration: 4000, count: 1 },
      { label: "Hold gently…", duration: 4000, count: 0 },
      { label: "Breathe out slowly…", duration: 4000, count: 0 },
      { label: "Rest gently…", duration: 4000, count: 0 },
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

  function chooseLoginMood(mood) {
    setLoginMood(mood);
    setSelectedMood(mood);

    if (["Anxious", "Overwhelmed", "Stressed"].includes(mood)) {
      setShowExerciseChoice(true);
    } else {
      setShowLoginCheckin(false);
      setShowExerciseChoice(false);
    }
  }

  function closeLoginCheckin() {
    setShowLoginCheckin(false);
    setShowExerciseChoice(false);
  }

  function startBoxBreathing() {
    setShowLoginCheckin(false);
    setShowExerciseChoice(false);
    setBreathCount(0);
    setBreathing(false);
    setPage("breathe");
  }

  function startGrounding() {
    setGroundingStep(0);
    setShowLoginCheckin(false);
    setShowExerciseChoice(false);
    setPage("grounding");
  }

  function renderLoginCheckin() {
    return (
      <div
        className="vc-checkin-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vc-checkin-title"
      >
        <section className="vc-card vc-checkin-popup">
          <button
            className="vc-checkin-close"
            type="button"
            onClick={closeLoginCheckin}
            aria-label="Close check-in"
          >
            ×
          </button>

          {!showExerciseChoice ? (
            <>
              <div className="vc-checkin-orb">✦</div>
              <p className="vc-eyebrow">A MOMENT JUST FOR YOU</p>
              <h2 id="vc-checkin-title">
                Hey, stargazer. How are you feeling? 💜
              </h2>
              <p className="vc-muted">
                No pressure to feel a certain way. Choose whatever feels closest.
              </p>

              <div className="vc-checkin-moods">
                {CHECKIN_MOODS.map((mood) => (
                  <button
                    key={mood.name}
                    type="button"
                    className={`vc-mood-option ${
                      loginMood === mood.name ? "selected" : ""
                    }`}
                    style={{ "--mood-color": mood.color }}
                    onClick={() => chooseLoginMood(mood.name)}
                  >
                    <span>{mood.emoji}</span>
                    {mood.name}
                  </button>
                ))}
              </div>

              <button
                className="vc-quiet"
                type="button"
                onClick={closeLoginCheckin}
              >
                Maybe later
              </button>
            </>
          ) : (
            <>
              <div className="vc-checkin-orb">🌿</div>
              <p className="vc-eyebrow">
                LET'S TAKE IT ONE STEP AT A TIME
              </p>
              <h2 id="vc-checkin-title">
                Feeling {loginMood.toLowerCase()} can be a lot.
              </h2>
              <p className="vc-muted">
                Would you like to try a short exercise together? You can skip it
                anytime.
              </p>

              <button
                className="vc-exercise-choice"
                type="button"
                onClick={startBoxBreathing}
              >
                <span>🌬️</span>
                <span>
                  <strong>Box breathing</strong>
                  <small>Breathe in, hold, breathe out, and pause.</small>
                </span>
                <span>→</span>
              </button>

              <button
                className="vc-exercise-choice"
                type="button"
                onClick={startGrounding}
              >
                <span>🌿</span>
                <span>
                  <strong>5-4-3-2-1 grounding</strong>
                  <small>Reconnect with the world around you.</small>
                </span>
                <span>→</span>
              </button>

              <button
                className="vc-quiet"
                type="button"
                onClick={closeLoginCheckin}
              >
                Not right now
              </button>
            </>
          )}
        </section>
      </div>
    );
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
            <h3>Focus &amp; Breathe</h3>
            <p className="vc-muted">
              A small breathing break, just for you.
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

          <button
            className="vc-card vc-feature"
            type="button"
            onClick={() => setPage("mood-cards")}
          >
            <span className="vc-feature-icon">✨</span>
            <h3>Mood Cards</h3>
            <p className="vc-muted">
              A little reminder for whatever kind of day you're having.
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
          Follow the four gentle phases at a comfortable pace. If focusing on
          your breath feels uncomfortable, stop and simply notice the room
          around you. You never need to force or hold your breath.
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
            : "Inhale, hold gently, exhale, then pause."}
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
              Begin box breathing
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
            onClick={() => {
              stopBreathing();
              setPage("home");
            }}
          >
            Back to home
          </button>
        </div>
      </section>
    );
  }

  function renderGrounding() {
    const step = GROUNDING_STEPS[groundingStep];

    return (
      <section className="vc-card vc-grounding">
        <p className="vc-eyebrow">HERE, IN THIS MOMENT</p>
        <h2>Let's ground ourselves 🌿</h2>
        <p className="vc-muted">
          There's no need to rush. Take each step at your own pace, and skip
          anything that doesn't feel comfortable.
        </p>

        {groundingStep < GROUNDING_STEPS.length ? (
          <div className="vc-grounding-step" aria-live="polite">
            <span className="vc-grounding-emoji">{step.emoji}</span>
            <p className="vc-grounding-number">{step.number}</p>
            <h3>{step.sense}</h3>
            <p>{step.prompt}</p>

            <div
              className="vc-grounding-progress"
              aria-label={`Step ${groundingStep + 1} of ${GROUNDING_STEPS.length}`}
            >
              {GROUNDING_STEPS.map((item, index) => (
                <span
                  key={item.number}
                  className={index <= groundingStep ? "active" : ""}
                />
              ))}
            </div>

            <div className="vc-actions">
              <button
                className="vc-primary"
                type="button"
                onClick={() => {
                  if (groundingStep === GROUNDING_STEPS.length - 1) {
                    setGroundingStep(GROUNDING_STEPS.length);
                  } else {
                    setGroundingStep((current) => current + 1);
                  }
                }}
              >
                {groundingStep === GROUNDING_STEPS.length - 1
                  ? "Finish exercise ✨"
                  : "Next step →"}
              </button>

              <button
                className="vc-quiet"
                type="button"
                onClick={() => {
                  setGroundingStep(0);
                  setPage("home");
                }}
              >
                Finish for now
              </button>
            </div>
          </div>
        ) : (
          <div className="vc-grounding-finish">
            <span className="vc-grounding-emoji">💜</span>
            <h3>You made space for yourself.</h3>
            <p className="vc-muted">
              Take a moment to notice how you feel. You don't have to feel
              completely different for this pause to count.
            </p>
            <button
              className="vc-primary"
              type="button"
              onClick={() => {
                setGroundingStep(0);
                setPage("home");
              }}
            >
              Back to my space
            </button>
          </div>
        )}
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
                    style={{
                      background: mood?.color || "#bda7ff",
                    }}
                  />
                </button>
              );
            })}
          </div>

          <h3>Pages from {calendarDate}</h3>

          {entriesForSelectedDate.length === 0 ? (
            <p className="vc-muted">
              No journal page for this date yet. That's okay; every day
              doesn't need to be documented.
            </p>
          ) : (
            entriesForSelectedDate.map((entry) => (
              <article className="vc-entry" key={entry.id}>
                <p className="vc-entry-mood">
                  {MOODS.find((item) => item.name === entry.mood)?.emoji ||
                    "🌙"}{" "}
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
                onClick={() =>
                  setCalendarDate(entry.date || todayKey())
                }
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
            If you need support, consider reaching out to someone you trust
            or a qualified professional.
          </p>

          {HELPLINES.map((line) => (
            <article className="vc-entry" key={line.number}>
              <h3>{line.name}</h3>
              <p>{line.detail}</p>
              <a href={`tel:${line.number}`}>Call {line.number}</a>
            </article>
          ))}

          <p className="vc-soft">
            If you or someone else is in immediate danger in India, call
            112. For mental health support, Tele-MANAS is available at
            14416.
          </p>
        </section>
      </>
    );
  }

  function renderMoodCards() {
    const card = MOOD_CARDS[moodCardIndex];

    return (
      <section className="vc-card vc-mood-cards-page">
        <p className="vc-eyebrow">A LITTLE KINDNESS FOR YOU ✦</p>
        <h2>Your Mood Cards</h2>
        <p className="vc-muted">
          A small reminder for whatever kind of day you're having.
          Take what you need, leave the rest.
        </p>

        <div
          className="vc-mood-card"
          style={{ "--mood-card-color": card.color }}
          aria-live="polite"
        >
          <div className="vc-mood-card-orb" aria-hidden="true">
            {card.emoji}
          </div>

          <p className="vc-mood-card-count">
            CARD {moodCardIndex + 1} OF {MOOD_CARDS.length}
          </p>

          <h3>{card.title}</h3>
          <p className="vc-mood-card-message">{card.message}</p>

          <div className="vc-mood-card-prompt">
            <span>✦ A gentle pause</span>
            <p>{card.prompt}</p>
          </div>
        </div>

        <div className="vc-mood-card-controls">
          <button
            type="button"
            className="vc-quiet"
            onClick={() =>
              setMoodCardIndex(
                (current) =>
                  (current - 1 + MOOD_CARDS.length) % MOOD_CARDS.length
              )
            }
          >
            ← Previous
          </button>

          <span className="vc-mood-card-dots">
            {MOOD_CARDS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={`vc-mood-card-dot ${
                  index === moodCardIndex ? "active" : ""
                }`}
                aria-label={`Show card ${index + 1}: ${item.title}`}
                aria-current={index === moodCardIndex ? "true" : undefined}
                onClick={() => setMoodCardIndex(index)}
              />
            ))}
          </span>

          <button
            type="button"
            className="vc-primary"
            onClick={() =>
              setMoodCardIndex(
                (current) => (current + 1) % MOOD_CARDS.length
              )
            }
          >
            Next card →
          </button>
        </div>

        <p className="vc-soft vc-mood-card-footer">
          You can come back to these reminders whenever you need a little
          breathing room. 💜
        </p>
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
    { id: "journal", label: "Journal", emoji: "📔" },
    { id: "support", label: "Support", emoji: "🫶" },
    { id: "mood-cards", label: "Mood Cards", emoji: "✨" },
    { id: "grounding", label: "Grounding", emoji: "🌿" },
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
      {page === "grounding" && renderGrounding()}
      {page === "journal" && renderJournal()}
      {page === "support" && renderSupport()}
      {page === "mood-cards" && renderMoodCards()}

      <footer className="vc-footer">
        Made with care, for the days that feel like a lot. ✦
      </footer>

      {showLoginCheckin && renderLoginCheckin()}
    </main>
  );
}

export default App;
