import { Handle, Position } from '@xyflow/react'
import { Badge } from '@mantine/core'

export default function StartNode() {
  return (
    <Badge color="green" size="lg" radius="sm" variant="filled">
      Start
      <Handle type="source" position={Position.Right} />
    </Badge>
  )
}
