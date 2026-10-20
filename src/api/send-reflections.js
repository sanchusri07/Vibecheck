
import { Resend } from "resend";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TIME_ZONE = "Asia/Kolkata";
const resend = new Resend(process.env.RESEND_API_KEY);

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

function getISTParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function parseReflectionTime(value) {
  if (typeof value !== "string") return null;

  const match = value.trim().match(
    /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i
  );

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;

  return hour * 60 + minute;
}

async function claimEmail(db, id, nowMs) {
  const ref = db.collection("reflectionEmailSends").doc(id);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const previous = snapshot.exists ? snapshot.data() : null;

    if (previous?.status === "sent") return false;

    // Prevent overlapping jobs from claiming the same email.
    if (
      previous?.status === "sending" &&
      nowMs - (previous.claimedAtMs || 0) < 20 * 60 * 1000
    ) {
      return false;
    }

    tx.set(
      ref,
      {
        status: "sending",
        claimedAtMs: nowMs,
        updatedAt: new Date(nowMs).toISOString(),
      },
      { merge: true }
    );

    return true;
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.CRON_SECRET;

  if (
    !secret ||
    req.headers.authorization !== `Bearer ${secret}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Keep sending disabled until scheduling and consent are tested.
  if (process.env.ENABLE_REFLECTION_EMAILS !== "true") {
    return res.status(200).json({
      success: true,
      sendingEnabled: false,
      message: "Reflection emails are disabled.",
    });
  }

  try {
    const required = [
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "FIREBASE_SERVICE_ACCOUNT_JSON",
    ];

    for (const name of required) {
      if (!process.env[name]) {
        throw new Error(`Missing environment variable: ${name}`);
      }
    }

    const db = getFirestore(getAdminApp());
    const now = new Date();
    const parts = getISTParts(now);
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    const currentMinute =
      Number(parts.hour) * 60 + Number(parts.minute);

    const users = await db.collection("users").get();

    let due = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const userDoc of users.docs) {
      const user = userDoc.data();

      // Require opt-in AND a timestamp recording explicit consent.
      // We will add this consent timestamp to the frontend next.
      if (
        user.reflectionEmail !== true ||
        !user.reflectionEmailConsentAt
      ) {
        skipped++;
        continue;
      }

      if (
        typeof user.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
      ) {
        skipped++;
        continue;
      }

      const selectedMinute = parseReflectionTime(
        user.reflectionTime
      );

      if (
        selectedMinute === null ||
        selectedMinute > currentMinute
      ) {
        continue;
      }

      due++;

      const sendId = `${userDoc.id}_${today}`;
      const canSend = await claimEmail(db, sendId, Date.now());

      if (!canSend) {
        skipped++;
        continue;
      }

      const sendRef = db
        .collection("reflectionEmailSends")
        .doc(sendId);

      try {
        const { data, error } = await resend.emails.send(
          {
            from: process.env.EMAIL_FROM,
            to: user.email,
            subject: "Your VibeCheck evening reflection 💜",
            text: [
              "Hey there,",
              "",
              "Take a quiet moment for yourself today.",
              "",
              "What is one thing you felt today?",
              "What is one small thing you're grateful for?",
              "What is one kind thing you can do for yourself tomorrow?",
              "",
              "You don't need to have everything figured out.",
              "Take things one step at a time.",
              "",
              "With care,",
              "VibeCheck",
            ].join("\n"),
          },
          {
            idempotencyKey: `vibecheck-reflection-${sendId}`,
          }
        );

        if (error) {
          throw new Error(error.message || "Resend failed");
        }

        await sendRef.set(
          {
            status: "sent",
            sentAt: new Date().toISOString(),
            resendEmailId: data?.id || null,
          },
          { merge: true }
        );

        sent++;
      } catch (error) {
        // A later run can retry. The same Resend idempotency key
        // helps protect against duplicate API requests.
        await sendRef.set(
          {
            status: "failed",
            lastAttemptAt: new Date().toISOString(),
          },
          { merge: true }
        );

        console.error("Reflection email failed:", error.message);
        failed++;
      }
    }

    return res.status(200).json({
      success: true,
      dateIST: today,
      due,
      sent,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("Reflection job failed:", error.message);
    return res.status(500).json({
      error: "Reflection email job failed",
    });
  }
}
