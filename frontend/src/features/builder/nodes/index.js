import StartNode from './StartNode.jsx'
import BlockNode from './BlockNode.jsx'
import BranchNode from './BranchNode.jsx'
import LoopNode from './LoopNode.jsx'
import EndNode from './EndNode.jsx'

export const nodeTypes = {
  start: StartNode,
  block: BlockNode,
  branch: BranchNode,
  loop: LoopNode,
  end: EndNode,
}

export const NODE_PALETTE = [
  { type: 'block', label: 'Block' },
  { type: 'branch', label: 'Branch' },
  { type: 'loop', label: 'Loop' },
]
