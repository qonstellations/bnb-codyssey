import { useState } from 'react'
import { Box, Button, Menu, Switch } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { exportResults } from '../../api/results.js'

export default function ExportButton({ expId }) {
  const [clean, setClean] = useState(false)
  const [busy, setBusy] = useState(false)

  async function run(kind, format) {
    setBusy(true)
    try {
      await exportResults(expId, { kind, format, scope: clean ? 'clean' : 'all' })
    } catch (err) {
      notifications.show({ color: 'red', title: 'Export failed', message: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Menu position="bottom-end" width={260}>
      <Menu.Target>
        <Button variant="light" loading={busy}>Export</Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Box px="sm" py="xs">
          <Switch
            size="xs"
            label="Completed, non-excluded only"
            checked={clean}
            onChange={(e) => setClean(e.currentTarget.checked)}
          />
        </Box>
        <Menu.Divider />
        <Menu.Label>Trial data (one row per trial)</Menu.Label>
        <Menu.Item onClick={() => run('trials', 'csv')}>Trials · CSV</Menu.Item>
        <Menu.Item onClick={() => run('trials', 'json')}>Trials · JSON</Menu.Item>
        <Menu.Label>Summary (per session and block)</Menu.Label>
        <Menu.Item onClick={() => run('sessions', 'csv')}>Summary · CSV</Menu.Item>
        <Menu.Item onClick={() => run('sessions', 'json')}>Summary · JSON</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
