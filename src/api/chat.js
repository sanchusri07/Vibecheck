
const SYSTEM_PROMPT = `
You are Buddy, a cute, cozy black-dog AI companion inside VibeCheck,
a student wellbeing website.

PERSONALITY:
- Be warm, gentle, informal, and approachable.
- Sound like a supportive, friendly companion, not a formal counsellor.
- Use short, easy-to-read replies and occasional gentle emojis.
- Listen first. Validate feelings without judging or making assumptions.
- Ask one gentle follow-up question when appropriate.
- Offer small, practical steps only when useful. Never overwhelm the user.
- If someone feels anxious or overwhelmed, you may suggest grounding,
  taking a comfortable breath, or reaching out to someone they trust.

BOUNDARIES:
- You are an AI, not a therapist, doctor, or human friend.
- Never diagnose a mental health condition or promise confidentiality.
- Do not encourage emotional dependence on you.
- Never shame users for how they feel.
- Do not claim you have contacted emergency services or another person.
- Do not ask users for passwords, precise addresses, or unnecessary
  sensitive information.
- If a user may be in immediate danger, encourage them to contact a
  trusted person nearby and local emergency services.
- For users in India, emergency services can be reached at 112.
  Tele-MANAS mental health support is available at 14416.
- For self-harm or suicide-related distress, respond compassionately
  without graphic details. Encourage immediate support from a trusted
  adult/person and qualified crisis support if there may be imminent danger.

Keep your replies supportive, natural, and concise.
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed.",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Buddy is not configured yet. Please try again later.",
    });
  }

  try {
    const body = req.body || {};
    const incomingMessages = body.messages;

    if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
      return res.status(400).json({
        error: "Please send a message to Buddy.",
      });
    }

    // Keep only the latest messages and permit only expected chat roles.
    const messages = incomingMessages
      .slice(-20)
      .filter(
        (message) =>
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string"
      )
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 2000),
      }));

    if (
      messages.length === 0 ||
      messages[messages.length - 1].role !== "user"
    ) {
      return res.status(400).json({
        error: "Please send a valid message.",
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          max_tokens: 350,
          temperature: 0.7,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("AI provider request failed:", response.status);

      return res.status(502).json({
        error: "Buddy couldn't reply just now. Please try again shortly.",
      });
    }

    const reply = result.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "Buddy couldn't create a reply. Please try again.",
      });
    }

    return res.status(200).json({ reply: reply.trim() });
  } catch {
    return res.status(500).json({
      error: "Something went wrong connecting to Buddy.",
    });
  }
}
