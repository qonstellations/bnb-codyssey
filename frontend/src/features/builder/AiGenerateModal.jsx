import { useState } from "react";
import { Alert, Button, Group, List, Modal, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useBuilderStore } from "./store.js";
import { validateExperiment } from "../../shared/experimentSchema.js";
import { generateExperiment } from "../../api/ai.js";
import { openConfirmModal } from "../../components/ConfirmModal.jsx";

const MAX_CHARS = 2000;
const EXAMPLE =
  "Participants complete 10 practice trials. If their accuracy is below 70%, they repeat " +
  "the practice. Once they reach 70%, they continue to a 40-trial main task. " +
  "Show a colour word for 2 seconds after a 500 ms fixation. Press F if the word matches " +
  "its ink colour, J if not.";

function applyDraft(draft, title, loadFromJson, onTitleChange) {
  const { ok, errors, data } = validateExperiment(draft);
  if (!ok) return errors.map((message) => ({ message }));
  loadFromJson(data);
  if (title) onTitleChange(title);
  notifications.show({ message: "Experiment generated — review it on the canvas" });
  return null;
}

export default function AiGenerateModal({ opened, onClose, onTitleChange }) {
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState([]);
  const isDirty = useBuilderStore((s) => s.isDirty);
  const loadFromJson = useBuilderStore((s) => s.loadFromJson);

  const canGenerate = description.trim().length > 0 && description.length <= MAX_CHARS && !generating;

  async function run() {
    setGenerating(true);
    setErrors([]);
    try {
      const result = await generateExperiment(description.trim());
      const problems = applyDraft(result.draft, result.title, loadFromJson, onTitleChange);
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

  function onGenerate() {
    if (!isDirty) {
      run();
      return;
    }
    openConfirmModal({
      title: "Replace current canvas?",
      message: "The generated experiment will replace your unsaved work.",
      confirmLabel: "Replace",
      onConfirm: run,
    });
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Describe your experiment" size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Describe the task in plain words — what participants see and do. The assistant drafts
          the full flow, which appears on your canvas for review. Nothing is saved until you
          press Save.
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
          <Button loading={generating} disabled={!canGenerate} onClick={onGenerate}>
            Generate
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
