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

// User-facing names only — `type` values are the internal model and stay as-is.
export const NODE_PALETTE = [
  {
    section: 'Activities',
    items: [
      {
        type: 'block',
        label: 'Task',
        hint: 'Run a set of trials, e.g. Practice or Main task.',
      },
    ],
  },
  {
    section: 'Flow',
    items: [
      {
        type: 'branch',
        label: 'Decision',
        hint: 'Send participants down different paths by their score.',
      },
      {
        type: 'loop',
        label: 'Repeat',
        hint: 'Repeat one activity a set number of times.',
      },
    ],
  },
]
