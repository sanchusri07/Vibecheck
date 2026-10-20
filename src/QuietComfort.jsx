
import React, { useEffect, useRef, useState } from "react";
import "./QuietComfort.css";

const moods = [
  "😊 Happy",
  "😌 Okay",
  "🌿 Calm",
  "😣 Stressed",
  "😰 Anxious",
  "😴 Exhausted",
  "🫠 Overwhelmed",
  "🌧️ Sad",
  "🫂 Lonely",
  "💭 I don't know",
];

const difficultMoods = [
  "😣 Stressed",
  "😰 Anxious",
  "😴 Exhausted",
  "🫠 Overwhelmed",
  "🌧️ Sad",
  "🫂 Lonely",
  "💭 I don't know",
];

const groundingSteps = [
  {
    title: "5 things you can SEE",
    instruction:
      "Look around slowly. Notice five things you can see. They can be big, small, near, or far away.",
  },
  {
    title: "4 things you can FEEL",
    instruction:
      "Notice four things you can physically feel, like your feet on the floor or your clothes against your skin.",
  },
  {
    title: "3 things you can HEAR",
    instruction:
      "Pause and listen carefully. Notice three sounds around you, even if they are quiet.",
  },
  {
    title: "2 things you can SMELL",
    instruction:
      "Notice two scents around you, if available. You don't need to find anything special.",
  },
  {
    title: "1 thing you can TASTE",
    instruction:
      "Notice one taste in your mouth, or take a sip of water if you have some nearby.",
  },
];

