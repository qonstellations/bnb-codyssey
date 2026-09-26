import { Handle, Position } from '@xyflow/react'
import { estTimeText } from '../format.js'

export default function BlockNode({ data, selected }) {
  const count = data.trials?.length ?? 0
  const time = estTimeText(data.trials)
  return (
    <div className={`flow-card${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flow-card-title">
        <span className="flow-dot" style={{ background: '#4285f4' }} />
        {data.label || 'Untitled task'}
      </div>
      <div className="flow-card-sub">
        Task · {count} trial{count === 1 ? '' : 's'}{time ? ` · ${time}` : ''}
      </div>
      <Handle type="source" position={Position.Right} id="out" />
      <Handle type="source" position={Position.Bottom} id="decor" className="flow-handle-muted" />
    </div>
  )
}
