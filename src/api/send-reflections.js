import { Resend } from "resend";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const db = getFirestore(getAdminApp());
    const snapshot = await db.collection("users").get();

    let eligible = 0;

    for (const doc of snapshot.docs) {
      const user = doc.data();

      // Require explicit opt-in and a valid email.
      if (user.reflectionEmail !== true) continue;
      if (
        typeof user.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
      ) {
        continue;
      }

      eligible++;

      // Intentionally generic: never include journal contents.
      const result = await resend.emails.send({
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
      });

      if (result.error