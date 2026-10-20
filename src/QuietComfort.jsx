
import React, { useEffect, useRef, useState } from "react";
import "./QuietComfort.css";

const STEPS = [
  { number: 5, sense: "SEE", prompt: "Name five things you can see around you." },
  { number: 4, sense: "FEEL", prompt: "Notice four things you can physically feel." },
  { number: 3, sense: "HEAR", prompt: "Listen for three sounds around you." },
  { number: 2, sense: "SMELL", prompt: "Notice two things you can smell." },
  { number: 1, sense: "TASTE", prompt: "Notice one thing you can taste." },
];

export default function QuietComfort() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioUrlRef = useRef("");
  const discardRef = useRef(false);

  function stopVoiceGuide() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      setError("Voice guidance isn't supported by this browser.");
      return;
    }

    stopVoiceGuide();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.9;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearPlayback() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioUrlRef.current = "";
    setAudioUrl("");
  }

  async function startRecording() {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Audio recording isn't supported here. Try a recent browser over HTTPS.");
      return;
    }

    try {
      clearPlayback();
      discardRef.current = false;
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        releaseStream();

        if (discardRef.current) {
          chunksRef.current = [];
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          setAudioUrl(url);
        }
      };

      recorder.start();
      setRecording(true);
    } catch {
      releaseStream();
      setError("Microphone access wasn't available. Check your browser permissions.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  function discardRecording() {
    discardRef.current = true;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setRecording(false);
    clearPlayback();
    chunksRef.current = [];
    setError("");
  }

  function close() {
    stopVoiceGuide();

    discardRef.current = true;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }

    releaseStream();
    setRecording(false);
    clearPlayback();
    chunksRef.current = [];
    setOpen(false);
    setStep(0);
    setError("");
  }

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      releaseStream();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  function nextStep() {
    if (step < STEPS.length - 1) {
      const next = step + 1;
      setStep(next);
      speak(STEPS[next].prompt);
    } else {
      speak("You've completed the grounding exercise. Take your time before returning to your day.");
    }
  }

  const current = STEPS[step];

  return (
    <>
      <button className="qc-launch" onClick={() => setOpen(true)}>
        🌿 Take a grounding pause
      </button>

      {open && (
        <div className="qc-overlay" onClick={close}>
          <section
            className="qc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qc-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="qc-close" onClick={close} aria-label="Close">
              ×
            </button>

            <p className="qc-eyebrow">QUIET COMFORT · YOUR MOMENT</p>
            <h2 id="qc-title">Let's come back to the present 💜</h2>
            <p className="qc-muted">
              There's nothing you need to get right. Go at your own pace.
            </p>

            <div className="qc-progress">
              <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>

            <p className="qc-step-count">STEP {step + 1} OF {STEPS.length}</p>
            <div className="qc-number">{current.number}</div>
            <p className="qc-sense">{current.sense}</p>
            <p className="qc-prompt">{current.prompt}</p>

            <button
              className="qc-secondary"
              onClick={() => speak(current.prompt)}
            >
              {speaking ? "🔊 Voice guidance playing…" : "🔊 Read this aloud"}
            </button>

            <div className="qc-recorder">
              <h3>🎙️ Your voice, your space</h3>
              <p className="qc-muted">
                Record your thoughts as you move through the steps. You don't
                have to type anything.
              </p>

              {!recording ? (
                <button className="qc-record" onClick={startRecording}>
                  ⏺ Start recording
                </button>
              ) : (
                <button className="qc-stop" onClick={stopRecording}>
                  ■ Stop recording
                </button>
              )}

              {recording && (
                <p className="qc-recording-status" aria-live="polite">
                  Recording is on. Speak whenever you're ready.
                </p>
              )}

              {audioUrl && !recording && (
                <div className="qc-playback">
                  <p>Your recording is ready on this device.</p>
                  <audio controls src={audioUrl}>
                    Your browser can't play this recording.
                  </audio>
                  <button className="qc-secondary" onClick={discardRecording}>
                    Record again
                  </button>
                </div>
              )}

              {error && <p className="qc-error" role="alert">{error}</p>}
            </div>

            <div className="qc-actions">
              <button
                className="qc-secondary"
                disabled={step === 0}
                onClick={() => {
                  const previous = step - 1;
                  setStep(previous);
                  speak(STEPS[previous].prompt);
                }}
              >
                ← Back
              </button>

              <button className="qc-next" onClick={nextStep}>
                {step === STEPS.length - 1 ? "Finish 🌿" : "Next step →"}
              </button>
            </div>

            <button className="qc-skip" onClick={close}>
              Close whenever you're ready
            </button>
            <p className="qc-privacy">
              Your recording stays in this browser session and isn't uploaded
              to Firebase. Closing this window clears it.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
