import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import QuietComfort from "./QuietComfort";
import "./App.css";

const EMOTIONS = [
  {
    name: "Happy",
    emoji: "☀️",
    question: "When do you feel happy?",
    hint: "What moments make you smile or feel alive?",
  },
  {
    name: "Sad",
    emoji: "🌧️",
    question: "When do you feel sad?",
    hint: "Are there moments, situations, or thoughts that bring sadness?",
  },
  {
    name: "Anxious",
    emoji: "🫧",
    question: "When do you feel anxious?",
    hint: "What tends to make you worried, nervous, or overwhelmed?",
  },
  {
    name: "Calm",
    emoji: "🌿",
    question: "When do you feel calm?",
    hint: "Where are you, or what are you doing, when you feel at peace?",
  },
  {
    name: "Tired",
    emoji: "🌙",
    question: "When do you feel tired?",
    hint: "When do you feel drained, mentally or physically?",
  },
  {
    name: "Excited",
    emoji: "✨",
    question: "When do you feel excited?",
    hint: "What makes you look forward to something?",
  },
];

const TIMES = [
  "8:00 PM",
  "8:30 PM",
  "9:00 PM",
  "9:30 PM",
  "10:00 PM",
  "10:30 PM",
  "11:00 PM",
];

const COLOURS = [
  "#bda7ff",
  "#f6a8c8",
  "#9adbc5",
  "#f5cc83",
  "#9ec8ff",
];

