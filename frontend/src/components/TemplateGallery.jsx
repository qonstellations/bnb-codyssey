import { useEffect, useState } from "react";
import { Anchor, Badge, Button, Card, Chip, Group, Loader, Modal, SimpleGrid, Stack, Tabs, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { TEMPLATES, TEMPLATE_LEVELS } from "../shared/templates/index.js";
import TemplatePreview from "./TemplatePreview.jsx";
import { deleteTemplate, getTemplate, listTemplates } from "../api/templates.js";
import { openConfirmModal } from "./ConfirmModal.jsx";

function TemplateCard({ title, description, meta, onUse, onDelete, busy, actionLabel = "Use template" }) {
  return (
    <Card padding="lg" className="ag-hover-card" withBorder>
      <Stack gap={8} h="100%">
        <Text fw={500} style={{ letterSpacing: "-0.01em" }}>
          {title}
        </Text>
        {description && (
          <Text size="sm" c="dimmed" style={{ flex: 1 }}>
            {description}
          </Text>
        )}
        {meta && (
          <Group gap={6}>
            {meta.map((m) => (
              <Badge key={m} variant="light" color="gray" size="sm">
                {m}
              </Badge>
            ))}
          </Group>
        )}
        <Group justify="space-between" mt={4}>
          <Button size="xs" onClick={onUse} loading={busy}>
            {actionLabel}
          </Button>
          {onDelete && (
            <Button size="xs" variant="subtle" color="red" onClick={onDelete}>
              Delete
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

// "Practice (2, with feedback) → Main (4)" plus the retry rule, if any.
function structureOf(draft) {
  const blocks = draft.blocks
    .map((b) => `${b.label} (${b.trials.length}${b.trials.some((t) => t.feedback) ? ", with feedback" : ""})`)
    .join(" → ");
  const retry = draft.branches.find((br) => br.from === br.to);
  return retry ? `${blocks}. Practice repeats if accuracy is below ${Math.round(retry.condition.value * 100)}%.` : blocks;
}

// Same hand-off as the builder's Preview button (Toolbar.jsx → runtime/main.js loadPreview).
function tryIt(draft) {
  try {
    localStorage.setItem("preview-experiment", JSON.stringify(draft));
  } catch {
    notifications.show({ color: "red", message: "Could not start the preview (browser storage is blocked)" });
    return;
  }
  window.open("/run.html?preview=1", "_blank");
}

function TemplateDetail({ t, busy, onBack, onUse }) {
  return (
    <Stack gap="md">
      <Anchor component="button" type="button" size="sm" c="dimmed" onClick={onBack} style={{ alignSelf: "flex-start" }}>
        ← All templates
      </Anchor>
      <div>
        <Group gap={6} mb={6}>
          <Badge color={t.level === "Complex" ? "grape" : "teal"}>{t.level}</Badge>
          <Badge color="gray">{t.category}</Badge>
          <Badge color="gray">{t.keys}</Badge>
        </Group>
        <Title order={3}>{t.label}</Title>
        <Text c="dimmed" mt={4}>
          {t.measures}
        </Text>
      </div>
      <TemplatePreview key={t.id} draft={t.draft} />
      <Stack gap={4}>
        <Text fw={500} size="sm">
          What participants do
        </Text>
        <Text size="sm">{t.draft.settings.instructionsText}</Text>
      </Stack>
      <Stack gap={4}>
        <Text fw={500} size="sm">
          Structure · {t.trials} trials · ~{t.seconds} s
        </Text>
        <Text size="sm" c="dimmed">
          {structureOf(t.draft)}
        </Text>
      </Stack>
      <Group justify="flex-end">
        <Button variant="default" onClick={() => tryIt(t.draft)}>
          Try it yourself
        </Button>
        <Button loading={busy} onClick={onUse}>
          Use this template
        </Button>
      </Group>
    </Stack>
  );
}

// Built-in paradigm library + the user's own saved templates. onPick(draft, title)
// may be async; the modal stays open until it resolves.
export default function TemplateGallery({ opened, onClose, onPick }) {
  const [tab, setTab] = useState("library");
  const [level, setLevel] = useState("All");
  const [detail, setDetail] = useState(null);
  const [mine, setMine] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!opened || tab !== "mine") return;
    let cancelled = false;
    listTemplates()
      .then((r) => !cancelled && setMine(r.templates))
      .catch((err) => {
        if (cancelled) return;
        setMine([]);
        notifications.show({ color: "red", message: err.message ?? "Could not load templates" });
      });
    return () => {
      cancelled = true;
    };
  }, [opened, tab]);

  async function pick(id, load) {
    setBusyId(id);
    try {
      const { draft, title } = await load();
      await onPick(draft, title);
    } catch (err) {
      notifications.show({ color: "red", message: err.message ?? "Could not use template" });
    } finally {
      setBusyId(null);
    }
  }

  function confirmDelete(t) {
    openConfirmModal({
      title: "Delete template?",
      message: `"${t.title}" will be removed from your templates. Experiments made from it are not affected.`,
      onConfirm: async () => {
        try {
          await deleteTemplate(t._id);
          setMine((list) => list.filter((x) => x._id !== t._id));
        } catch (err) {
          notifications.show({ color: "red", message: err.message ?? "Delete failed" });
        }
      },
    });
  }

  const library = level === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.level === level);

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setDetail(null);
        onClose();
      }}
      title="Templates"
      size="xl"
    >
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="library">Library</Tabs.Tab>
          <Tabs.Tab value="mine">My templates</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="library">
          {detail ? (
            <TemplateDetail
              t={detail}
              busy={busyId === detail.id}
              onBack={() => setDetail(null)}
              onUse={() => pick(detail.id, async () => ({ draft: detail.draft, title: detail.label }))}
            />
          ) : (
            <>
              <Chip.Group value={level} onChange={setLevel}>
                <Group gap={6} mb="md">
                  {["All", ...TEMPLATE_LEVELS].map((c) => (
                    <Chip key={c} value={c} size="xs">
                      {c}
                    </Chip>
                  ))}
                </Group>
              </Chip.Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {library.map((t) => (
                  <TemplateCard
                    key={t.id}
                    title={t.label}
                    description={t.description}
                    meta={[t.level, t.category, t.keys, `~${t.seconds} s`]}
                    actionLabel="See more"
                    onUse={() => setDetail(t)}
                  />
                ))}
              </SimpleGrid>
            </>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="mine">
          {mine === null ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
          ) : mine.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No saved templates yet. In the builder, use Templates → Save current as template.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              {mine.map((t) => (
                <TemplateCard
                  key={t._id}
                  title={t.title}
                  description={t.description}
                  meta={[`Saved ${new Date(t.updatedAt).toLocaleDateString()}`]}
                  busy={busyId === t._id}
                  onUse={() =>
                    pick(t._id, async () => {
                      const { template } = await getTemplate(t._id);
                      return { draft: template.draft, title: template.title };
                    })
                  }
                  onDelete={() => confirmDelete(t)}
                />
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
