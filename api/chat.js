
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }
  
    // Read the API key securely from Vercel
    const apiKey = process.env.OPENAI_API_KEY;
  
    if (!apiKey) {
      console.error("OPENAI_API_KEY is missing.");
  
      return res.status(500).json({
        error: "The chatbot is not configured yet.",
      });
    }
  
    try {
      const { messages } = req.body || {};
  
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          error: "Please send a message to Buddy.",
        });
      }
  
      // Accept only valid chat messages
      const safeMessages = messages
        .filter(
          (message) =>
            message &&
            ["user", "assistant"].includes(message.role) &&
            typeof message.content === "string"
        )
        .slice(-20)
        .map((message) => ({
          role: message.role,
          content: message.content.slice(0, 2000),
        }));
  
      if (
        safeMessages.length === 0 ||
        !safeMessages.some((message) => message.role === "user")
      ) {
        return res.status(400).json({
          error: "No valid message was provided.",
        });
      }
  
      // Buddy's personality and safety boundaries
      const systemPrompt = `
  You are Buddy, a cute, friendly black-dog AI companion
  inside VibeCheck, a student well-being website.
  
  Be warm, gentle, informal, supportive, and non-judgmental.
  Use simple language and occasional paw or dog emojis.
  Listen first and avoid overwhelming the user with advice.
  Offer one small, practical next step when helpful.
  For anxiety, you can suggest gentle breathing or grounding.
  Never claim to be a human, doctor, or therapist.
  Never diagnose or promise confidentiality.
  Encourage reaching out to a trusted person or qualified
  professional when additional support is needed.
  If someone may be in immediate danger, encourage them to
  contact local emergency services and a trusted person.
  In India, emergency number 112 and Tele-MANAS 14416
  may be relevant support options.
      `.trim();
  
      // Send the conversation to OpenAI
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              ...safeMessages,
            ],
            max_tokens: 350,
            temperature: 0.7,
          }),
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        // Keep secret keys and sensitive details out of the response
        console.error(
          "OpenAI API error:",
          response.status,
          data.error?.message || "Unknown API error"
        );
  
        return res.status(502).json({
          error:
            response.status === 401
              ? "The AI API key was rejected. Please check the server settings."
              : response.status === 429
              ? "The AI service has reached a usage limit. Please check API billing and limits."
              : "Buddy couldn't get a reply right now. Please try again.",
        });
      }
  
      const reply = data.choices?.[0]?.message?.content;
  
      if (!reply) {
        return res.status(502).json({
          error: "Buddy received an empty reply. Please try again.",
        });
      }
  
      return res.status(200).json({ reply });
    } catch (error) {
      console.error("Buddy server error:", error.message);
  
      return res.status(500).json({
        error: "Buddy couldn't connect. Please try again shortly.",
      });
    }
  }
  
