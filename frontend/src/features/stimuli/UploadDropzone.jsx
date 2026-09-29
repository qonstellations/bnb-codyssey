import { useState } from 'react'
import { Dropzone } from '@mantine/dropzone'
import { Group, Progress, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { saveStimulus, uploadStimulusFile } from '../../api/stimuli.js'

const MAX_SIZE = 20 * 1024 * 1024 // 20MB
const ACCEPT = ['image/*', 'audio/*']

function stimulusType(contentType) {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('audio/')) return 'audio'
  return null
}

export default function UploadDropzone({ onUploaded }) {
  const [uploading, setUploading] = useState(false)

  async function handleDrop(files) {
    setUploading(true)
    try {
      for (const file of files) {
        const type = stimulusType(file.type)
        if (!type) continue
        // Straight to Vercel Blob — the file itself never touches our server.
        const blob = await uploadStimulusFile(file)
        const { stimulus } = await saveStimulus({
          name: file.name,
          type,
          url: blob.url,
          size: file.size,
        })
        onUploaded?.(stimulus)
      }
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dropzone
      onDrop={handleDrop}
      accept={ACCEPT}
      maxSize={MAX_SIZE}
      loading={uploading}
      onReject={() =>
        notifications.show({ color: 'red', message: 'File rejected — images/audio only, max 20MB' })
      }
    >
      <Stack align="center" gap="xs" py="lg">
        <Text size="sm">Drag images or audio here, or click to browse</Text>
        <Text size="xs" c="dimmed">
          Max 20MB per file
        </Text>
      </Stack>
      {uploading && (
        <Group px="md" pb="sm">
          <Progress value={100} animated style={{ flex: 1 }} />
        </Group>
      )}
    </Dropzone>
  )
}
