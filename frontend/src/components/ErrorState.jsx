import { Alert, Button, Stack } from "@mantine/core";

function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <Stack align="center" mt="xl">
      <Alert color="red" title="Error">
        {message}
      </Alert>
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </Stack>
  );
}

export default ErrorState;
