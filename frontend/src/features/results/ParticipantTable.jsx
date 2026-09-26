import { useEffect, useState } from 'react'
import { Badge, Drawer, Group, Loader, Stack, Switch, Table, Text } from '@mantine/core'
import { getSession, setExcluded } from '../../api/results.js'

const LOW_QUALITY_THRESHOLD = 50

function SessionDrawer({ expId, sessionId, onClose }) {
  const [session, setSession] = useState(null)
  const [trials, setTrials] = useState(null)

  useEffect(() => {
    getSession(expId, sessionId).then((res) => {
      setSession(res.session)
      setTrials(res.trials)
    })
  }, [expId, sessionId])

  return (
    <Drawer opened onClose={onClose} title="Session detail" size="lg" position="right">
      {!session ? (
        <Loader />
      ) : (
        <Stack>
          <Text size="sm">Participant: {session.participantId}</Text>
          <Text size="sm">Status: {session.status}</Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Condition</Table.Th>
                <Table.Th>Response</Table.Th>
                <Table.Th>Correct</Table.Th>
                <Table.Th>RT</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {trials.map((t) => (
                <Table.Tr key={t._id}>
                  <Table.Td>{t.trialIndex}</Table.Td>
                  <Table.Td>{t.condition}</Table.Td>
                  <Table.Td>{t.response ?? '-'}</Table.Td>
                  <Table.Td>{t.correct === null ? '-' : t.correct ? '✓' : '✗'}</Table.Td>
                  <Table.Td>{t.rt ? `${Math.round(t.rt)}ms` : '-'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}
    </Drawer>
  )
}

export default function ParticipantTable({ expId, sessions, onChanged }) {
  const [hideExcluded, setHideExcluded] = useState(false)
  const [hideLowQuality, setHideLowQuality] = useState(false)
  const [openSessionId, setOpenSessionId] = useState(null)

  const rows = sessions.filter((s) => {
    if (hideExcluded && s.excluded) return false
    if (hideLowQuality && (s.calibration?.score ?? 100) < LOW_QUALITY_THRESHOLD) return false
    return true
  })

  async function toggleExcluded(session) {
    await setExcluded(expId, session._id, !session.excluded)
    onChanged()
  }

  return (
    <Stack gap="sm">
      <Group>
        <Switch
          label="Hide excluded"
          checked={hideExcluded}
          onChange={(e) => setHideExcluded(e.currentTarget.checked)}
        />
        <Switch
          label="Hide low-quality"
          checked={hideLowQuality}
          onChange={(e) => setHideLowQuality(e.currentTarget.checked)}
        />
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Participant</Table.Th>
            <Table.Th>Device</Table.Th>
            <Table.Th>Timing score</Table.Th>
            <Table.Th>Trials</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Excluded</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((session) => (
            <Table.Tr
              key={session._id}
              onClick={() => setOpenSessionId(session._id)}
              style={{ cursor: 'pointer' }}
            >
              <Table.Td>{session.participantId.slice(0, 8)}</Table.Td>
              <Table.Td>
                {session.deviceInfo.browser} / {session.deviceInfo.os}
              </Table.Td>
              <Table.Td>{session.calibration?.score ?? '-'}</Table.Td>
              <Table.Td>{session.trialCount}</Table.Td>
              <Table.Td>
                <Badge color={session.status === 'completed' ? 'green' : 'gray'}>
                  {session.status}
                </Badge>
              </Table.Td>
              <Table.Td onClick={(e) => e.stopPropagation()}>
                <Switch checked={session.excluded} onChange={() => toggleExcluded(session)} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {openSessionId && (
        <SessionDrawer
          expId={expId}
          sessionId={openSessionId}
          onClose={() => setOpenSessionId(null)}
        />
      )}
    </Stack>
  )
}
