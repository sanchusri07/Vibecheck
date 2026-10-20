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
import "./App.css";
import QuietComfort from "./QuietComfort";

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
  const [supportStyle, setSupportStyle] = useState("Gentle reassurance");
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

  // Listen for the signed-in user and load their profile.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
          const data = userSnapshot.data();

          setProfile(data);
          setName(data.name || "");
          setColour(data.colour || "#bda7ff");
          setAnswers(data.emotionAnswers || {});
          setJournal(data.journal || []);
          setSelfTalk(data.selfTalk || "");
          setSupportStyle(data.supportStyle || "Gentle reassurance");
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
            onboardingCompleted: false,
          };

          await setDoc(userRef, initialProfile);

          setProfile(initialProfile);
          setName("");
          setPage("setup");
        }
      } catch (err) {
        console.error("Profile loading error:", err);
        setError(
          "Couldn't load your VibeCheck profile. Check your Firebase setup and Firestore rules."
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
      return undefined;
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
      (err) => console.error("Incoming requests error:", err)
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
      (err) => console.error("Sent requests error:", err)
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
      (err) => console.error("Buddy connections error:", err)
    );

    return () => {
      unsubscribeRequests();
      unsubscribeSent();
      unsubscribeConnections();
    };
  }, [user]);

  const currentEmotion = EMOTIONS[emotionIndex];

  function clearNotifications() {
    setError("");
    setMessage("");
  }

  // Save onboarding preferences.
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
      setMessage("Your space is ready. Take it one moment at a time 💜");
    } catch (err) {
      console.error("Saving onboarding error:", err);
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

  // Save a mood check-in to the user's private journal.
  async function saveJournal() {
    if (!user) return;

    if (!mood && !journalText.trim() && !gratitude.trim()) {
      setError("Choose a mood or write a little something before saving.");
      return;
    }

    const entry = {
      id: `${Date.now()}`,
      mood,
      text: journalText.trim(),
      gratitude: gratitude.trim(),
      date: new Date().toISOString(),
    };

    setError("");
    setMessage("");

    try {
      const nextJournal = [entry, ...journal];

      await setDoc(
        doc(db, "users", user.uid),
        { journal: nextJournal },
        { merge: true }
      );

      setJournal(nextJournal);
      setMood("");
      setJournalText("");
      setGratitude("");
      setMessage("Saved gently to your private journal 💜");
      setPage("journal");
    } catch (err) {
      console.error("Saving journal error:", err);
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
      const found = await getDocs(
        query(
          collection(db, "users"),
          where("buddyCode", "==", code)
        )
      );

      if (found.empty) {
        setError("We couldn't find that code. Check it with your friend.");
        return;
      }

      const friend = found.docs[0];

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

      const alreadyConnected = existingConnections.docs.some((item) => {
        const data = item.data();
        return (
          data.active !== false &&
          !data.endedBy &&
          (data.members || []).includes(friend.id)
        );
      });

      if (alreadyConnected) {
        setError("You're already connected with this buddy.");
        return;
      }

      const [outgoing, incoming] = await Promise.all([
        getDocs(
          query(
            collection(db, "buddyRequests"),
            where("fromUid", "==", user.uid),
            where("toUid", "==", friend.id),
            where("status", "==", "pending")
          )
        ),
        getDocs(
          query(
            collection(db, "buddyRequests"),
            where("fromUid", "==", friend.id),
            where("toUid", "==", user.uid),
            where("status", "==", "pending")
          )
        ),
      ]);

      if (!outgoing.empty || !incoming.empty) {
        setError("A request between you is already pending.");
        return;
      }

      await addDoc(collection(db, "buddyRequests"), {
        fromUid: user.uid,
        fromName: profile?.name || name || "A VibeCheck user",
        toUid: friend.id,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setMessage("Buddy request sent! They'll need to accept before you connect.");
      setBuddyCode("");
    } catch (err) {
      console.error("Sending buddy request error:", err);
      setError("Couldn't send the request. Check your Firestore rules and try again.");
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
        const members = [request.fromUid, user.uid].sort();
        const connectionId = members.join("_");

        await setDoc(doc(db, "buddyConnections", connectionId), {
          members,
          names: {
            [request.fromUid]: request.fromName || "Buddy",
            [user.uid]: profile?.name || name || "Friend",
          },
          moodSharing: false,
          active: true,
          createdAt: serverTimestamp(),
        });
      }

      setMessage(
        accept
          ? "You're connected! Mood sharing stays off until you choose to enable it."
          : "Request declined."
      );
    } catch (err) {
      console.error("Responding to buddy request error:", err);
      setError("Couldn't update that request. Check your Firestore rules.");
    }
  }

  // Turn mood sharing on or off for a connection.
  async function toggleMoodSharing(connection) {
    setError("");
    setMessage("");

    try {
      await updateDoc(doc(db, "buddyConnections", connection.id), {
        moodSharing: !connection.moodSharing,
      });

      setMessage("Sharing preference updated.");
    } catch (err) {
      console.error("Updating mood sharing error:", err);
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
      await updateDoc(doc(db, "buddyConnections", connection.id), {
        endedBy: user.uid,
        active: false,
      });

      setMessage("Vibe Buddy connection ended.");
    } catch (err) {
      console.error("Disconnecting buddy error:", err);
      setError("Couldn't end the connection. Check your Firestore rules.");
    }
  }

  // Loading screen.
  if (loading) {
    return (
      <main className="vc-shell">
        <div className="vc-card">
          <p>Opening your safe space… 💜</p>
        </div>
      </main>
    );
  }

  // Signed-out screen.
  // Keep your existing login/authentication flow if it is handled elsewhere.
  if (!user) {
    return (
      <main className="vc-shell">
        <div className="vc-card">
          <h1>Welcome to VibeCheck 💜</h1>
          <p>Please sign in through your existing login screen to continue.</p>
        </div>
      </main>
    );
  }

  // Onboarding screen.
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
                {["#bda7ff", "#f6a8c8", "#9adbc5", "#f5cc83", "#9ec8ff"].map(
                  (item) => (
                    <button
                      key={item}
                      type="button"
                      aria-label={`Choose ${item}`}
                      className={`vc-colour ${colour === item ? "selected" : ""}`}
                      style={{ background: item }}
                      onClick={() => setColour(item)}
                    />
                  )
                )}
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
                    width: `${((emotionIndex + 1) / EMOTIONS.length) * 100}%`,
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
                rows={4}
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
                rows={3}
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

              <label>Nightly reflection email</label>
              <p className="vc-muted">
                Choose a time if you want email reflections. Automatic sending
                needs a separate email service.
              </p>

              <select
                value={reflectionTime}
                onChange={(event) => setReflectionTime(event.target.value)}
              >
                {TIMES.map((time) => (
                  <option key={time}>{time}</option>
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