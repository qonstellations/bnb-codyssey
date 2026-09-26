import { Stack, Text, Title } from "@mantine/core";

function EmptyState({ title = "Nothing here yet", message, children }) {
  return (
    <Stack align="center" mt="xl" gap="xs">
      <Title order={3}>{title}</Title>
      {message && <Text c="dimmed">{message}</Text>}
      {children}
    </Stack>
  );
}

export default EmptyState;
