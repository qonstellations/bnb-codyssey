import { List, Modal, Stack, Text } from '@mantine/core'

// Single home for beginner guidance: everything the panels used to explain
// inline lives here instead, behind one button in the toolbar.
export default function HowItWorksModal({ opened, onClose }) {
  return (
    <Modal opened={opened} onClose={onClose} title="How it works" size="md">
      <Stack gap="sm">
        <Text size="sm">
          Participants move through your experiment from <b>Start</b> to <b>End</b>.
          You build that path out of three steps:
        </Text>
        <List size="sm" spacing="xs">
          <List.Item>
            <b>Task</b> — a set of trials shown in order, e.g. Practice or Main task. Click a
            task to add trials; one row is one thing participants see.
          </List.Item>
          <List.Item>
            <b>Decision</b> — sends participants down different paths by their score, e.g.
            repeat Practice when accuracy is below 70%. Wire it Task → Decision → Task.
          </List.Item>
          <List.Item>
            <b>Repeat</b> — repeats one task a set number of times, instead of copying
            trials by hand.
          </List.Item>
        </List>
        <Text size="sm">
          Build in 3 steps: <b>1.</b> add a Task from the left panel (click it, or drag it
          onto the whiteboard) · <b>2.</b> click it and add trials · <b>3.</b> connect{' '}
          <b>Start → Task → End</b>.
        </Text>
        <Text size="xs" c="dimmed">
          Shortcuts: Templates or Generate with AI build a full draft for you. Journey shows
          the path as participants will experience it. Preview participant runs it exactly as
          they will see it.
        </Text>
      </Stack>
    </Modal>
  )
}
