import { useState } from "react";
import { Alert, Button, Chip, Group, List, Modal, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useBuilderStore } from "./store.js";
import { validateExperiment } from "../../shared/experimentSchema.js";
import { generateExperiment } from "../../api/ai.js";
import { openConfirmModal } from "../../components/ConfirmModal.jsx";

const MAX_CHARS = 2000;
const MIN_CHARS = 10;
const EXAMPLE =
  "A Stroop task. Practice block with 4 trials, then a main block with 20 trials. " +
  "Show a colour word for 2 seconds after a 500 ms fixation. Press F if the word matches " +
  "its ink colour, J if not. If practice accuracy is below 70%, repeat practice.";

function applyDraft(draft, title, notes, loadFromJson, onTitleChange) {
  const { ok, errors, data } = validateExperiment(draft);
  if (!ok) return errors.map((message) => ({ message }));
  loadFromJson(data, { dirty: true });
  if (title) onTitleChange(title);
  notifications.show({
    title: "Experiment generated — review it on the canvas",
    message: notes?.length ? notes.map((n) => `• ${n}`).join("\n") : "Save to keep it.",
    autoClose: notes?.length ? 12000 : 4000,
    style: { whiteSpace: "pre-line" },
  });
  return null;
}

export default function AiGenerateModal({ opened, onClose, onTitleChange }) {
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState([]);
  const isDirty = useBuilderStore((s) => s.isDirty);
  const loadFromJson = useBuilderStore((s) => s.loadFromJson);

  const prompt = description.trim();
  const canGenerate = prompt.length >= MIN_CHARS && description.length <= MAX_CHARS && !generating;

  function reset() {
    setDescription("");
    setQuestions([]);
    setAnswers({});
    setErrors([]);
  }

  async function run(opts = {}) {
    setGenerating(true);
    setErrors([]);
    try {
      const result = await generateExperiment({ prompt, ...opts });
      if (result.kind === "questions") {
        setQuestions(result.questions);
        setAnswers({});
        return;
      }
      const problems = applyDraft(result.draft, result.title, result.notes, loadFromJson, onTitleChange);
      if (problems) {
        setErrors(problems);
      } else {
        reset();
        onClose();
      }
    } catch (err) {
      setErrors([{ message: err.message ?? "Generation failed" }]);
    } finally {
      setGenerating(false);
    }
  }

  function confirmThen(fn) {
    if (!isDirty) return fn();
    openConfirmModal({
      title: "Replace current canvas?",
      message: "The generated experiment will replace your unsaved work.",
      confirmLabel: "Replace",
      onConfirm: fn,
    });
  }

  function submitAnswers() {
    const list = questions
      .map((q) => ({ question: q.question, answer: (answers[q.id] ?? "").trim() }))
      .filter((a) => a.answer);
    confirmThen(() => run(list.length ? { answers: list } : { forceDraft: true }));
  }

  const asking = questions.length > 0;

  return (
    <Modal opened={opened} onClose={onClose} title="Describe your experiment" size="lg">
      <Stack>
        {!asking ? (
          <>
            <Text size="sm" c="dimmed">
              Describe the task, blocks, trials, keys and timing. The AI may ask a few questions,
              then designs blocks, loops and branches you can edit on the canvas. It builds only
              with what the builder supports (text stimuli, keyboard/click responses) and notes any
              approximations.
            </Text>
            <Textarea
              placeholder="e.g. A Flanker task with…"
              minRows={6}
              maxLength={MAX_CHARS + 100}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
            />
            <Group justify="space-between">
              <Button variant="subtle" size="xs" onClick={() => setDescription(EXAMPLE)}>
                Use an example
              </Button>
              <Text size="xs" c={description.length > MAX_CHARS ? "red" : "dimmed"}>
                {description.length}/{MAX_CHARS}
              </Text>
            </Group>
          </>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              A few details to get the design right. Leave any blank to let the AI decide.
            </Text>
            {questions.map((q) => (
              <Stack key={q.id} gap={6}>
                <Text size="sm" fw={500}>
                  {q.question}
                </Text>
                {q.options?.length > 0 && (
                  <Chip.Group
                    value={answers[q.id] ?? ""}
                    onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  >
                    <Group gap={6}>
                      {q.options.map((o) => (
                        <Chip key={o} value={o} size="xs">
                          {o}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                )}
                <TextInput
                  size="sm"
                  placeholder={q.options?.length ? "Or type your own answer" : "Your answer"}
                  value={answers[q.id] ?? ""}
                  maxLength={500}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setAnswers((a) => ({ ...a, [q.id]: v }));
                  }}
                />
              </Stack>
            ))}
          </>
        )}

        {generating && (
          <Text size="sm" c="dimmed">
            {asking || errors.length ? "Designing blocks, loops and branches…" : "Reading your description…"}
          </Text>
        )}

        {errors.length > 0 && (
          <Alert color="red" title="The generated draft needs attention">
            <List size="sm">
              {errors.slice(0, 8).map((e, i) => (
                <List.Item key={i}>{e.message}</List.Item>
              ))}
            </List>
          </Alert>
        )}

        <Group justify="space-between">
          {asking ? (
            <Button variant="subtle" onClick={() => setQuestions([])} disabled={generating}>
              ← Edit description
            </Button>
          ) : (
            <span />
          )}
          <Group>
            {asking ? (
              <>
                <Button
                  variant="default"
                  disabled={generating}
                  onClick={() => confirmThen(() => run({ forceDraft: true }))}
                >
                  Skip, just decide
                </Button>
                <Button loading={generating} onClick={submitAnswers}>
                  Generate experiment
                </Button>
              </>
            ) : (
              <>
                <Button variant="default" onClick={onClose}>
                  Cancel
                </Button>
                <Button loading={generating} disabled={!canGenerate} onClick={() => confirmThen(() => run())}>
                  {errors.length ? "Try again" : "Continue"}
                </Button>
              </>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
