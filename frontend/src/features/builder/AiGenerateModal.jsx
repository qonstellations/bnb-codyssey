import { useState } from "react";
import { Alert, Button, Group, List, Modal, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useBuilderStore } from "./store.js";
import { validateExperiment } from "../../shared/experimentSchema.js";
import { TEMPLATES, composeFromTemplates } from "../../shared/templates/index.js";
import { generateExperiment } from "../../api/ai.js";
import { openConfirmModal } from "../../components/ConfirmModal.jsx";

const MAX_CHARS = 2000;
const MIN_CHARS = 10;

function applyRecipe(recipe, title, notes, loadFromJson, onTitleChange) {
  const { ok, errors, data } = validateExperiment(composeFromTemplates(recipe));
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
  const [exampleIndex, setExampleIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState([]);
  const isDirty = useBuilderStore((s) => s.isDirty);
  const loadFromJson = useBuilderStore((s) => s.loadFromJson);

  const prompt = description.trim();
  const canGenerate = prompt.length >= MIN_CHARS && description.length <= MAX_CHARS && !generating;

  async function run() {
    setGenerating(true);
    setErrors([]);
    try {
      const result = await generateExperiment({ prompt });
      const problems = result.valid
        ? applyRecipe(result.recipe, result.title, result.notes, loadFromJson, onTitleChange)
        : result.errors.map((message) => ({ message }));
      if (problems) {
        setErrors(problems);
      } else {
        setDescription("");
        onClose();
      }
    } catch (err) {
      setErrors([{ message: err.message ?? "Generation failed" }]);
    } finally {
      setGenerating(false);
    }
  }

  function generate() {
    if (!isDirty) return run();
    openConfirmModal({
      title: "Replace current canvas?",
      message: "The generated experiment will replace your unsaved work.",
      confirmLabel: "Replace",
      onConfirm: run,
    });
  }

  // Each click pastes the next of the 6 library tests.
  function pasteExample() {
    setDescription(TEMPLATES[exampleIndex].example);
    setExampleIndex((i) => (i + 1) % TEMPLATES.length);
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Describe your experiment" size="xl">
      <Stack>
        <Text size="sm" c="dimmed">
          The AI builds only from our {TEMPLATES.length} tested tasks ({TEMPLATES.map((t) => t.label).join(", ")}).
          Ask for one, or combine several — it orders their blocks, sets repetitions and adds retry rules.
          Every trial is copied exactly from the library.
        </Text>
        <Textarea
          placeholder="e.g. A Stroop task, then Go / No-Go. Repeat practice if accuracy is below 80%."
          autosize
          minRows={10}
          maxRows={20}
          maxLength={MAX_CHARS + 100}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Group justify="space-between">
          <Button variant="subtle" size="xs" onClick={pasteExample}>
            Use an example ({TEMPLATES[exampleIndex].label})
          </Button>
          <Text size="xs" c={description.length > MAX_CHARS ? "red" : "dimmed"}>
            {description.length}/{MAX_CHARS}
          </Text>
        </Group>

        {generating && (
          <Text size="sm" c="dimmed">
            Picking blocks from the library…
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

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={generating} disabled={!canGenerate} onClick={generate}>
            {errors.length ? "Try again" : "Generate"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
