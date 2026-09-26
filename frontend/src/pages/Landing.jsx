import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Container, Group, Text, Title } from "@mantine/core";
import { useAuth } from "../auth/AuthContext.jsx";

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

function Landing() {
  const { user } = useAuth();

  return (
    <div className="landing">
      <Container size="xs" className="landing-inner">
        <p className="landing-kicker rise" style={{ "--d": "0ms" }}>
          Codyssey · behavioural research
        </p>
        <Title order={1} className="landing-title rise" style={{ "--d": "90ms" }}>
          Measure minds, millisecond by millisecond.
        </Title>
        <Text c="dimmed" mt="md" className="rise" style={{ "--d": "180ms" }}>
          Design a task, share a link, and watch reaction times arrive live — timed in the
          browser, accurate to the frame.
        </Text>

        <div className="rise" style={{ "--d": "270ms" }}>
          <ReactionDemo />
        </div>

        <Group justify="center" mt="xl" className="rise" style={{ "--d": "360ms" }}>
          {user ? (
            <Button component={Link} to="/dashboard" size="md">
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button component={Link} to="/signup" size="md">
                Start building
              </Button>
              <Button variant="outline" component={Link} to="/login" size="md">
                Log in
              </Button>
            </>
          )}
        </Group>
      </Container>
    </div>
  );
}

export default Landing;
