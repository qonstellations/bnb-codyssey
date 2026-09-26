import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import AgShell from "../components/AgShell.jsx";
import Magnetic from "../components/Magnetic.jsx";
import { runCalibration } from "../engine/calibration.js";

// Interactive hero: a 10-line reaction-time trial. Click when the pad turns
// green — the same rAF + performance.now() timing the real engine uses.
function ReactionDemo() {
  const [phase, setPhase] = useState("idle"); // idle | waiting | ready | result | early
  const [ms, setMs] = useState(null);
  const timer = useRef(null);
  const t0 = useRef(0);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => cancel, []);

  const start = () => {
    cancel();
    setMs(null);
    setPhase("waiting");
    timer.current = setTimeout(() => {
      t0.current = performance.now();
      setPhase("ready");
    }, 1200 + Math.random() * 2000);
  };

  const tap = () => {
    if (phase === "idle" || phase === "result" || phase === "early") {
      start();
    } else if (phase === "waiting") {
      cancel();
      setPhase("early");
    } else if (phase === "ready") {
      setMs(Math.round(performance.now() - t0.current));
      setPhase("result");
    }
  };

  const label =
    phase === "idle"
      ? "Tap to start"
      : phase === "waiting"
        ? "Wait for green…"
        : phase === "ready"
          ? "Tap!"
          : phase === "early"
            ? "Too soon — tap to retry"
            : `${ms} ms — tap to retry`;

  return (
    <button
      type="button"
      onClick={tap}
      className={`rt-pad rt-${phase}`}
      aria-live="polite"
      aria-label="Reaction time demo. Activate to start, then tap when the pad turns green."
    >
      <span className="rt-value" key={label}>
        {phase === "result" ? `${ms}` : label}
      </span>
      {phase === "result" && <span className="rt-unit">milliseconds</span>}
    </button>
  );
}

const grade = (score) => (score >= 80 ? "Certified" : score >= 50 ? "Fair" : "Poor");

// Star feature: the exact calibration every participant runs before a study,
// run on the visitor's own screen.
function TimingCertificateDemo() {
  const [state, setState] = useState("idle"); // idle | running | done
  const [cert, setCert] = useState(null);

  const run = async () => {
    setState("running");
    setCert(await runCalibration());
    setState("done");
  };

  const stats = cert && [
    ["Refresh rate", `${cert.refreshRate} Hz`],
    ["Frame jitter", `${cert.jitter.toFixed(2)} ms`],
    ["Dropped frames", `${cert.droppedFrames} / 120`],
  ];

  return (
    <div className="ag-card ag-cert" aria-live="polite">
      <div className="ag-cert-head">
        <span className="ag-cert-title">Timing certificate</span>
        {cert && <span className={`ag-cert-badge ag-cert-${grade(cert.score).toLowerCase()}`}>{grade(cert.score)}</span>}
      </div>
      <div className="ag-cert-score">
        {state === "done" ? cert.score : state === "running" ? "…" : "—"}
        <span>/ 100</span>
      </div>
      {stats ? (
        <dl className="ag-cert-stats">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="ag-cert-note">Measures 120 frames of your screen — about two seconds.</p>
      )}
      <button type="button" className="ag-pill" onClick={run} disabled={state === "running"}>
        {state === "running" ? "Measuring…" : state === "done" ? "Test again" : "Test my screen"}
      </button>
    </div>
  );
}

const AI_BLOCKS = ["Consent", "Practice · 8 trials · feedback", "Retry if accuracy < 70%", "Main · 48 trials", "End"];

const FEATURES = [
  [
    "Timing certificate",
    "Frame-locked stimuli, key-event reaction times, dropped frames logged per trial — and a 0–100 score for every participant's device.",
  ],
  ["Visual builder + AI", "Drag blocks, branches and loops onto a canvas, start from a classic paradigm, or describe the task in plain English."],
  ["Anonymous by design", "Random participant IDs, no IP addresses, withdraw codes that erase a participant's data, one-click account deletion."],
];

function Landing() {
  const { user } = useAuth();

  return (
    <AgShell
      navRight={
        !user && (
          <Link to="/login" className="ag-pill ghost">
            Log in
          </Link>
        )
      }
    >
      <header className="ag-hero">
        <p className="ag-kicker ag-reveal">Codyssey · behavioural research</p>
        <h1 className="ag-title ag-split">Measure minds, millisecond by millisecond.</h1>
        <p className="ag-sub ag-reveal">
          Browsers are noisy. Codyssey measures every participant's screen before the study starts
          and hands you a timing certificate with their data — so you know which reaction times to trust.
        </p>
        <div className="ag-ctas ag-reveal">
          {user ? (
            <Magnetic>
              <Link to="/dashboard" className="ag-pill">
                Go to dashboard
              </Link>
            </Magnetic>
          ) : (
            <>
              <Magnetic>
                <Link to="/signup" className="ag-pill">
                  Start building
                </Link>
              </Magnetic>
              <Magnetic>
                <Link to="/login" className="ag-pill ghost">
                  Log in
                </Link>
              </Magnetic>
            </>
          )}
        </div>
      </header>

      <section className="ag-section">
        <p className="ag-kicker ag-scroll">The timing certificate</p>
        <h2 className="ag-h2 ag-scroll">Know which data to trust.</h2>
        <p className="ag-sub ag-scroll">
          Before the first trial, every participant's browser is calibrated: refresh rate, frame jitter and
          dropped frames, rolled into one score. This is the same check — run it on your screen.
        </p>
        <div className="ag-scroll ag-cert-wrap">
          <TimingCertificateDemo />
        </div>
      </section>

      <section className="ag-section">
        <h2 className="ag-h2 ag-scroll">Try a trial.</h2>
        <p className="ag-sub ag-scroll">Click when the pad turns green.</p>
        <div className="ag-scroll">
          <ReactionDemo />
        </div>
      </section>

      <section className="ag-section">
        <p className="ag-kicker ag-scroll">AI experiment builder</p>
        <h2 className="ag-h2 ag-scroll">Describe it. Get a runnable experiment.</h2>
        <div className="ag-card ag-ai ag-scroll">
          <p className="ag-ai-prompt">“A Stroop task with a short practice that repeats until people get 70% right.”</p>
          <div className="ag-ai-flow">
            {AI_BLOCKS.map((b, i) => (
              <span key={b} className="ag-ai-chip" style={{ animationDelay: `${i * 120}ms` }}>
                {b}
              </span>
            ))}
          </div>
          <p className="ag-cert-note">Validated against the same schema the runtime uses, then editable on the canvas.</p>
        </div>
      </section>

      <section className="ag-section">
        <h2 className="ag-h2 ag-scroll">Everything a lab needs.</h2>
        <div className="ag-features">
          {FEATURES.map(([title, body]) => (
            <div key={title} className="ag-card ag-scroll">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>
    </AgShell>
  );
}

export default Landing;
