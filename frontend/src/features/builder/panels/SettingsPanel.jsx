import { ColorInput, NumberInput, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core'
import { useBuilderStore } from '../store.js'

export default function SettingsPanel() {
  const settings = useBuilderStore((s) => s.settings)
  const setSettings = useBuilderStore((s) => s.setSettings)

  return (
    <Stack gap="sm">
      <Text size="xs" fw={700} c="dimmed">
        EXPERIMENT SETTINGS
      </Text>
      <Textarea
        label="Consent text"
        minRows={3}
        value={settings.consentText}
        onChange={(e) => setSettings({ consentText: e.currentTarget.value })}
      />
      <Textarea
        label="Instructions text"
        minRows={3}
        value={settings.instructionsText ?? ''}
        onChange={(e) => setSettings({ instructionsText: e.currentTarget.value })}
      />
      <Switch
        label="Record panel ID"
        description="Saves ?pid= or ?PROLIFIC_PID= from the link on the session"
        checked={settings.collectExternalId ?? false}
        onChange={(e) => setSettings({ collectExternalId: e.currentTarget.checked })}
      />
      <TextInput
        label="Completion redirect URL"
        description="Optional, https://. Shown as a return button after the withdrawal code"
        placeholder="https://app.prolific.com/submissions/complete?cc=…"
        value={settings.completionRedirectUrl ?? ''}
        onChange={(e) => setSettings({ completionRedirectUrl: e.currentTarget.value.trim() || null })}
      />
      <Switch
        label="Fullscreen"
        checked={settings.fullscreen}
        onChange={(e) => setSettings({ fullscreen: e.currentTarget.checked })}
      />
      <Switch
        label="Show progress bar"
        checked={settings.showProgressBar}
        onChange={(e) => setSettings({ showProgressBar: e.currentTarget.checked })}
      />
      <ColorInput
        label="Background color"
        value={settings.backgroundColor ?? '#000000'}
        onChange={(v) => setSettings({ backgroundColor: v })}
      />
      <ColorInput
        label="Text color"
        value={settings.textColor ?? '#ffffff'}
        onChange={(v) => setSettings({ textColor: v })}
      />
      <NumberInput
        label="Font size"
        min={8}
        max={72}
        value={settings.fontSize ?? 32}
        onChange={(v) => setSettings({ fontSize: Number(v) || 32 })}
      />
    </Stack>
  )
}
