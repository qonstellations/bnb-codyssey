import { useState } from "react";
import { Alert, Button, Group, List, Modal, Stack, Text, Textarea } from "@mantine/core";
import { validateExperiment } from "../../shared/experimentSchema.js";
import { TEMPLATES, composeFromTemplates } from "../../shared/templates/index.js";
import { generateExperiment } from "../../api/ai.js";

const MAX_CHARS = 2000;
const MIN_CHARS = 10;

// Lives on the Dashboard: always builds a *fresh* experiment from a text description, so it
// has no canvas to protect and no dirty-check. `onGenerated` does the creating/navigating;
// if it throws, the error lands in the list below and the modal stays open.
export default function AiGenerateModal({ opened, onClose, onGenerated }) {
  const [description, setDescription] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState([]);

  const prompt = description.trim();
  const canGenerate = prompt.length >= MIN_CHARS && description.length <= MAX_CHARS && !generating;

  async function generate() {
    setGenerating(true);
    setErrors([]);
    try {
      const result = await generateExperiment({ prompt });
      if (!result.valid) {
        setErrors(result.errors.map((message) => ({ message })));
        return;
      }
      const { ok, errors: composeErrors, data } = validateExperiment(composeFromTemplates(result.recipe));
      if (!ok) {
        setErrors(composeErrors.map((message) => ({ message })));
        return;
      }
      await onGenerated(data, result.title, result.notes);
      setDescription("");
      onClose();
    } catch (err) {
      setErrors([{ message: err.message ?? "Generation failed" }]);
    } finally {
      setGenerating(false);
    }
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
