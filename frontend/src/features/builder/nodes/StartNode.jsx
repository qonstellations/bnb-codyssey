import { Handle, Position } from '@xyflow/react'

export default function StartNode() {
  return (
    <div className="flow-terminal start">
      <span className="flow-dot" />
      Start
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
