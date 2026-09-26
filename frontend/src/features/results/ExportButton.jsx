import { Button, Menu } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { exportUrl } from '../../api/results.js'
import { getToken } from '../../api/client.js'

// Export is owner-only (needs Bearer auth), so a plain <a href> download won't carry the
// token — fetch it manually and hand the browser a blob to save instead.
async function download(expId, format) {
  const res = await fetch(exportUrl(expId, format), {
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: 'include',
  })
  if (!res.ok) {
    notifications.show({ color: 'red', message: 'Export failed' })
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `results.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportButton({ expId }) {
  return (
    <Menu>
      <Menu.Target>
        <Button variant="light">Export</Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => download(expId, 'csv')}>CSV</Menu.Item>
        <Menu.Item onClick={() => download(expId, 'json')}>JSON</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
