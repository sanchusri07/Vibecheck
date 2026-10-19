
import React, { useEffect, useMemo, useState } from "react";
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import "./App.css";

const EMOTIONS = [
  { name: "Happy", emoji: "☀️", question: "When do you feel happy?", hint: "What moments make you smile or feel alive?" },
  { name: "Sad", emoji: "🌧️", question: "When do you feel sad?", hint: "Are there moments, situations, or thoughts that bring sadness?" },
  { name: "Anxious", emoji: "🫧", question: "When do you feel anxious?", hint: "What tends to make you worried, nervous, or overwhelmed?" },
  { name: "Calm", emoji: "🌿", question: "When do you feel calm?", hint: "Where are you, or what are you doing, when you feel at peace?" },
  { name: "Tired", emoji: "🌙", question: "When do you feel tired?", hint: "When do you feel drained, mentally or physically?" },
  { name: "Excited", emoji: "✨", question: "When do you feel excited?", hint: "What makes you look forward to something?" }
];

const TIMES = ["8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM"];

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

  useEffect(() => onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);
    if (!currentUser) {
      setLoading(false);
      return;
    }
    try {
      const ref = doc(db, "users", currentUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setName(data.name || "");
        setColour(data.colour || "#bda7ff");
        setAnswers(data.emotionAnswers || {});
        setJournal(data.journal || []);
        setReflectionTime(data.reflectionTime || "9:00 PM");
        setReflectionEmail(data.reflectionEmail ?? true);
        if (!data.onboardingCompleted) setPage("setup");
      } else {
        const initial = {
          email: currentUser.email || "",
          buddyCode: makeBuddyCode(currentUser.uid),
          createdAt: serverTimestamp()
        };
        await setDoc(ref, initial);
        setProfile(initial);
        setPage("setup");
      }
    } catch (e) {
      setError("Couldn't load your VibeCheck profile. Check your Firestore setup and rules.");
      setPage("setup");
    } finally {
      setLoading(false);
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    const unsubRequests = onSnapshot(
      query(collection(db, "buddyRequests"), where("toUid", "==", user.uid)),
      snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    const unsubSent = onSnapshot(
      query(collection(db, "buddyRequests"), where("fromUid", "==", user.uid)),
      snap => setSentRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    const unsubConnections = onSnapshot(
      query(collection(db, "buddyConnections"), where("members", "array-contains", user.uid)),
      snap => setConnections(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => { unsubRequests(); unsubSent(); unsubConnections(); };
  }, [user]);

  const currentEmotion = EMOTIONS[emotionIndex];

  async function saveSetup() {
    setError("");
    try {
      const updated = {
        name: name.trim() || "Friend",
        colour,
        emotionAnswers: answers,
        selfTalk,
        supportStyle,
        reflectionTime,
        reflectionEmail,
        onboardingCompleted: true,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, "users", user.uid), updated, { merge: true });
      setProfile(prev => ({ ...prev, ...updated }));
      setPage("home");
      setMessage("Your space is ready. Take it one moment at a time 💜");
    } catch (e) {
      setError("Couldn't save your preferences. Check that Firestore is enabled and its rules are published.");
    }
  }

  function nextEmotion() {
    if (emotionIndex < EMOTIONS.length - 1) {
      setEmotionIndex(i => i + 1);
    } else {
      setSetupStep(2);
    }
  }

  async function saveJournal() {
    if (!mood && !journalText.trim() && !gratitude.trim()) {
      setError("Choose a mood or write a little something before saving.");
      return;
    }
    const entry = {
      id: `${Date.now()}`,
      mood,
      text: journalText.trim(),
      gratitude: gratitude.trim(),
      date: new Date().toISOString()
    };
    try {
      const next = [entry, ...journal];
      await setDoc(doc(db, "users", user.uid), { journal: next }, { merge: true });
      setJournal(next);
      setMood("");
      setJournalText("");
      setGratitude("");
      setError("");
      setMessage("Saved gently to your private journal 💜");
      setPage("journal");
    } catch {
      setError("Couldn't save your journal entry. Please try again.");
    }
  }

  async function sendBuddyRequest() {
    setError("");
    setMessage("");
    const code = buddyCode.trim().toUpperCase();
    if (!code) return setError("Enter your friend's Vibe Buddy code.");
    if (code === profile?.buddyCode) return setError("That's your own code. Ask a friend for theirs.");
    try {
      const found = await getDocs(query(collection(db, "users"), where("buddyCode", "==", code)));
      if (found.empty) return setError("We couldn't find that code. Check it with your friend.");
      const friend = found.docs[0];
      if (friend.id === user.uid) return setError("That's your own code.");
      const already = await getDocs(query(collection(db, "buddyConnections"), where("members", "array-contains", user.uid)));
      if (already.docs.some(d => (d.data().members || []).includes(friend.id))) {
        return setError("You're already connected with this buddy.");
      }
      const pending = await getDocs(query(collection(db, "buddyRequests"), where("fromUid", "==", user.uid), where("toUid", "==", friend.id), where("status", "==", "pending")));
      if (!pending.empty) return setError("You've already sent a request to this person.");
      await addDoc(collection(db, "buddyRequests"), {
        fromUid: user.uid,
        fromName: profile?.name || name || "A VibeCheck user",
        toUid: friend.id,
        status: "pending",
        createdAt: serverTimestamp()
      });
      setMessage("Buddy request sent! They'll need to accept before you connect.");
      setBuddyCode("");
    } catch {
      setError("Couldn't send the request. Check your Firestore rules and try again.");
    }
  }

  async function respondToRequest(request, accept) {
    try {
      await updateDoc(doc(db, "buddyRequests", request.id), {
        status: accept ? "accepted" : "declined",
        respondedAt: serverTimestamp()
      });
      if (accept) {
        const id = [request.fromUid, user.uid].sort().join("_");
        await setDoc(doc(db, "buddyConnections", id), {
          members: [request.fromUid, user.uid],
          names: { [request.fromUid]: request.fromName || "Buddy", [user.uid]: profile?.name || name || "Friend" },
          moodSharing: false,
          createdAt: serverTimestamp()
        });
      }
      setMessage(accept ? "You're connected! Mood sharing stays off until you choose to enable it." : "Request declined.");
    } catch {
      setError("Couldn't update that request. Check your Firestore rules.");
    }
  }

  async function toggleMoodSharing(connection) {
    try {
      await updateDoc(doc(db, "buddyConnections", connection.id), {
        moodSharing: !connection.moodSharing
      });
      setMessage("Sharing preference updated.");
    } catch {
      setError("Couldn't update sharing. Check your Firestore rules.");
    }
  }

  async function endConnection(connection) {
    if (!window.confirm("Disconnect from this Vibe Buddy?")) return;
    try {
      await updateDoc(doc(db, "buddyConnections", connection.id), { endedBy: user.uid, active: false });
      setMessage("Vibe Buddy connection ended.");
    } catch {
      setError("Couldn't end the connection. Check your Firestore rules.");
    }
  }

  if (loading) return <main className="vc-shell"><div className="vc-card"><p>Opening your safe space… 💜</p></div></main>;
  if (!user) return <main className="vc-shell"><div className="vc-card"><h1>Welcome to VibeCheck 💜</h1><p>Please sign in through your existing login screen to continue.</p></div></main>;

  if (page === "setup") {
    return (
      <main className="vc-shell">
        <section className="vc-card vc-setup">
          <p className="vc-eyebrow">YOUR SPACE · {setupStep === 1 ? `EMOTION ${emotionIndex + 1} OF ${EMOTIONS.length}` : `STEP ${setupStep + 1} OF 3`}</p>
          {setupStep === 0 && <>
            <h1>Let's make this space yours ✨</h1>
            <p className="vc-muted">What should we call you?</p>
            <label>Your name or nickname</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="A name that feels like you" />
            <label>Choose your favourite accent colour</label>
            <div className="vc-colours">{["#bda7ff", "#f6a8c8", "#9adbc5", "#f5cc83", "#9ec8ff"].map(c =>
              <button key={c} aria-label={`Choose ${c}`} className={`vc-colour ${colour === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setColour(c)} />
            )}</div>
            <button className="vc-primary" onClick={() => { setSetupStep(1); setEmotionIndex(0); }}>Let's talk about feelings →</button>
          </>}
          {setupStep === 1 && currentEmotion && <>
            <div className="vc-progress"><span style={{ width: `${((emotionIndex + 1) / EMOTIONS.length) * 100}%` }} /></div>
            <div className="vc-emotion">{currentEmotion.emoji}</div>
            <h1>{currentEmotion.question}</h1>
            <p className="vc-muted">{currentEmotion.hint}</p>
            <p className="vc-soft">Take your time. There's no right or wrong answer, and you can skip any question.</p>
            <textarea rows="4" value={answers[currentEmotion.name] || ""} onChange={e => setAnswers(a => ({ ...a, [currentEmotion.name]: e.target.value }))} placeholder="Tell me in your own words…" />
            <div className="vc-actions">
              <button className="vc-quiet" onClick={() => emotionIndex > 0 ? setEmotionIndex(i => i - 1) : setSetupStep(0)}>← Back</button>
              <button className="vc-primary" onClick={nextEmotion}>{emotionIndex === EMOTIONS.length - 1 ? "Continue →" : "Next feeling →"}</button>
            </div>
            <button className="vc-link" onClick={nextEmotion}>Skip this feeling</button>
          </>}
          {setupStep === 2 && <>
            <h1>How should we support you? 🌿</h1>
            <label>When your inner voice gets tough, what does it usually say?</label>
            <textarea rows="3" value={selfTalk} onChange={e => setSelfTalk(e.target.value)} placeholder="Only share what you're comfortable sharing…" />
            <label>What kind of support feels best?</label>
            <select value={supportStyle} onChange={e => setSupportStyle(e.target.value)}>
              <option>Gentle reassurance</option><option>Practical steps</option><option>Motivation</option><option>Space to reflect</option><option>A little humour</option>
            </select>
            <label>Nightly reflection email</label>
            <p className="vc-muted">Choose a time if you want email reflections. Automatic sending needs a separate email service.</p>
            <select value={reflectionTime} onChange={e => setReflectionTime(e.target.value)}>{TIMES.map(t => <option key={t}>{t}</option>)}</select>
            <label className="vc-check"><input type="checkbox" checked={reflectionEmail} onChange={e => setReflectionEmail(e.target.checked)} /> I'd like to receive nightly reflection emails.</label>
            <div className="vc-actions">
              <button className="vc-quiet" onClick={() => setSetupStep(1)}>← Back</button>
              <button className="vc-primary" onClick={saveSetup}>Finish my space 💜</button>
            </div>
          </>}
          {error && <p className="vc-error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="vc-shell">
      <header className="vc-header">
        <div><p className="vc-eyebrow">A SOFTER PLACE TO LAND</p><h1>VibeCheck <span>💜</span></h1><p className="vc-muted">Hey, {profile?.name || name || "friend"}. You don't have to have it all figured out.</p></div>
        <button className="vc-quiet" onClick={() => auth.signOut()}>Sign out</button>
      </header>
      <nav className="vc-nav">
        {[["home","Home"],["checkin","Mood check-in"],["journal","My journal"],["buddy","Vibe Buddy"],["settings","My space"]].map(([key,label]) =>
          <button key={key} className={page === key ? "active" : ""} onClick={() => { setPage(key); setError(""); setMessage(""); }}>{label}</button>
        )}
      </nav>
      {message && <p className="vc-success">{message}</p>}
      {error && <p className="vc-error">{error}</p>}
      {page === "home" && <section className="vc-card"><p className="vc-eyebrow">A SMALL CHECK-IN</p><h2>How are you arriving today?</h2><p className="vc-muted">You can feel more than one thing at a time.</p><div className="vc-moods">{["😊 Happy","😔 Sad","😰 Anxious","🌿 Calm","🥱 Tired","✨ Excited"].map(m => <button key={m} className={mood === m ? "selected" : ""} onClick={() => setMood(m)}>{m}</button>)}</div><button className="vc-primary" onClick={() => setPage("checkin")}>Write a little about it →</button><div className="vc-divider" /><h3>A gentle reminder</h3><p className="vc-muted">You don't need to earn rest, kindness, or support. You deserve them already.</p></section>}
      {page === "checkin" && <section className="vc-card"><h2>Make room for how you feel 🌙</h2><label>Today's mood</label><div className="vc-moods">{["😊 Happy","😔 Sad","😰 Anxious","🌿 Calm","🥱 Tired","✨ Excited"].map(m => <button key={m} className={mood === m ? "selected" : ""} onClick={() => setMood(m)}>{m}</button>)}</div><label>What's on your mind?</label><textarea rows="5" value={journalText} onChange={e => setJournalText(e.target.value)} placeholder="No need to make it sound perfect…" /><label>One thing you're grateful for (big or small)</label><textarea rows="2" value={gratitude} onChange={e => setGratitude(e.target.value)} placeholder="Something, someone, or even a tiny moment…" /><button className="vc-primary" onClick={saveJournal}>Save to my journal 💜</button></section>}
      {page === "journal" && <section className="vc-card"><h2>Your journal 📖</h2><p className="vc-muted">Only you can read your journal entries.</p>{journal.length === 0 ? <p className="vc-soft">Your page is open. Add a mood check-in whenever you're ready.</p> : journal.map(entry => <article className="vc-entry" key={entry.id}><p className="vc-eyebrow">{new Date(entry.date).toLocaleString()}</p>{entry.mood && <h3>{entry.mood}</h3>}{entry.text && <p>{entry.text}</p>}{entry.gratitude && <p className="vc-muted">Grateful for: {entry.gratitude}</p>}</article>)}</section>}
      {page === "buddy" && <section className="vc-card"><p className="vc-eyebrow">FRIENDSHIP, NOT FIXING</p><h2>Your Vibe Buddy 🤝</h2><p className="vc-muted">Connect with someone you trust. They must accept your request before you're connected.</p><div className="vc-codebox"><span>Your buddy code</span><strong>{profile?.buddyCode || makeBuddyCode(user.uid)}</strong><button className="vc-quiet" onClick={() => navigator.clipboard?.writeText(profile?.buddyCode || makeBuddyCode(user.uid))}>Copy code</button></div><label>Enter your friend's buddy code</label><input value={buddyCode} onChange={e => setBuddyCode(e.target.value)} placeholder="Their 8-character code" /><button className="vc-primary" onClick={sendBuddyRequest}>Send buddy request</button>
        <h3>Requests for you</h3>{requests.filter(r => r.status === "pending").length === 0 ? <p className="vc-soft">No new requests right now.</p> : requests.filter(r => r.status === "pending").map(r => <article className="vc-entry" key={r.id}><p><strong>{r.fromName || "A VibeCheck user"}</strong> wants to connect.</p><div className="vc-actions"><button className="vc-quiet" onClick={() => respondToRequest(r,false)}>Decline</button><button className="vc-primary" onClick={() => respondToRequest(r,true)}>Accept</button></div></article>)}
        <h3>Requests you've sent</h3>{sentRequests.filter(r => r.status === "pending").map(r => <p className="vc-soft" key={r.id}>Request pending…</p>)}
        <h3>Your connections</h3>{connections.filter(c => c.active !== false && !c.endedBy).length === 0 ? <p className="vc-soft">Your connections will appear here after a request is accepted.</p> : connections.filter(c => c.active !== false && !c.endedBy).map(c => <article className="vc-entry" key={c.id}><h3>You're connected 💜</h3><p className="vc-muted">Mood sharing is off by default. Turn it on only if you both want to share mood status.</p><div className="vc-actions"><button className="vc-quiet" onClick={() => toggleMoodSharing(c)}>{c.moodSharing ? "Turn mood sharing off" : "Turn mood sharing on"}</button><button className="vc-quiet" onClick={() => endConnection(c)}>Disconnect</button></div></article>)}
        <p className="vc-soft">Vibe Buddy is for mutual support, not professional care. Your journal, photos and private reflections are never shared through this feature.</p>
      </section>}
      {page === "settings" && <section className="vc-card"><h2>My space ⚙️</h2><label>Name or nickname</label><input value={name} onChange={e => setName(e.target.value)} /><label>Accent colour</label><div className="vc-colours">{["#bda7ff", "#f6a8c8", "#9adbc5", "#f5cc83", "#9ec8ff"].map(c => <button key={c} aria-label={`Choose ${c}`} className={`vc-colour ${colour === c ? "selected" : ""}`} style={{background:c}} onClick={() => setColour(c)} />)}</div><label>Preferred support style</label><select value={supportStyle} onChange={e => setSupportStyle(e.target.value)}><option>Gentle reassurance</option><option>Practical steps</option><option>Motivation</option><option>Space to reflect</option><option>A little humour</option></select><label>Nightly reflection time</label><select value={reflectionTime} onChange={e => setReflectionTime(e.target.value)}>{TIMES.map(t => <option key={t}>{t}</option>)}</select><label className="vc-check"><input type="checkbox" checked={reflectionEmail} onChange={e => setReflectionEmail(e.target.checked)} /> I want nightly reflection emails</label><button className="vc-primary" onClick={async () => { try { await setDoc(doc(db,"users",user.uid),{name:name.trim()||"Friend",colour,supportStyle,reflectionTime,reflectionEmail,updatedAt:serverTimestamp()},{merge:true}); setProfile(p=>({...p,name:name.trim()||"Friend",colour,supportStyle,reflectionTime,reflectionEmail})); setMessage("Your preferences are saved."); } catch { setError("Couldn't save your settings."); } }}>Save preferences</button><button className="vc-quiet" onClick={() => {setSetupStep(0);setEmotionIndex(0);setPage("setup");}}>Repeat my emotion check-in</button></section>}
      <footer className="vc-footer">Made with care. Your feelings are welcome here. 💜</footer>
    </main>
  );
}
