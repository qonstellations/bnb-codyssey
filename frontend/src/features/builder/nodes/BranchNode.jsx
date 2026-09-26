import { Handle, Position } from '@xyflow/react'

export default function BranchNode({ data, selected }) {
  const c = data.condition
  return (
    <div className={`flow-card${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flow-card-title">
        <span className="flow-dot" style={{ background: '#fbbc04' }} />
        Branch
      </div>
      <div className="flow-card-sub">{c ? `${c.metric} ${c.operator} ${c.value}` : 'no condition set'}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
