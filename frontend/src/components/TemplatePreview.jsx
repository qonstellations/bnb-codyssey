import { useEffect, useMemo, useState } from "react";
import { Button, Group, Text } from "@mantine/core";

// A looping, auto-played mini version of a template, built from its own draft:
// fixation → stimulus → simulated correct press → feedback, for one trial per condition.
const PHASES = [
  ["fixation", 500],
  ["stimulus", 1100],
  ["press", 450],
  ["feedback", 700],
];
const FAKE_RT = [412, 388, 455, 431];
const keyLabel = (k) => (k == null ? "any key" : k === " " ? "Space" : k.toUpperCase());

function samplesOf(draft) {
  const trials = draft.blocks[draft.blocks.length - 1].trials;
  const seen = new Set();
  const out = [];
  for (const t of trials) {
    if (seen.has(t.condition)) continue;
    seen.add(t.condition);
    out.push(t);
    if (out.length === 4) break;
  }
  return out;
}

export default function TemplatePreview({ draft }) {
  const samples = useMemo(() => samplesOf(draft), [draft]);
  const keys = useMemo(() => [...new Set(draft.blocks.flatMap((b) => b.trials.flatMap((t) => t.validKeys)))], [draft]);
  const [step, setStep] = useState(0); // index into samples × PHASES
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % (samples.length * PHASES.length)), PHASES[step % PHASES.length][1]);
    return () => clearTimeout(id);
  }, [step, playing, samples.length]);

  const trial = samples[Math.floor(step / PHASES.length) % samples.length];
  const phase = PHASES[step % PHASES.length][0];
  const { backgroundColor = "#fff", textColor = "#1f1f1f", fontSize = 32 } = draft.settings ?? {};
  const pressed = (phase === "press" || phase === "feedback") && !trial.withhold ? trial.correctKey : null;
  const rt = FAKE_RT[Math.floor(step / PHASES.length) % FAKE_RT.length];

  let shown = null;
  if (phase === "fixation") shown = <span style={{ fontSize: fontSize * 0.55 }}>+</span>;
  else if (phase === "feedback")
    shown = (
      <span className="tpl-feedback">{trial.withhold ? "✓ Held back" : `✓ Correct · ${rt} ms`}</span>
    );
  else
    shown = (
      <span style={{ fontSize: fontSize * 0.55, color: trial.stimulus.color ?? textColor }}>{trial.stimulus.content}</span>
    );

  return (
    <div>
      <div className="tpl-stage" style={{ background: backgroundColor, color: textColor }}>
        <div key={`${step}`} className="tpl-shown">
          {shown}
        </div>
        <span className="tpl-trial">
          Trial {(Math.floor(step / PHASES.length) % samples.length) + 1} / {samples.length}
        </span>
      </div>
      <Group justify="center" gap={8} mt="sm">
        {keys.map((k) => (
          <span key={k} className={`tpl-kbd${pressed === k ? " tpl-kbd-on" : ""}`}>
            {keyLabel(k)}
          </span>
        ))}
      </Group>
      <Group justify="space-between" mt="sm" wrap="nowrap">
        <Text size="sm" c="dimmed" aria-live="polite">
          <b>{trial.condition}</b> ·{" "}
          {trial.withhold ? "don't press — holding back is correct" : `correct answer: ${keyLabel(trial.correctKey)}`}
        </Text>
        <Button size="xs" variant="default" onClick={() => setPlaying((p) => !p)}>
          {playing ? "Pause" : "Play"}
        </Button>
      </Group>
    </div>
  );
}
