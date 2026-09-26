import { ActionIcon, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { useApi } from '../../hooks/useApi.js'
import { deleteStimulus, listStimuli } from '../../api/stimuli.js'
import LoadingScreen from '../../components/LoadingScreen.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import UploadDropzone from './UploadDropzone.jsx'

export default function StimulusLibrary({ onSelect }) {
  const { data, error, loading, reload } = useApi(listStimuli)

  async function remove(id) {
    await deleteStimulus(id)
    reload()
  }

  return (
    <Stack gap="md">
      <UploadDropzone onUploaded={reload} />

      {loading && <LoadingScreen />}
      {!loading && error && <ErrorState message={error.message} onRetry={reload} />}
      {!loading && !error && data?.stimuli.length === 0 && (
        <EmptyState title="No stimuli yet" message="Upload an image or audio file above." />
      )}
      {!loading && !error && data?.stimuli.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
          {data.stimuli.map((stimulus) => (
            <Card
              key={stimulus._id}
              withBorder
              padding="xs"
              onClick={() => onSelect?.(stimulus)}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            >
              {stimulus.type === 'image' ? (
                <img
                  src={stimulus.url}
                  alt={stimulus.name}
                  style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4 }}
                />
              ) : (
                <Group justify="center" h={80}>
                  <Text size="sm">🔊</Text>
                </Group>
              )}
              <Group justify="space-between" mt="xs" wrap="nowrap">
                <Text size="xs" truncate>
                  {stimulus.name}
                </Text>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(stimulus._id)
                  }}
                >
                  ✕
                </ActionIcon>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}
