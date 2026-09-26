import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, ScrollArea } from '@mantine/core'
import { getExperiment } from '../api/experiments.js'
import LoadingScreen from '../components/LoadingScreen.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { useBuilderStore } from '../features/builder/store.js'
import Toolbar from '../features/builder/Toolbar.jsx'
import Canvas from '../features/builder/Canvas.jsx'
import NodeInspector from '../features/builder/panels/NodeInspector.jsx'

const EMPTY_DRAFT = {
  settings: {
    consentText: '',
    fullscreen: true,
    showProgressBar: true,
    instructionsText: '',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    fontSize: 32,
  },
  blocks: [],
  branches: [],
  loops: [],
}

export default function BuilderPage() {
  const { id } = useParams()
  const loadFromJson = useBuilderStore((s) => s.loadFromJson)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getExperiment(id)
      .then(({ experiment }) => {
        if (cancelled) return
        setTitle(experiment.title)
        const draft = experiment.draft?.blocks?.length ? experiment.draft : EMPTY_DRAFT
        loadFromJson(draft)
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <LoadingScreen />
  if (error) return <ErrorState message={error.message} />

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        // viewport minus app bar (64) minus main padding (16 top + 16 bottom)
        height: 'calc(100vh - 96px)',
        minHeight: 520,
        overflow: 'hidden',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 12,
        background: 'var(--app-surface)',
      }}
    >
      <Toolbar experimentId={id} title={title} onTitleChange={setTitle} />
      <Box style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
        <Canvas />
        <ScrollArea
          style={{
            width: 340,
            flexShrink: 0,
            borderLeft: '1px solid var(--mantine-color-default-border)',
            background: 'var(--app-surface)',
          }}
          p="md"
        >
          <NodeInspector />
        </ScrollArea>
      </Box>
    </Box>
  )
}
