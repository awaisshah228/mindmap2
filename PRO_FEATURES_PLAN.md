# React Flow Pro-Style Features - Implementation Plan

Based on [React Flow Pro Examples](https://pro.reactflow.dev/examples), here's what we're implementing and what requires a Pro subscription:

## ✅ Implementing (Open Source)

| Feature | Status | Notes |
|---------|--------|-------|
| **Remove Attribution** | ✅ | `proOptions={{ hideAttribution: true }}` |
| **Snap Grid** | ✅ | Built-in `snapGrid` + `snapToGrid` |
| **Copy and Paste** | ✅ | Ctrl+C, Ctrl+V, Delete via useKeyPress |
| **Undo and Redo** | ✅ | Wire store to canvas (already have store) |
| **Auto Layout (Dagre)** | ✅ | @dagrejs/dagre - open source |
| **Selection Grouping** | ✅ | React Flow has built-in selection box |
| **Shapes** | ✅ | Already have custom shape nodes |

## ⚠️ Pro Only (Subscription Required)

These require [React Flow Pro](https://reactflow.dev/pro) for full source:

- **Helper Lines** - Pro (alignment guides while dragging)
- **Editable Edge** - Pro (draggable control points)
- **Collaborative** - Pro (real-time yjs, but Liveblocks is alternative)
- **Force Layout** - Can use d3-force ourselves
- **Freehand Draw** - Can implement with canvas overlay
- **Node Position Animation** - Can use CSS transitions
- **Parent Child Relation** - React Flow supports parent nodes
- **Expand and Collapse** - Custom implementation
