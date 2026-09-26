import { Handle, Position } from '@xyflow/react'
import { conditionText } from '../format.js'

export default function BranchNode({ data, selected }) {
  return (
    <div className={`flow-card${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flow-card-title">
        <span className="flow-dot" style={{ background: '#fbbc04' }} />
        Decision
      </div>
      <div className="flow-card-sub">{conditionText(data.condition)}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
