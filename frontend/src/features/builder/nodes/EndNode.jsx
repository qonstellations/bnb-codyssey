import { Handle, Position } from '@xyflow/react'
import { Badge } from '@mantine/core'

export default function EndNode() {
  return (
    <Badge color="red" size="lg" radius="sm" variant="filled">
      End
      <Handle type="target" position={Position.Left} />
    </Badge>
  )
}
