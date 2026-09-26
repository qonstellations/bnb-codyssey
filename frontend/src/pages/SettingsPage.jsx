import { Text, Title } from "@mantine/core";

// Phase 10 builds the settings page (title, consent text, publish/close, danger zone).
function SettingsPage() {
  return (
    <>
      <Title order={2}>Settings</Title>
      <Text c="dimmed" mt="sm">
        Experiment settings go here (Phase 10).
      </Text>
    </>
  );
}

export default SettingsPage;
