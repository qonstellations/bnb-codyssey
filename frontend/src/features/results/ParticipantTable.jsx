import { useEffect, useState } from 'react'
import { Alert, Badge, Card, Drawer, Group, Loader, SimpleGrid, Stack, Switch, Table, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { getSession, setExcluded } from '../../api/results.js'

const LOW_QUALITY_THRESHOLD = 50
const CERTIFIED_THRESHOLD = 80
const STATUS_COLOR = { completed: 'green', in_progress: 'blue', abandoned: 'gray' }

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

function StatusBadge({ status }) {
  return (
    <Badge color={STATUS_COLOR[status] ?? 'gray'} variant="light">
      {status?.replace('_', ' ')}
    </Badge>
  )
}

function MiniStat({ label, value }) {
  return (
    <Card withBorder padding="sm" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text fw={700} size="lg">
        {value}
      </Text>
    </Card>
  )
}

function SessionDrawer({ expId, sessionId, onClose }) {
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSession(expId, sessionId).then(setRes, setError)
  }, [expId, sessionId])

  const session = res?.session
  const trials = res?.trials ?? []
  const rts = trials.filter((t) => typeof t.rt === 'number').map((t) => t.rt)
  const scored = trials.filter((t) => t.correct !== null)

  return (
    <Drawer
      opened
      onClose={onClose}
      size="xl"
      position="right"
      title={
        <Group gap="sm">
          <Title order={4}>Participant {session?.participantId?.slice(0, 8) ?? ''}</Title>
          {session && <StatusBadge status={session.status} />}
        </Group>
      }
    >
      {error ? (
        <Alert color="red" title="Couldn't load this session">
          {error.message}
        </Alert>
      ) : !session ? (
        <Loader />
      ) : (
        <Stack>
          <SimpleGrid cols={3}>
            <MiniStat label="Trials" value={trials.length} />
            <MiniStat
              label="Mean RT"
              value={rts.length ? `${Math.round(rts.reduce((a, b) => a + b, 0) / rts.length)} ms` : '—'}
            />
            <MiniStat
              label="Accuracy"
              value={scored.length ? `${Math.round((scored.filter((t) => t.correct).length / scored.length) * 100)}%` : '—'}
            />
          </SimpleGrid>
          <Group gap="xs">
            <Text size="sm">Timing certificate:</Text>
            <TimingCertificate score={session.calibration?.score} />
            {session.calibration?.refreshRate && (
              <Text size="sm" c="dimmed">
                {session.calibration.refreshRate} Hz · jitter {session.calibration.jitter?.toFixed(2)} ms
              </Text>
            )}
          </Group>
          <Text size="sm" c="dimmed">
            {session.deviceInfo?.browser ?? '?'} / {session.deviceInfo?.os ?? '?'} · started{' '}
            {new Date(session.startedAt).toLocaleString()}
            {session.seed != null && ` · version ${session.version ?? '-'} · seed ${session.seed}`}
          </Text>
          <Table.ScrollContainer minWidth={480}>
            <Table striped stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Block</Table.Th>
                  <Table.Th>Condition</Table.Th>
                  <Table.Th>Response</Table.Th>
                  <Table.Th>Correct</Table.Th>
                  <Table.Th>RT</Table.Th>
                  <Table.Th>Dropped</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {trials.map((t) => (
                  <Table.Tr key={t._id}>
                    <Table.Td>{t.trialIndex}</Table.Td>
                    <Table.Td>{t.blockId ?? '-'}</Table.Td>
                    <Table.Td>{t.condition || '-'}</Table.Td>
                    <Table.Td ff="monospace">{t.response ?? '-'}</Table.Td>
                    <Table.Td>
                      {t.correct === null ? (
                        '-'
                      ) : (
                        <Text span fw={700} c={t.correct ? 'green' : 'red'}>
                          {t.correct ? '✓' : '✗'}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{typeof t.rt === 'number' ? `${Math.round(t.rt)} ms` : '-'}</Table.Td>
                    <Table.Td>{t.frameData?.dropped ?? '-'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      )}
    </Drawer>
  )
}

export default function ParticipantTable({ expId, sessions, onChanged }) {
  const [hideExcluded, setHideExcluded] = useState(false)
  const [hideLowQuality, setHideLowQuality] = useState(false)
  const [openSessionId, setOpenSessionId] = useState(null)
  // Optimistic exclude state while the PATCH + reload is in flight: { [sessionId]: excluded }.
  const [pending, setPending] = useState({})

  const isExcluded = (s) => pending[s._id] ?? s.excluded

  const rows = sessions.filter((s) => {
    if (hideExcluded && isExcluded(s)) return false
    if (hideLowQuality && (s.calibration?.score ?? 100) < LOW_QUALITY_THRESHOLD) return false
    return true
  })

  async function toggleExcluded(session) {
    const next = !session.excluded
    setPending((p) => ({ ...p, [session._id]: next }))
    try {
      await setExcluded(expId, session._id, next)
      await onChanged()
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Could not update session' })
    } finally {
      setPending((p) => {
        const rest = { ...p }
        delete rest[session._id]
        return rest
      })
    }
  }

  return (
    <Card withBorder padding="lg" radius="md">
      <Group justify="space-between" mb="md" wrap="wrap">
        <div>
          <Title order={4}>Participants</Title>
          <Text size="sm" c="dimmed">
            {rows.length} of {sessions.length} shown · click a row for trial detail
          </Text>
        </div>
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
      </Group>

      <Table.ScrollContainer minWidth={820}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Participant</Table.Th>
              <Table.Th>Started</Table.Th>
              <Table.Th>Device</Table.Th>
              <Table.Th>Timing certificate</Table.Th>
              <Table.Th>Trials</Table.Th>
              <Table.Th title="Tab switches + window blurs during the run">Focus lost</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th title="Excluded sessions are left out of the summary, charts and clean exports">
                Included
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" ta="center" py="md">
                    No participants match these filters.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {rows.map((session) => (
              <Table.Tr
                key={session._id}
                onClick={() => setOpenSessionId(session._id)}
                style={{ cursor: 'pointer', opacity: isExcluded(session) ? 0.5 : 1 }}
              >
                <Table.Td ff="monospace">{session.participantId?.slice(0, 8) ?? '-'}</Table.Td>
                <Table.Td>{session.startedAt ? new Date(session.startedAt).toLocaleString() : '-'}</Table.Td>
                <Table.Td>
                  {session.deviceInfo?.browser ?? '?'} / {session.deviceInfo?.os ?? '?'}
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
                  <StatusBadge status={session.status} />
                  {session.version != null && (
                    <Text span size="xs" c="dimmed" ml={6}>
                      v{session.version}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Switch
                    aria-label="Include in analysis"
                    checked={!isExcluded(session)}
                    disabled={session._id in pending}
                    onChange={() => toggleExcluded(session)}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {openSessionId && (
        <SessionDrawer expId={expId} sessionId={openSessionId} onClose={() => setOpenSessionId(null)} />
      )}
    </Card>
  )
}
