import { Handle, Position } from '@xyflow/react'

export default function EndNode() {
  return (
    <div className="flow-terminal end">
      <Handle type="target" position={Position.Left} />
      <span className="flow-dot" />
      End
    </div>
  )
}
