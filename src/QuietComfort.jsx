
import React, { useEffect, useRef, useState } from "react";
import "./QuietComfort.css";

const moods = [
  "Happy",
  "Okay",
  "Calm",
  "Stressed",
  "Anxious",
  "Exhausted",
  "Overwhelmed",
  "Sad",
  "Lonely",
  "I don't know",
];

const difficultMoods = [
  "Stressed",
  "Anxious",
  "Exhausted",
  "Overwhelmed",
  "Sad",
  "Lonely",
  "I don't know",
];

const groundingSteps = [
  {
    number: 1,
    title: "5 things you can SEE",
    instruction:
      "Look around slowly. Notice five things you can see. They can be big, small, near, or far away.",
    prompt: "Name five things you can see around you.",
  },
  {
    number: 2,
    title: "4 things you can FEEL",
    instruction:
      "Notice four things you can physically feel, such as your feet on the floor or your clothes against your skin.",
    prompt: "Notice four things you can feel.",
  },
  {
    number: 3,
    title: "3 things you can HEAR",
    instruction:
      "Pause and listen carefully. Notice three sounds around you, even if they are quiet.",
    prompt: "Listen for three sounds.",
  },
  {
    number: 4,
    title: "2 things you can SMELL",
    instruction:
      "Notice two scents around you, if available. You do not need to find anything special.",
    prompt: "Notice two things you can smell.",
  },
  {
    number: 5,
    title: "1 thing you can TASTE",
    instruction:
      "Notice one taste in your mouth, or take a sip of water if you have some nearby.",
    prompt: "Notice one thing you can taste.",
  },
];

export default function QuietComfort() {
  const [open, setOpen] = useState(true);
  const [screen, setScreen] = useState("mood");
  const [selectedMood, setSelectedMood] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const discardRecordingRef = useRef(false);
  const audioUrlRef = useRef("");

  const releaseMicrophone = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  const clearAudio = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }
    setAudioUrl("");
  };

  const closePopup = () => {
    discardRecordingRef.current = true;

    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }

    releaseMicrophone();
    stopSpeaking();
    clearAudio();
    setRecording(false);
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      if (
        recorderRef.current &&
        recorderRef.current.state !== "inactive"
      ) {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }

      releaseMicrophone();

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  const speak = (text) => {
    if (!("speechSynthesis" in window)) {
      setError("Spoken guidance isn't supported by this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const continueFromMood = () => {
    if (!selectedMood) {
      setError("Please choose how you're feeling first.");
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
  };

  const startRecording = async () => {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
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
        "Microphone access wasn't available. You can continue without recording."
      );
    }
  };

  const stopRecording = () => {
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }
  };

  const nextStep = () => {
    stopSpeaking();
    setError("");

    if (step < groundingSteps.length - 1) {
      setStep((current) => current + 1);
    } else {
      setScreen("finished");
    }
  };

  const previousStep = () => {
    stopSpeaking();
    setError("");
    setStep((current) => Math.max(0, current - 1));
  };

  if (!open) return null;

  const currentStep = groundingSteps[step];

  return (
    <div
      className="qc-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePopup();
        }
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
          aria-label="Close check-in"
        >
          ×
        </button>

        {screen === "mood" && (
          <>
            <div className="qc-icon">♡</div>
            <p className="qc-eyebrow">A MOMENT FOR YOU</p>

            <h2 id="qc-title">How are you feeling today?</h2>
            <p className="qc-subtitle">
              There is no right or wrong answer. Check in with yourself.
            </p>

            <div className="qc-moods">
              {moods.map((mood) => (
                <button
                  type="button"
                  key={mood}
                  className={`qc-mood ${
                    selectedMood === mood ? "selected" : ""
                  }`}
                  aria-pressed={selectedMood === mood}
                  onClick={() => {
                    setSelectedMood(mood);
                    setError("");
                  }}
                >
                  {mood}
                </button>
              ))}
            </div>

            <label className="qc-reason-label" htmlFor="qc-reason">
              Why do you feel this way?
              <span> (optional)</span>
            </label>

            <textarea
              id="qc-reason"
              className="qc-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Anything on your mind? You can write it here..."
              rows={3}
            />

            <p className="qc-privacy">
              Your explanation stays in this popup and isn't uploaded
              to Firebase by this component.
            </p>

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
              You don't have to solve everything right now. Let's focus
              on the present, one step at a time.
            </p>

            <div className="qc-progress">
              {groundingSteps.map((item, index) => (
                <span
                  key={item.number}
                  className={index <= step ? "active" : ""}
                />
              ))}
            </div>

            <div className="qc-step-card">
              <div className="qc-step-number">
                Step {step + 1} of {groundingSteps.length}
              </div>

              <h3>{currentStep.title}</h3>
              <p>{currentStep.instruction}</p>
              <p className="qc-prompt">{currentStep.prompt}</p>
            </div>

            <button
              className="qc-secondary"
              type="button"
              onClick={() => speak(currentStep.instruction)}
            >
              {speaking ? "Read again 🔊" : "🔊 Read instructions aloud"}
            </button>

            <div className="qc-record-box">
              <p className="qc-record-title">Want to let something out?</p>
              <p className="qc-subtitle">
                You can record your thoughts for yourself, or skip this.
              </p>

              {!recording ? (
                <button
                  className="qc-secondary"
                  type="button"
                  onClick={startRecording}
                >
                  🎙️ Record my voice
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
                  <audio controls src={audioUrl}>
                    Your browser doesn't support audio playback.
                  </audio>
                  <button
                    className="qc-skip"
                    type="button"
                    onClick={clearAudio}
                  >
                    Discard recording
                  </button>
                </div>
              )}

              <p className="qc-privacy">
                Recording is optional. It stays temporarily in this
                browser session and is not uploaded by this component.
                Closing the popup discards it.
              </p>
            </div>

            {error && <p className="qc-error">{error}</p>}

            <div className="qc-actions">
              <button
                className="qc-secondary"
                type="button"
                onClick={previousStep}
                disabled={step === 0}
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

            <button
              className="qc-skip"
              type="button"
              onClick={() => setScreen("finished")}
            >
              Skip grounding
            </button>
          </>
        )}

        {screen === "gentle" && (
          <>
            <div className="qc-icon">☀</div>
            <p className="qc-eyebrow">A LITTLE REMINDER</p>
            <h2 id="qc-title">It's okay to feel this way.</h2>
            <p className="qc-subtitle">
              {selectedMood === "Happy"
                ? "Let yourself enjoy the good moments. You deserve them, too."
                : selectedMood === "Calm"
                ? "Take this calm with you into the rest of your day, one moment at a time."
                : "You don't have to feel amazing every day. Take things at your own pace."}
            </p>

            {reason.trim() && (
              <div className="qc-step-card">
                <p className="qc-prompt">Thank you for checking in with yourself.</p>
              </div>
            )}

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
              You don't need to have everything figured out. Take the
              next part of your day one step at a time.
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
