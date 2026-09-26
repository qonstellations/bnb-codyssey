import { useEffect, useState } from "react";
import { Badge, Button, Card, Chip, Group, Loader, Modal, SimpleGrid, Stack, Tabs, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "../shared/templates/index.js";
import { deleteTemplate, getTemplate, listTemplates } from "../api/templates.js";
import { openConfirmModal } from "./ConfirmModal.jsx";

function TemplateCard({ title, description, meta, onUse, onDelete, busy }) {
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
            Use template
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

// Built-in paradigm library + the user's own saved templates. onPick(draft, title)
// may be async; the modal stays open until it resolves.
export default function TemplateGallery({ opened, onClose, onPick }) {
  const [tab, setTab] = useState("library");
  const [category, setCategory] = useState("All");
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

  const library = category === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === category);

  return (
    <Modal opened={opened} onClose={onClose} title="Templates" size="xl">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="library">Library</Tabs.Tab>
          <Tabs.Tab value="mine">My templates</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="library">
          <Chip.Group value={category} onChange={setCategory}>
            <Group gap={6} mb="md">
              {["All", ...TEMPLATE_CATEGORIES].map((c) => (
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
                meta={[t.category, t.keys, `${t.blocks} blocks · ${t.trials} trials`, `~${t.minutes} min`]}
                busy={busyId === t.id}
                onUse={() => pick(t.id, async () => ({ draft: t.draft, title: t.label }))}
              />
            ))}
          </SimpleGrid>
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