function makeBuddyCode(uid) {
  return uid.slice(-8).toUpperCase();
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const [page, setPage] = useState("home");
  const [setupStep, setSetupStep] = useState(0);
  const [emotionIndex, setEmotionIndex] = useState(0);

  const [answers, setAnswers] = useState({});
  const [name, setName] = useState("");
  const [colour, setColour] = useState("#bda7ff");
  const [supportStyle, setSupportStyle] = useState(
    "Gentle reassurance"
  );
  const [selfTalk, setSelfTalk] = useState("");
  const [reflectionTime, setReflectionTime] = useState("9:00 PM");
  const [reflectionEmail, setReflectionEmail] = useState(true);

  const [mood, setMood] = useState("");
  const [journalText, setJournalText] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [journal, setJournal] = useState([]);

  const [buddyCode, setBuddyCode] = useState("");
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [connections, setConnections] = useState([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load the signed-in user and their profile.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
          const data = snapshot.data();

          setProfile(data);
          setName(data.name || "");
          setColour(data.colour || "#bda7ff");
          setAnswers(data.emotionAnswers || {});
          setJournal(data.journal || []);
          setSupportStyle(
            data.supportStyle || "Gentle reassurance"
          );
          setSelfTalk(data.selfTalk || "");
          setReflectionTime(data.reflectionTime || "9:00 PM");
          setReflectionEmail(data.reflectionEmail ?? true);

          if (!data.onboardingCompleted) {
            setPage("setup");
          } else {
            setPage("home");
          }
        } else {
          const initialProfile = {
            email: currentUser.email || "",
            buddyCode: makeBuddyCode(currentUser.uid),
            createdAt: serverTimestamp(),
          };

          await setDoc(userRef, initialProfile);

          setProfile(initialProfile);
          setPage("setup");
        }
      } catch (err) {
        console.error("Loading VibeCheck profile failed:", err);
        setError(
          "Couldn't load your VibeCheck profile. Check your Firestore setup and rules."
        );
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Listen for buddy requests and connections.
  useEffect(() => {
    if (!user) {
      setRequests([]);
      setSentRequests([]);
      setConnections([]);
      return;
    }

    const unsubscribeRequests = onSnapshot(
      query(
        collection(db, "buddyRequests"),
        where("toUid", "==", user.uid)
      ),
      (snapshot) => {
        setRequests(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (err) => console.error("Buddy requests listener:", err)
    );

    const unsubscribeSent = onSnapshot(
      query(
        collection(db, "buddyRequests"),
        where("fromUid", "==", user.uid)
      ),
      (snapshot) => {
        setSentRequests(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (err) => console.error("Sent requests listener:", err)
    );

    const unsubscribeConnections = onSnapshot(
      query(
        collection(db, "buddyConnections"),
        where("members", "array-contains", user.uid)
      ),
      (snapshot) => {
        setConnections(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (err) => console.error("Connections listener:", err)
    );

    return () => {
      unsubscribeRequests();
      unsubscribeSent();
      unsubscribeConnections();
    };
  }, [user]);

  const currentEmotion = EMOTIONS[emotionIndex];

  // Save the initial setup.
  async function saveSetup() {
    if (!user) return;

    setError("");
    setMessage("");

    try {
      const updatedProfile = {
        name: name.trim() || "Friend",
        colour,
        emotionAnswers: answers,
        selfTalk,
        supportStyle,
        reflectionTime,
        reflectionEmail,
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        doc(db, "users", user.uid),
        updatedProfile,
        { merge: true }
      );

      setProfile((previous) => ({
        ...previous,
        ...updatedProfile,
      }));

      setPage("home");
      setMessage(
        "Your space is ready. Take it one moment at a time 💜"
      );
    } catch (err) {
      console.error("Saving setup failed:", err);
      setError(
        "Couldn't save your preferences. Check that Firestore is enabled and its rules are published."
      );
    }
  }

  function nextEmotion() {
    if (emotionIndex < EMOTIONS.length - 1) {
      setEmotionIndex((index) => index + 1);
    } else {
      setSetupStep(2);
    }
  }

  // Save a mood check-in to the user's journal.
  async function saveJournal() {
    if (!user) return;

    if (!mood && !journalText.trim() && !gratitude.trim()) {
      setError(
        "Choose a mood or write a little something before saving."
      );
      return;
    }

    const entry = {
      id: `${Date.now()}`,
      mood,
      text: journalText.trim(),
      gratitude: gratitude.trim(),
      date: new Date().toISOString(),
    };

    try {
      const updatedJournal = [entry, ...journal];

      await setDoc(
        doc(db, "users", user.uid),
        { journal: updatedJournal },
        { merge: true }
      );

      setJournal(updatedJournal);
      setMood("");
      setJournalText("");
      setGratitude("");
      setError("");
      setMessage("Saved gently to your private journal 💜");
      setPage("journal");
    } catch (err) {
      console.error("Saving journal failed:", err);
      setError("Couldn't save your journal entry. Please try again.");
    }
  }

  // Send a Vibe Buddy request.
  async function sendBuddyRequest() {
    if (!user) return;

    setError("");
    setMessage("");

    const code = buddyCode.trim().toUpperCase();

    if (!code) {
      setError("Enter your friend's Vibe Buddy code.");
      return;
    }

    if (code === profile?.buddyCode) {
      setError("That's your own code. Ask a friend for theirs.");
      return;
    }

    try {
      const foundUsers = await getDocs(
        query(
          collection(db, "users"),
          where("buddyCode", "==", code)
        )
      );

      if (foundUsers.empty) {
        setError("We couldn't find that code. Check it with your friend.");
        return;
      }

      const friend = foundUsers.docs[0];

      if (friend.id === user.uid) {
        setError("That's your own code.");
        return;
      }

      const existingConnections = await getDocs(
        query(
          collection(db, "buddyConnections"),
          where("members", "array-contains", user.uid)
        )
      );

      const alreadyConnected = existingConnections.docs.some(
        (item) => (item.data().members || []).includes(friend.id)
      );

      if (alreadyConnected) {
        setError("You're already connected with this buddy.");
        return;
      }

      const existingRequests = await getDocs(
        query(
          collection(db, "buddyRequests"),
          where("fromUid", "==", user.uid),
          where("toUid", "==", friend.id),
          where("status", "==", "pending")
        )
      );

      if (!existingRequests.empty) {
        setError("You've already sent a request to this person.");
        return;
      }

      await addDoc(collection(db, "buddyRequests"), {
        fromUid: user.uid,
        fromName: profile?.name || name || "A VibeCheck user",
        toUid: friend.id,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setMessage(
        "Buddy request sent! They'll need to accept before you connect."
      );
      setBuddyCode("");
    } catch (err) {
      console.error("Sending buddy request failed:", err);
      setError(
        "Couldn't send the request. Check your Firestore rules and try again."
      );
    }
  }

  // Accept or decline a buddy request.
  async function respondToRequest(request, accept) {
    if (!user) return;

    setError("");
    setMessage("");

    try {
      await updateDoc(doc(db, "buddyRequests", request.id), {
        status: accept ? "accepted" : "declined",
        respondedAt: serverTimestamp(),
      });

      if (accept) {
        const connectionId = [request.fromUid, user.uid]
          .sort()
          .join("_");

        await setDoc(
          doc(db, "buddyConnections", connectionId),
          {
            members: [request.fromUid, user.uid],
            names: {
              [request.fromUid]: request.fromName || "Buddy",
              [user.uid]: profile?.name || name || "Friend",
            },
            moodSharing: false,
            active: true,
            createdAt: serverTimestamp(),
          }
        );
      }

      setMessage(
        accept
          ? "You're connected! Mood sharing stays off until you choose to enable it."
          : "Request declined."
      );
    } catch (err) {
      console.error("Responding to buddy request failed:", err);
      setError("Couldn't update that request. Check your Firestore rules.");
    }
  }

  // Toggle mood sharing for an existing connection.
  async function toggleMoodSharing(connection) {
    setError("");
    setMessage("");

    try {
      await updateDoc(
        doc(db, "buddyConnections", connection.id),
        { moodSharing: !connection.moodSharing }
      );

      setMessage("Sharing preference updated.");
    } catch (err) {
      console.error("Updating mood sharing failed:", err);
      setError("Couldn't update sharing. Check your Firestore rules.");
    }
  }

  // Disconnect from a Vibe Buddy.
  async function endConnection(connection) {
    if (!user) return;

    const confirmed = window.confirm(
      "Disconnect from this Vibe Buddy?"
    );

    if (!confirmed) return;

    try {
      await updateDoc(
        doc(db, "buddyConnections", connection.id),
        {
          endedBy: user.uid,
          active: false,
        }
      );

      setMessage("Vibe Buddy connection ended.");
    } catch (err) {
      console.error("Ending buddy connection failed:", err);
      setError("Couldn't end the connection. Check your Firestore rules.");
    }
  }

  // Save settings without changing the user's journal or buddy data.
  async function saveSettings() {
    if (!user) return;

    setError("");
    setMessage("");

    const updatedSettings = {
      name: name.trim() || "Friend",
      colour,
      supportStyle,
      reflectionTime,
      reflectionEmail,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(
        doc(db, "users", user.uid),
        updatedSettings,
        { merge: true }
      );

      setProfile((previous) => ({
        ...previous,
        ...updatedSettings,
      }));

      setMessage("Your preferences are saved.");
    } catch (err) {
      console.error("Saving settings failed:", err);
      setError("Couldn't save your settings.");
    }
  }

  if (loading) {
    return (
      <main className="vc-shell">
        <div className="vc-card">
          <p>Opening your safe space… 💜</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="vc-shell">
        <div className="vc-card">
          <h1>Welcome to VibeCheck 💜</h1>
          <p>
            Please sign in through your existing login screen to continue.
          </p>
        </div>
      </main>
    );
  }

  // Onboarding screens.
  if (page === "setup") {
    return (
      <main className="vc-shell">
        <section className="vc-card vc-setup">
          <p className="vc-eyebrow">
            YOUR SPACE ·{" "}
            {setupStep === 1
              ? `EMOTION ${emotionIndex + 1} OF ${EMOTIONS.length}`
              : `STEP ${setupStep + 1} OF 3`}
          </p>

          {setupStep === 0 && (
            <>
              <h1>Let's make this space yours ✨</h1>
              <p className="vc-muted">What should we call you?</p>

              <label>Your name or nickname</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="A name that feels like you"
              />

              <label>Choose your favourite accent colour</label>
              <div className="vc-colours">
                {COLOURS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-label={`Choose ${item}`}
                    className={`vc-colour ${
                      colour === item ? "selected" : ""
                    }`}
                    style={{ background: item }}
                    onClick={() => setColour(item)}
                  />
                ))}
              </div>

              <button
                type="button"
                className="vc-primary"
                onClick={() => {
                  setSetupStep(1);
                  setEmotionIndex(0);
                }}
              >
                Let's talk about feelings →
              </button>
            </>
          )}

          {setupStep === 1 && currentEmotion && (
            <>
              <div className="vc-progress">
                <span
                  style={{
                    width: `${
                      ((emotionIndex + 1) / EMOTIONS.length) * 100
                    }%`,
                  }}
                />
              </div>

              <div className="vc-emotion">{currentEmotion.emoji}</div>
              <h1>{currentEmotion.question}</h1>
              <p className="vc-muted">{currentEmotion.hint}</p>
              <p className="vc-soft">
                Take your time. There's no right or wrong answer, and you can
                skip any question.
              </p>

              <textarea
                rows="4"
                value={answers[currentEmotion.name] || ""}
                onChange={(event) =>
                  setAnswers((previous) => ({
                    ...previous,
                    [currentEmotion.name]: event.target.value,
                  }))
                }
                placeholder="Tell me in your own words…"
              />

              <div className="vc-actions">
                <button
                  type="button"
                  className="vc-quiet"
                  onClick={() =>
                    emotionIndex > 0
                      ? setEmotionIndex((index) => index - 1)
                      : setSetupStep(0)
                  }
                >
                  ← Back
                </button>

                <button
                  type="button"
                  className="vc-primary"
                  onClick={nextEmotion}
                >
                  {emotionIndex === EMOTIONS.length - 1
                    ? "Continue →"
                    : "Next feeling →"}
                </button>
              </div>

              <button
                type="button"
                className="vc-link"
                onClick={nextEmotion}
              >
                Skip this feeling
              </button>
            </>
          )}

          {setupStep === 2 && (
            <>
              <h1>How should we support you? 🌿</h1>

              <label>
                When your inner voice gets tough, what does it usually say?
              </label>
              <textarea
                rows="3"
                value={selfTalk}
                onChange={(event) => setSelfTalk(event.target.value)}
                placeholder="Only share what you're comfortable sharing…"
              />

              <label>What kind of support feels best?</label>
              <select
                value={supportStyle}
                onChange={(event) => setSupportStyle(event.target.value)}
              >
                <option>Gentle reassurance</option>
                <option>Practical steps</option>
                <option>Motivation</option>
                <option>Space to reflect</option>
                <option>A little humour</option>
              </select>

              <label>Nightly reflection time</label>
              <p className="vc-muted">
                Automatic reflection emails require a separate email service.
              </p>
              <select
                value={reflectionTime}
                onChange={(event) => setReflectionTime(event.target.value)}
              >
                {TIMES.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>

              <label className="vc-check">
                <input
                  type="checkbox"
                  checked={reflectionEmail}
                  onChange={(event) =>
                    setReflectionEmail(event.target.checked)
                  }
                />
                I'd like to receive nightly reflection emails.
              </label>

              <div className="vc-actions">
                <button
                  type="button"
                  className="vc-quiet"
                  onClick={() => setSetupStep(1)}
                >
                  ← Back
                </button>

                <button
                  type="button"
                  className="vc-primary"
                  onClick={saveSetup}
                >
                  Finish my space 💜
                </button>
              </div>
            </>
          )}

          {error && <p className="vc-error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="vc-shell">
      {/* Daily mood-support popup */}
      <QuietComfort />

      <header className="vc-header">
        <div>
          <p className="vc-eyebrow">A SOFTER PLACE TO LAND</p>
          <h1>
            VibeCheck <span>💜</span>
          </h1>
          <p className="vc-muted">
            Hey, {profile?.name || name || "friend"}. You don't have to have
            it all figured out.
          </p>
        </div>

        <button
          type="button"
          className="vc-quiet"
          onClick={() => auth.signOut()}
        >
          Sign out
        </button>
      </header>

      <nav className="vc-nav">
        {[
          ["home", "Home"],
          ["checkin", "Mood check-in"],
          ["journal", "My journal"],
          ["buddy", "Vibe Buddy"],
          ["settings", "My space"],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={page === key ? "active" : ""}
            onClick={() => {
              setPage(key);
              setError("");
              setMessage("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {message && <p className="vc-success">{message}</p>}
      {error && <p className="vc-error">{error}</p>}

      {/* Home */}
      {page === "home" && (
        <section className="vc-card">
          <p className="vc-eyebrow">A SMALL CHECK-IN</p>
          <h2>How are you arriving today?</h2>
          <p className="vc-muted">
            You can feel more than one thing at a time.
          </p>

          <div className="vc-moods">
            {[
              "😊 Happy",
              "😔 Sad",
              "😰 Anxious",
              "🌿 Calm",
              "🥱 Tired",
              "✨ Excited",
            ].map((item) => (
              <button
                type="button"
                key={item}
                className={mood === item ? "selected" : ""}
                onClick={() => setMood(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="vc-primary"
            onClick={() => setPage("checkin")}
          >
            Write a little about it →
          </button>

          <div className="vc-divider" />

          <h3>A gentle reminder</h3>
          <p className="vc-muted">
            You don't need to earn rest, kindness, or support. You deserve
            them already.
          </p>
        </section>
      )}

      {/* Mood check-in */}
      {page === "checkin" && (
        <section className="vc-card">
          <h2>Make room for how you feel 🌙</h2>

          <label>Today's mood</label>
          <div className="vc-moods">
            {[
              "😊 Happy",
              "😔 Sad",
              "😰 Anxious",
              "🌿 Calm",
              "🥱 Tired",
              "✨ Excited",
            ].map((item) => (
              <button
                type="button"
                key={item}
                className={mood === item ? "selected" : ""}
                onClick={() => setMood(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <label>What's on your mind?</label>
          <textarea
            rows="5"
            value={journalText}
            onChange={(event) => setJournalText(event.target.value)}
            placeholder="No need to make it sound perfect…"
          />

          <label>One thing you're grateful for (big or small)</label>
          <textarea
            rows="2"
            value={gratitude}
            onChange={(event) => setGratitude(event.target.value)}
            placeholder="Something, someone, or even a tiny moment…"
          />

          <button
            type="button"
            className="vc-primary"
            onClick={saveJournal}
          >
            Save to my journal 💜
          </button>
        </section>
      )}

      {/* Journal */}
      {page === "journal" && (
        <section className="vc-card">
          <h2>Your journal 📖</h2>
          <p className="vc-muted">
            Only you can read your journal entries.
          </p>

          {journal.length === 0 ? (
            <p className="vc-soft">
              Your page is open. Add a mood check-in whenever you're ready.
            </p>
          ) : (
            journal.map((entry) => (
              <article className="vc-entry" key={entry.id}>
                <p className="vc-eyebrow">
                  {new Date(entry.date).toLocaleString()}
                </p>

                {entry.mood && <h3>{entry.mood}</h3>}
                {entry.text && <p>{entry.text}</p>}

                {entry.gratitude && (
                  <p className="vc-muted">
                    Grateful for: {entry.gratitude}
                  </p>
                )}
              </article>
            ))
          )}
        </section>
      )}

      {/* Vibe Buddy */}
      {page === "buddy" && (
        <section className="vc-card">
          <p className="vc-eyebrow">FRIENDSHIP, NOT FIXING</p>
          <h2>Your Vibe Buddy 🤝</h2>
          <p className="vc-muted">
            Connect with someone you trust. They must accept your request
            before you're connected.
          </p>

          <div className="vc-codebox">
            <span>Your buddy code</span>
            <strong>
              {profile?.buddyCode || makeBuddyCode(user.uid)}
            </strong>
            <button
              type="button"
              className="vc-quiet"
              onClick={() => {
                const code =
                  profile?.buddyCode || makeBuddyCode(user.uid);
                navigator.clipboard?.writeText(code);
                setMessage("Buddy code copied.");
              }}
            >
              Copy code
            </button>
          </div>

          <label>Enter your friend's buddy code</label>
          <input
            value={buddyCode}
            onChange={(event) => setBuddyCode(event.target.value)}
            placeholder="Their 8-character code"
          />

          <button
            type="button"
            className="vc-primary"
            onClick={sendBuddyRequest}
          >
            Send buddy request
          </button>

          <h3>Requests for you</h3>

          {requests.filter((item) => item.status === "pending").length ===
          0 ? (
            <p className="vc-soft">No new requests right now.</p>
          ) : (
            requests
              .filter((item) => item.status === "pending")
              .map((request) => (
                <article className="vc-entry" key={request.id}>
                  <p>
                    <strong>
                      {request.fromName || "A VibeCheck user"}
                    </strong>{" "}
                    wants to connect.
                  </p>

                  <div className="vc-actions">
                    <button
                      type="button"
                      className="vc-quiet"
                      onClick={() => respondToRequest(request, false)}
                    >
                      Decline
                    </button>

                    <button
                      type="button"
                      className="vc-primary"
                      onClick={() => respondToRequest(request, true)}
                    >
                      Accept
                    </button>
                  </div>
                </article>
              ))
          )}

          <h3>Requests you've sent</h3>

          {sentRequests
            .filter((item) => item.status === "pending")
            .map((request) => (
              <p className="vc-soft" key={request.id}>
                Request pending…
              </p>
            ))}

          <h3>Your connections</h3>

          {connections.filter(
            (item) => item.active !== false && !item.endedBy
          ).length === 0 ? (
            <p className="vc-soft">
              Your connections will appear here after a request is accepted.
            </p>
          ) : (
            connections
              .filter(
                (item) => item.active !== false && !item.endedBy
              )
              .map((connection) => (
                <article className="vc-entry" key={connection.id}>
                  <h3>You're connected 💜</h3>
                  <p className="vc-muted">
                    Mood sharing is off by default. Turn it on only if you
                    both want to share mood status.
                  </p>

                  <div className="vc-actions">
                    <button
                      type="button"
                      className="vc-quiet"
                      onClick={() => toggleMoodSharing(connection)}
                    >
                      {connection.moodSharing
                        ? "Turn mood sharing off"
                        : "Turn mood sharing on"}
                    </button>

                    <button
                      type="button"
                      className="vc-quiet"
                      onClick={() => endConnection(connection)}
                    >
                      Disconnect
                    </button>
                  </div>
                </article>
              ))
          )}

          <p className="vc-soft">
            Vibe Buddy is for mutual support, not professional care. Your
            journal and private reflections are not shared through this
            feature.
          </p>
        </section>
      )}

      {/* Settings */}
      {page === "settings" && (
        <section className="vc-card">
          <h2>My space ⚙️</h2>

          <label>Name or nickname</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <label>Accent colour</label>
          <div className="vc-colours">
            {COLOURS.map((item) => (
              <button
                type="button"
                key={item}
                aria-label={`Choose ${item}`}
                className={`vc-colour ${
                  colour === item ? "selected" : ""
                }`}
                style={{ background: item }}
                onClick={() => setColour(item)}
              />
            ))}
          </div>

          <label>Preferred support style</label>
          <select
            value={supportStyle}
            onChange={(event) => setSupportStyle(event.target.value)}
          >
            <option>Gentle reassurance</option>
            <option>Practical steps</option>
            <option>Motivation</option>
            <option>Space to reflect</option>
            <option>A little humour</option>
          </select>

          <label>Nightly reflection time</label>
          <select
            value={reflectionTime}
            onChange={(event) => setReflectionTime(event.target.value)}
          >
            {TIMES.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>

          <label className="vc-check">
            <input
              type="checkbox"
              checked={reflectionEmail}
              onChange={(event) =>
                setReflectionEmail(event.target.checked)
              }
            />
            I'd like to receive nightly reflection emails.
          </label>

          <div className="vc-actions">
            <button
              type="button"
              className="vc-primary"
              onClick={saveSettings}
            >
              Save preferences
            </button>

            <button
              type="button"
              className="vc-quiet"
              onClick={() => {
                setSetupStep(0);
                setEmotionIndex(0);
                setPage("setup");
              }}
            >
              Repeat my emotion check-in
            </button>
          </div>
        </section>
      )}

      <footer className="vc-footer">
        Made with care. Your feelings are welcome here. 💜
      </footer>
    </main>
  );
}