export default function QuietComfort() {
  const [open, setOpen] = useState(true);
  const [screen, setScreen] = useState("mood");
  const [selectedMood, setSelectedMood] = useState("");
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioUrlRef = useRef("");
  const discardRecordingRef = useRef(false);

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  function clearAudio() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }
    setAudioUrl("");
  }

  function closePopup() {
    discardRecordingRef.current = true;

    if (recorderRef.current?.state !== "inactive" && recorderRef.current) {
      recorderRef.current.stop();
    }

    releaseMicrophone();
    stopSpeaking();
    clearAudio();
    setRecording(false);
    setOpen(false);
  }

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      if (recorderRef.current?.state !== "inactive" && recorderRef.current) {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }

      releaseMicrophone();

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      setError("Spoken guidance isn't supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  async function startRecording() {
    setError("");

    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder
    ) {
      setError("Voice recording isn't supported by this browser.");
      return;
    }

    try {
      clearAudio();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];
      discardRecordingRef.current = false;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        releaseMicrophone();
        setRecording(false);

        if (
          !discardRecordingRef.current &&
          chunksRef.current.length > 0
        ) {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });

          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          setAudioUrl(url);
        }

        chunksRef.current = [];
      };

      recorder.start();
      setRecording(true);
    } catch {
      releaseMicrophone();
      setError(
        "Microphone access wasn't available. You can continue without a voice note."
      );
    }
  }

  function stopRecording() {
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }
  }

  function continueFromMood() {
    if (!selectedMood) {
      setError("Choose how you're feeling first 💜");
      return;
    }

    setError("");
    stopSpeaking();

    if (difficultMoods.includes(selectedMood)) {
      setScreen("grounding");
      setStep(0);
    } else {
      setScreen("gentle");
    }
  }

  function nextStep() {
    stopSpeaking();
    setError("");

    if (step < groundingSteps.length - 1) {
      setStep((current) => current + 1);
    } else {
      setScreen("finished");
    }
  }

  if (!open) return null;

  const currentStep = groundingSteps[step];

  return (
    <div
      className="qc-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePopup();
      }}
    >
      <section
        className="qc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qc-title"
      >
        <button
          className="qc-close"
          type="button"
          onClick={closePopup}
          aria-label="Close"
        >
          ×
        </button>

        {screen === "mood" && (
          <>
            <div className="qc-icon">♡</div>
            <p className="qc-eyebrow">YOUR SAFE SPACE</p>
            <h2 id="qc-title">How are you feeling today?</h2>
            <p className="qc-subtitle">
              Take a breath. You can be honest here. There is no right or
              wrong way to feel.
            </p>

            <div className="qc-moods">
              {moods.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  aria-pressed={selectedMood === mood}
                  className={`qc-mood ${
                    selectedMood === mood ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedMood(mood);
                    setError("");
                  }}
                >
                  {mood}
                </button>
              ))}
            </div>

            <div className="qc-voice-card">
              <div className="qc-mic-icon">🎙️</div>
              <h3>Want to talk about it?</h3>
              <p>
                What made you feel this way? Leave a little voice note if
                you'd like. You don't have to explain anything you aren't
                comfortable sharing.
              </p>

              {!recording ? (
                <button
                  className="qc-secondary"
                  type="button"
                  onClick={startRecording}
                >
                  🎙️ Record a voice note
                </button>
              ) : (
                <button
                  className="qc-secondary qc-recording"
                  type="button"
                  onClick={stopRecording}
                >
                  ⏹ Stop recording
                </button>
              )}

              {audioUrl && (
                <div className="qc-audio">
                  <p className="qc-recorded-label">
                    Your voice note is ready
                  </p>
                  <audio controls src={audioUrl}>
                    Audio playback isn't supported by this browser.
                  </audio>
                  <button
                    className="qc-skip"
                    type="button"
                    onClick={clearAudio}
                  >
                    Delete voice note
                  </button>
                </div>
              )}

              <p className="qc-privacy">
                Your voice note stays temporarily in this browser session.
                It isn't uploaded to Firebase.
              </p>
            </div>

            {error && <p className="qc-error">{error}</p>}

            <button
              className="qc-primary"
              type="button"
              onClick={continueFromMood}
            >
              Continue →
            </button>

            <button
              className="qc-skip"
              type="button"
              onClick={closePopup}
            >
              Skip for now
            </button>
          </>
        )}

        {screen === "grounding" && (
          <>
            <p className="qc-eyebrow">QUIET COMFORT</p>
            <h2 id="qc-title">Let's take a grounding pause.</h2>
            <p className="qc-subtitle">
              You don't have to solve everything right now. Let's come back
              to the present, one small step at a time.
            </p>

            <div className="qc-progress">
              {groundingSteps.map((item, index) => (
                <span
                  key={item.title}
                  className={index <= step ? "active" : ""}
                />
              ))}
            </div>

            <div className="qc-step-card">
              <div className="qc-step-number">
                STEP {step + 1} OF {groundingSteps.length}
              </div>
              <h3>{currentStep.title}</h3>
              <p>{currentStep.instruction}</p>
            </div>

            <button
              className="qc-secondary qc-full"
              type="button"
              onClick={() => speak(currentStep.instruction)}
            >
              {speaking ? "🔊 Read again" : "🔊 Read instructions aloud"}
            </button>

            <div className="qc-actions">
              <button
                className="qc-secondary"
                type="button"
                disabled={step === 0}
                onClick={() => {
                  stopSpeaking();
                  setStep((current) => Math.max(0, current - 1));
                }}
              >
                ← Back
              </button>

              <button
                className="qc-primary qc-next"
                type="button"
                onClick={nextStep}
              >
                {step === groundingSteps.length - 1
                  ? "Finish pause"
                  : "Next step →"}
              </button>
            </div>

            {error && <p className="qc-error">{error}</p>}

            <button
              className="qc-skip"
              type="button"
              onClick={() => {
                stopSpeaking();
                setScreen("finished");
              }}
            >
              Skip grounding
            </button>
          </>
        )}

        {screen === "gentle" && (
          <>
            <div className="qc-icon">✦</div>
            <p className="qc-eyebrow">A LITTLE REMINDER</p>
            <h2 id="qc-title">
              You deserve the good moments, too.
            </h2>
            <p className="qc-subtitle">
              {selectedMood.startsWith("😊")
                ? "Let yourself enjoy what's going well. You don't need to feel guilty for feeling happy."
                : selectedMood.startsWith("🌿")
                ? "Let this calm stay with you for a little while. There's no need to rush."
                : "You don't have to feel amazing every day. Take things at your own pace."}
            </p>
            <button
              className="qc-primary"
              type="button"
              onClick={closePopup}
            >
              Enter VibeCheck →
            </button>
          </>
        )}

        {screen === "finished" && (
          <>
            <div className="qc-icon">♡</div>
            <p className="qc-eyebrow">WELL DONE</p>
            <h2 id="qc-title">You made space for yourself.</h2>
            <p className="qc-subtitle">
              You don't need to have everything figured out. Take the next
              part of your day one moment at a time.
            </p>
            <button
              className="qc-primary"
              type="button"
              onClick={closePopup}
            >
              Enter VibeCheck →
            </button>
          </>
        )}
      </section>
    </div>
  );
}
