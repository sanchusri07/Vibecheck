
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  reload,
} from "firebase/auth";

import { auth } from "./firebase";
import App from "./App";
import "./AuthGate.css";

export default function AuthGate() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.emailVerified) {
        await signOut(auth);
        setUser(null);
      } else {
        setUser(currentUser);
      }
      setChecking(false);
    });

    return unsubscribe;
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Please enter your name.");

        const result = await createUserWithEmailAndPassword(
          auth, email.trim(), password
        );

        await sendEmailVerification(result.user);
        await signOut(auth);

        setMode("login");
        setMessage(
          "Account created! Check your email and click the verification link before logging in."
        );
      } else {
        const result = await signInWithEmailAndPassword(
          auth, email.trim(), password
        );

        await reload(result.user);

        if (!result.user.emailVerified) {
          await signOut(auth);
          setMessage("Please verify your email first. Check your inbox or spam folder.");
          return;
        }

        setUser(result.user);
      }
    } catch (error) {
      const messages = {
        "auth/email-already-in-use": "This email already has an account. Try logging in.",
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Choose a password with at least 6 characters.",
        "auth/invalid-credential": "Email or password is incorrect.",
        "auth/too-many-requests": "Too many attempts. Try again later.",
        "auth/network-request-failed": "Check your internet connection.",
      };

      setMessage(messages[error.code] || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setMessage("");

    if (!email.trim()) {
      setMessage("Enter your email address first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("If an account exists for this email, a password reset email has been sent.");
    } catch {
      setMessage("Couldn't send the reset email. Check the email address and try again.");
    }
  }

  async function resendVerification() {
    setMessage("");

    try {
      const result = await signInWithEmailAndPassword(
        auth, email.trim(), password
      );
      await reload(result.user);

      if (result.user.emailVerified) {
        setMessage("Your email is verified! You can now log in.");
      } else {
        await sendEmailVerification(result.user);
        setMessage("A new verification email has been sent. Check your inbox and spam folder.");
      }

      await signOut(auth);
    } catch {
      setMessage("Enter the correct email and password, then try again.");
    }
  }

  if (checking) {
    return <div className="auth-loading">Opening your VibeCheck space…</div>;
  }

  if (user) {
    return (
      <div className="authenticated-app">
        <button className="logout-button" onClick={() => signOut(auth)}>
          Log out
        </button>
        <App />
      </div>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-orb">✦</div>
        <p className="auth-eyebrow">YOUR LITTLE CORNER OF THE UNIVERSE</p>
        <h1>Welcome to VibeCheck</h1>
        <p className="auth-subtitle">Every feeling deserves a little space.</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => { setMode("signup"); setMessage(""); }}
          >
            Sign up
          </button>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => { setMode("login"); setMessage(""); }}
          >
            Log in
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>

          {mode === "login" && (
            <button type="button" className="text-button" onClick={resetPassword}>
              Forgot password?
            </button>
          )}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "One moment…" : mode === "signup" ? "Create my account ✨" : "Enter my space 🌙"}
          </button>
        </form>

        {mode === "login" && (
          <button type="button" className="text-button resend-button" onClick={resendVerification}>
            Resend verification email
          </button>
        )}

        {message && <p className="auth-message" role="status">{message}</p>}

        <p className="auth-footer">
          A gentle reminder: you don't have to feel okay every day. 💜
        </p>
      </section>
    </main>
  );
}
