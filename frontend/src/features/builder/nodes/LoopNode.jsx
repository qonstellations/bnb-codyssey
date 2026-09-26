import { Handle, Position } from '@xyflow/react'

export default function LoopNode({ data, selected }) {
  return (
    <div className={`flow-card${selected ? ' selected' : ''}`} style={{ minWidth: 140 }}>
      <Handle type="target" position={Position.Top} />
      <div className="flow-card-title">
        <span className="flow-dot" style={{ background: '#a142f4' }} />
        Loop
      </div>
      <div className="flow-card-sub">repeat {data.repetitions ?? 2}x</div>
    </div>
  )
}
