import { Handle, Position } from '@xyflow/react'

export default function BlockNode({ data, selected }) {
  const count = data.trials?.length ?? 0
  return (
    <div className={`flow-card${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flow-card-title">
        <span className="flow-dot" style={{ background: '#4285f4' }} />
        {data.label || 'Untitled block'}
      </div>
      <div className="flow-card-sub">
        {count} trial{count === 1 ? '' : 's'}
      </div>
      <Handle type="source" position={Position.Right} id="out" />
      <Handle type="source" position={Position.Bottom} id="decor" className="flow-handle-muted" />
    </div>
  )
}
