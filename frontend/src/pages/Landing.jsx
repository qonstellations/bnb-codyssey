import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import AgShell from "../components/AgShell.jsx";
import Magnetic from "../components/Magnetic.jsx";

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

const FEATURES = [
  ["Build visually", "Drag blocks, trials and branches onto a canvas — or describe the task and let AI draft it."],
  ["Frame-accurate timing", "rAF + performance.now() in the participant's browser. No plugins, no installs."],
  ["Results, live", "Accuracy and reaction times stream into your dashboard as sessions finish."],
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
          Design a task, share a link, and watch reaction times arrive live — timed in the
          browser, accurate to the frame.
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
        <h2 className="ag-h2 ag-scroll">Try a trial.</h2>
        <p className="ag-sub ag-scroll">Click when the pad turns green.</p>
        <div className="ag-scroll">
          <ReactionDemo />
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
