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
    <Box style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      <Toolbar experimentId={id} title={title} onTitleChange={setTitle} />
      <Box style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Canvas />
        <ScrollArea style={{ width: 320, borderLeft: '1px solid var(--mantine-color-gray-3)' }} p="md">
          <NodeInspector />
        </ScrollArea>
      </Box>
    </Box>
  )
}
