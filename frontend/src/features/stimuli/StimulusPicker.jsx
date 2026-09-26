import { Modal } from '@mantine/core'
import StimulusLibrary from './StimulusLibrary.jsx'

export default function StimulusPicker({ opened, onClose, onPick }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Choose a stimulus" size="lg">
      <StimulusLibrary
        onSelect={(stimulus) => {
          onPick(stimulus)
          onClose()
        }}
      />
    </Modal>
  )
}
