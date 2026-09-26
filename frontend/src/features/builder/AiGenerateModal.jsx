import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Chip,
  Group,
  List,
  Loader,
  Modal,
  Paper,
  Stack,
  Stepper,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { validateExperiment } from "../../shared/experimentSchema.js";
import { TEMPLATES, composeFromTemplates, estimateSeconds } from "../../shared/templates/index.js";
import { askQuestions, draftExperiment } from "../../api/ai.js";
import { conditionText } from "./format.js";

const MAX_CHARS = 2000;
const MIN_CHARS = 10;
const STAGES = ["describe", "questions", "review"];
const MAX_RETRIES = 2; // engine/flow.js maxBranchFires

function durationText(seconds) {
  return seconds < 60 ? `~${seconds} s` : `~${Math.round(seconds / 6) / 10} min`;
}

// Lives on the Dashboard: Describe → Questions → Review → Create. Nothing is created until
// the researcher presses Create on the Review stage; `onGenerated` does the creating/navigating,
// and if it throws, the error shows here and the modal stays open.
export default function AiGenerateModal({ opened, onClose, onGenerated }) {
  const [stage, setStage] = useState("describe");
  const [description, setDescription] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [understood, setUnderstood] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [review, setReview] = useState(null); // { recipe, title, notes, draft, request }
  const [refinement, setRefinement] = useState("");
  const [busy, setBusy] = useState(null); // "questions" | "draft" | "create"
  const [error, setError] = useState(null);

  const prompt = description.trim();
  const canAsk = prompt.length >= MIN_CHARS && description.length <= MAX_CHARS && !busy;

  function close() {
    if (busy) return;
    setStage("describe");
    setError(null);
    onClose();
  }

  async function ask() {
    setBusy("questions");
    setError(null);
    try {
      const result = await askQuestions({ prompt });
      setUnderstood(result.understood);
      setQuestions(result.questions);
      setAnswers({});
      setStage("questions");
    } catch (err) {
      setError(err.message ?? "Couldn't reach the AI");
    } finally {
      setBusy(null);
    }
  }

  async function draft(request) {
    setBusy("draft");
    setError(null);
    try {
      const result = await draftExperiment({ prompt, ...request });
      if (!result.valid) {
        setError(result.errors?.[0] ?? "The AI couldn't build a valid experiment. Try Regenerate.");
        return;
      }
      const composed = composeFromTemplates(result.recipe);
      const { ok, data } = validateExperiment(composed);
      if (!ok) {
        setError("The AI's design didn't pass validation. Try Regenerate, or rephrase.");
        return;
      }
      // Regenerate re-sends this exact request; the next refinement builds on this recipe.
      const { fresh: _fresh, ...rest } = request;
      setReview({ recipe: result.recipe, title: result.title, notes: result.notes ?? [], draft: data, request: rest });
      setRefinement("");
      setStage("review");
    } catch (err) {
      setError(err.message ?? "Generation failed");
    } finally {
      setBusy(null);
    }
  }

  function answerList(skip) {
    if (skip) return [];
    return questions
      .map((q) => ({ question: q.question, answer: (answers[q.id] ?? "").trim() }))
      .filter((a) => a.answer);
  }

  async function create() {
    setBusy("create");
    setError(null);
    try {
      await onGenerated(review.draft, review.title, review.notes);
      setDescription("");
      setReview(null);
      setStage("describe");
      onClose();
    } catch (err) {
      setError(err.message ?? "Could not create the experiment");
    } finally {
      setBusy(null);
    }
  }

  function pasteExample() {
    setDescription(TEMPLATES[exampleIndex].example);
    setExampleIndex((i) => (i + 1) % TEMPLATES.length);
  }

  return (
    <Modal opened={opened} onClose={close} title="Generate an experiment with AI" size="xl" closeOnClickOutside={!busy}>
      <Stack>
        <Stepper active={STAGES.indexOf(stage)} size="xs" allowNextStepsSelect={false}>
          <Stepper.Step label="Describe" />
          <Stepper.Step label="Questions" />
          <Stepper.Step label="Review" />
        </Stepper>

        {stage === "describe" && (
          <>
            <Text size="sm" c="dimmed">
              Describe your study in plain words. The AI builds it from our {TEMPLATES.length} tested tasks (
              {TEMPLATES.map((t) => t.label).join(", ")}) and can set the order, number of trials, response
              window, fixation, feedback and practice retries. You'll answer a couple of quick questions and
              review the design before anything is created.
            </Text>
            <Textarea
              placeholder="e.g. A Stroop task with about 60 trials, then Go / No-Go. Repeat practice if accuracy is below 80%, no feedback in the main blocks."
              autosize
              minRows={8}
              maxRows={16}
              maxLength={MAX_CHARS + 100}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canAsk) ask();
              }}
            />
            <Group justify="space-between">
              <Button variant="subtle" size="xs" onClick={pasteExample} disabled={!!busy}>
                Use an example ({TEMPLATES[exampleIndex].label})
              </Button>
              <Text size="xs" c={description.length > MAX_CHARS ? "red" : "dimmed"}>
                {description.length}/{MAX_CHARS}
              </Text>
            </Group>
          </>
        )}

        {stage === "questions" && (
          <>
            {understood && (
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={500} tt="uppercase" mb={4}>
                  What I understood
                </Text>
                <Text size="sm">{understood}</Text>
              </Paper>
            )}
            <Text size="sm" c="dimmed">
              A few quick choices to get it right. Pick an option, type your own, or leave it blank to let the AI decide.
            </Text>
            {questions.map((q) => (
              <Stack key={q.id} gap={6}>
                <Text size="sm" fw={500}>
                  {q.question}
                </Text>
                {q.options.length > 0 && (
                  <Chip.Group value={answers[q.id] ?? ""} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}>
                    <Group gap={6}>
                      {q.options.map((o) => (
                        <Chip key={o} value={o} size="sm" disabled={!!busy}>
                          {o}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                )}
                <TextInput
                  size="sm"
                  placeholder={q.options.length ? "Or type your own answer" : "Your answer"}
                  value={answers[q.id] ?? ""}
                  maxLength={500}
                  disabled={!!busy}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setAnswers((a) => ({ ...a, [q.id]: v }));
                  }}
                />
              </Stack>
            ))}
          </>
        )}

        {stage === "review" && review && <ReviewPanel review={review} />}

        {stage === "review" && (
          <Group align="flex-end" gap="xs">
            <TextInput
              style={{ flex: 1 }}
              label="Want a change?"
              placeholder="e.g. make the main block longer, no feedback, add Go / No-Go at the end"
              value={refinement}
              maxLength={1000}
              disabled={!!busy}
              onChange={(e) => setRefinement(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && refinement.trim() && !busy) {
                  draft({ answers: review.request.answers, previous: review.recipe, refinement: refinement.trim() });
                }
              }}
            />
            <Button
              variant="default"
              disabled={!refinement.trim() || !!busy}
              loading={busy === "draft" && !!refinement.trim()}
              onClick={() => draft({ answers: review.request.answers, previous: review.recipe, refinement: refinement.trim() })}
            >
              Apply change
            </Button>
          </Group>
        )}

        {busy && busy !== "create" && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              {busy === "questions" ? "Reading your description…" : "Designing your experiment…"}
            </Text>
          </Group>
        )}

        {error && (
          <Alert color="red" title="Something went wrong">
            {error}
          </Alert>
        )}

        <Group justify="space-between">
          {stage === "describe" ? (
            <span />
          ) : (
            <Button
              variant="subtle"
              disabled={!!busy}
              onClick={() => {
                setError(null);
                setStage(stage === "review" ? "questions" : "describe");
              }}
            >
              ← Back
            </Button>
          )}
          <Group>
            {stage === "describe" && (
              <>
                <Button variant="default" onClick={close} disabled={!!busy}>
                  Cancel
                </Button>
                <Button loading={busy === "questions"} disabled={!canAsk} onClick={ask}>
                  Continue
                </Button>
              </>
            )}
            {stage === "questions" && (
              <>
                <Button variant="default" disabled={!!busy} onClick={() => draft({ answers: answerList(true) })}>
                  Skip, use defaults
                </Button>
                <Button loading={busy === "draft"} disabled={!!busy} onClick={() => draft({ answers: answerList(false) })}>
                  Design experiment
                </Button>
              </>
            )}
            {stage === "review" && (
              <>
                <Button
                  variant="default"
                  disabled={!!busy}
                  onClick={() => draft({ ...review.request, fresh: true })}
                  title="Ask the AI for a different design with the same inputs"
                >
                  Regenerate
                </Button>
                <Button loading={busy === "create"} disabled={!!busy} onClick={create}>
                  Create experiment
                </Button>
              </>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

function ReviewPanel({ review }) {
  const { draft, title, notes } = review;
  const labelById = Object.fromEntries(draft.blocks.map((b) => [b.id, b.label]));
  const totalTrials = draft.blocks.reduce((n, b) => n + b.trials.length * (b.repetitions ?? 1), 0);

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="baseline">
        <Text fw={600} size="lg">
          {title || "Untitled experiment"}
        </Text>
        <Text size="sm" c="dimmed">
          {totalTrials} trials · {durationText(estimateSeconds(draft))}
        </Text>
      </Group>

      <Stack gap={6}>
        {draft.blocks.map((b, i) => {
          const t = b.trials[0];
          const count = b.trials.length * (b.repetitions ?? 1);
          return (
            <Paper key={b.id} withBorder p="sm" radius="md">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" c="dimmed" w={18}>
                    {i + 1}
                  </Text>
                  <Text size="sm" fw={500}>
                    {b.label}
                  </Text>
                </Group>
                <Group gap={6} wrap="nowrap">
                  <Badge variant="light" color="gray">
                    {count} trials
                  </Badge>
                  <Badge variant="light" color="gray">
                    {t.duration} ms window
                  </Badge>
                  <Badge variant="light" color={t.feedback ? "blue" : "gray"}>
                    {t.feedback ? "feedback" : "no feedback"}
                  </Badge>
                </Group>
              </Group>
            </Paper>
          );
        })}
      </Stack>

      {draft.branches.length > 0 && (
        <List size="sm" spacing={2}>
          {draft.branches.map((br) => (
            <List.Item key={br.id}>
              Repeat {labelById[br.from]} if {conditionText(br.condition)} (up to {MAX_RETRIES} more times)
            </List.Item>
          ))}
        </List>
      )}

      {notes.length > 0 && (
        <Alert color="blue" variant="light" title="Notes from the AI">
          <List size="sm" spacing={2}>
            {notes.map((n, i) => (
              <List.Item key={i}>{n}</List.Item>
            ))}
          </List>
        </Alert>
      )}

      <Text size="xs" c="dimmed">
        Everything stays editable on the canvas after you create it.
      </Text>
    </Stack>
  );
}
