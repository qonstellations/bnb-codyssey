import { useEffect, useState } from 'react'
import { Badge, Drawer, Group, Loader, Stack, Switch, Table, Text } from '@mantine/core'
import { getSession, setExcluded } from '../../api/results.js'

const LOW_QUALITY_THRESHOLD = 50
const CERTIFIED_THRESHOLD = 80

// Timing certificate: the session's calibration score (refresh jitter + dropped frames), 0-100.
export function TimingCertificate({ score }) {
  if (score == null) return '-'
  const [color, label] =
    score >= CERTIFIED_THRESHOLD ? ['green', 'Certified'] : score >= LOW_QUALITY_THRESHOLD ? ['yellow', 'Fair'] : ['red', 'Poor']
  return (
    <Badge color={color} variant="light">
      {label} · {Math.round(score)}
    </Badge>
  )
}

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
          <Group gap="xs">
            <Text size="sm">Timing certificate:</Text>
            <TimingCertificate score={session.calibration?.score} />
            {session.calibration?.refreshRate && (
              <Text size="sm" c="dimmed">
                {session.calibration.refreshRate} Hz · jitter {session.calibration.jitter?.toFixed(2)} ms
              </Text>
            )}
          </Group>
          {session.seed != null && (
            <Text size="sm" c="dimmed">
              Version {session.version ?? '-'} · trial-order seed {session.seed}
            </Text>
          )}
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Condition</Table.Th>
                <Table.Th>Response</Table.Th>
                <Table.Th>Correct</Table.Th>
                <Table.Th>RT</Table.Th>
                <Table.Th>Dropped frames</Table.Th>
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
                  <Table.Td>{t.frameData?.dropped ?? '-'}</Table.Td>
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
            <Table.Th>Timing certificate</Table.Th>
            <Table.Th>Trials</Table.Th>
            <Table.Th title="Tab switches + window blurs during the run">Focus lost</Table.Th>
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
              <Table.Td>
                <TimingCertificate score={session.calibration?.score} />
              </Table.Td>
              <Table.Td>{session.trialCount}</Table.Td>
              <Table.Td>
                {session.engagement
                  ? (session.engagement.tabSwitches ?? 0) + (session.engagement.blurCount ?? 0)
                  : '-'}
              </Table.Td>
              <Table.Td>
                <Badge color={session.status === 'completed' ? 'green' : 'gray'}>
                  {session.status}
                </Badge>
                {session.version != null && (
                  <Text span size="xs" c="dimmed" ml={6}>
                    v{session.version}
                  </Text>
                )}
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
