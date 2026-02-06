"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
  BackgroundVariant,
  ConnectionLineType,
  applyNodeChanges,
  applyEdgeChanges,
  SelectionMode,
} from "@xyflow/react";
import { KeyboardHandler } from "./KeyboardHandler";
import { PresentationMode } from "@/components/panels/PresentationMode";
import { HelperLines } from "./HelperLines";
import { getLayoutedElements, type LayoutDirection } from "@/lib/layout-engine";
import { resolveCollisions } from "@/lib/resolve-collisions";
import { getHiddenNodeIds } from "@/lib/mindmap-utils";
import "@xyflow/react/dist/style.css";
import { useCanvasStore, DEFAULT_MIND_MAP_LAYOUT } from "@/lib/store/canvas-store";

const SNAP_THRESHOLD = 8;
const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 50;
import {
  StickyNoteNode,
  MindMapNode,
  ShapeNode,
  TextNode,
  FreeDrawNode,
  TableNode,
  EdgeAnchorNode,
  IconNode,
  ImageNode,
  DatabaseSchemaNode,
  ServiceNode,
  QueueNode,
  ActorNode,
  GroupNode,
} from "@/components/nodes";
import type { Stroke } from "./FreeDrawPreview";
import { EdgeDrawPreview } from "./EdgeDrawPreview";
import { EraserPreview } from "./EraserPreview";
import { FreehandOverlay } from "./FreehandOverlay";
import LabeledConnectorEdge from "@/components/edges/LabeledConnectorEdge";
import { CustomConnectionLine } from "@/components/edges/CustomConnectionLine";
import { MindMapLayoutPanel } from "@/components/panels/MindMapLayoutPanel";
import { MobileColorIndicator } from "@/components/panels/MobileColorIndicator";
import { MindMapLayoutProvider } from "@/contexts/MindMapLayoutContext";
import { getDragPayload } from "@/lib/dnd-payload";
import { AIContextMenu } from "@/components/panels/AIContextMenu";
import { CanvasBottomBar } from "./CanvasBottomBar";

const EDGE_ANCHOR_SIZE = 12;

const nodeTypes = {
  stickyNote: StickyNoteNode,
  mindMap: MindMapNode,
  rectangle: ShapeNode,
  diamond: ShapeNode,
  circle: ShapeNode,
  document: ShapeNode,
  table: TableNode,
  text: TextNode,
  freeDraw: FreeDrawNode,
  edgeAnchor: EdgeAnchorNode,
  icon: IconNode,
  image: ImageNode,
  databaseSchema: DatabaseSchemaNode,
  service: ServiceNode,
  queue: QueueNode,
  actor: ActorNode,
  group: GroupNode,
};

const MIND_MAP_NODE_WIDTH = 170;
const INITIAL_CANVAS_PADDING = 100;
function getDefaultMindMapPositions(): Node[] {
  const { spacingX, spacingY } = DEFAULT_MIND_MAP_LAYOUT;
  const pad = INITIAL_CANVAS_PADDING;
  const layer1X = pad + MIND_MAP_NODE_WIDTH + spacingX;
  const layer2X = layer1X + MIND_MAP_NODE_WIDTH + spacingX;
  return [
    {
      id: "mind-root",
      type: "mindMap",
      position: { x: pad, y: pad },
      data: { label: "Mind Map Overview" },
    },
    {
      id: "mind-goals",
      type: "mindMap",
      position: { x: layer1X, y: pad - spacingY },
      data: { label: "Goals" },
    },
    {
      id: "mind-tasks",
      type: "mindMap",
      position: { x: layer1X, y: pad },
      data: { label: "Key Tasks" },
    },
    {
      id: "mind-stakeholders",
      type: "mindMap",
      position: { x: layer1X, y: pad + spacingY },
      data: { label: "Stakeholders" },
    },
    {
      id: "mind-task-ideas",
      type: "mindMap",
      position: { x: layer2X, y: pad - spacingY },
      data: { label: "Milestones" },
    },
    {
      id: "mind-task-next",
      type: "mindMap",
      position: { x: layer2X, y: pad + spacingY },
      data: { label: "Next Actions" },
    },
  ];
}
const defaultNodes: Node[] = getDefaultMindMapPositions();

const defaultEdges: Edge[] = [
  {
    id: "edge-root-goals",
    source: "mind-root",
    target: "mind-goals",
    sourceHandle: "right",
    targetHandle: "left",
    type: "labeledConnector",
    data: { connectorType: "default" },
  },
  {
    id: "edge-root-tasks",
    source: "mind-root",
    target: "mind-tasks",
    sourceHandle: "right",
    targetHandle: "left",
    type: "labeledConnector",
    data: { connectorType: "default" },
  },
  {
    id: "edge-root-stakeholders",
    source: "mind-root",
    target: "mind-stakeholders",
    sourceHandle: "right",
    targetHandle: "left",
    type: "labeledConnector",
    data: { connectorType: "default" },
  },
  {
    id: "edge-tasks-ideas",
    source: "mind-tasks",
    target: "mind-task-ideas",
    sourceHandle: "right",
    targetHandle: "left",
    type: "labeledConnector",
    data: { connectorType: "default" },
  },
  {
    id: "edge-tasks-next",
    source: "mind-tasks",
    target: "mind-task-next",
    sourceHandle: "right",
    targetHandle: "left",
    type: "labeledConnector",
    data: { connectorType: "default" },
  },
];

const edgeTypes = {
  labeledConnector: LabeledConnectorEdge,
};

export default function DiagramCanvas() {
  const storeNodes = useCanvasStore((s) => s.nodes);
  const storeEdges = useCanvasStore((s) => s.edges);
  const setStoreNodes = useCanvasStore((s) => s.setNodes);
  const setStoreEdges = useCanvasStore((s) => s.setEdges);

  const [nodes, setNodes] = useNodesState(
    storeNodes.length > 0 ? storeNodes : []
  );
  const [edges, setEdges] = useEdgesState(
    storeEdges.length > 0 ? storeEdges : []
  );

  const activeTool = useCanvasStore((s) => s.activeTool);
  const pendingShape = useCanvasStore((s) => s.pendingShape);
  const setPendingShape = useCanvasStore((s) => s.setPendingShape);
  const pendingEmoji = useCanvasStore((s) => s.pendingEmoji);
  const setPendingEmoji = useCanvasStore((s) => s.setPendingEmoji);
  const pendingIconId = useCanvasStore((s) => s.pendingIconId);
  const setPendingIconId = useCanvasStore((s) => s.setPendingIconId);
  const pendingImageUrl = useCanvasStore((s) => s.pendingImageUrl);
  const pendingImageLabel = useCanvasStore((s) => s.pendingImageLabel);
  const setPendingImage = useCanvasStore((s) => s.setPendingImage);
  const addNode = useCanvasStore((s) => s.addNode);
  const addEdgeToStore = useCanvasStore((s) => s.addEdge);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const mindMapLayout = useCanvasStore((s) => s.mindMapLayout);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);
  const pendingFitView = useCanvasStore((s) => (s as any).pendingFitView);
  const setPendingFitView = useCanvasStore((s) => (s as any).setPendingFitView);
  const presentationMode = useCanvasStore((s) => s.presentationMode);
  const presentationNodeIndex = useCanvasStore((s) => s.presentationNodeIndex);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);

  const [helperLines, setHelperLines] = useState<{
    horizontal: { y: number; x1: number; x2: number } | null;
    vertical: { x: number; y1: number; y2: number } | null;
  }>({ horizontal: null, vertical: null });

  const [edgeDrawStart, setEdgeDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [edgeDrawEndPreview, setEdgeDrawEndPreview] = useState<{ x: number; y: number } | null>(null);
  const [edgeDrawPoints, setEdgeDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [eraserPoints, setEraserPoints] = useState<{ x: number; y: number }[]>([]);
  const [isErasing, setIsErasing] = useState(false);

  // Open details panel when clicking a node in presentation mode
  const setDetailsPanelNodeId = useCanvasStore((s) => s.setDetailsPanelNodeId);
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (presentationMode) {
        setDetailsPanelNodeId(node.id);
      }
    },
    [presentationMode, setDetailsPanelNodeId]
  );

  // AI context menu state
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
    },
    []
  );

  const hiddenNodeIds = useMemo(
    () => getHiddenNodeIds(nodes, edges),
    [nodes, edges]
  );

  // Determine the focused node ID during presentation mode
  const presentationFocusedNodeId = useMemo(() => {
    if (!presentationMode) return null;
    const presentable = nodes.filter(
      (n) =>
        n.type !== "freeDraw" &&
        n.type !== "edgeAnchor" &&
        n.type !== "group"
    );
    return presentable[presentationNodeIndex]?.id ?? null;
  }, [presentationMode, presentationNodeIndex, nodes]);

  const visibleNodes = useMemo(
    () =>
      nodes.map((n) => {
        if (hiddenNodeIds.has(n.id)) return { ...n, hidden: true as const };

        // In presentation mode, dim non-focused nodes
        if (presentationMode && presentationFocusedNodeId) {
          const isFocused = n.id === presentationFocusedNodeId;
          return {
            ...n,
            style: {
              ...n.style,
              opacity: isFocused ? 1 : 0.2,
              transition: "opacity 0.4s ease, filter 0.4s ease",
              filter: isFocused ? "drop-shadow(0 0 12px rgba(139, 92, 246, 0.5))" : "none",
              zIndex: isFocused ? 10 : 0,
            },
          };
        }
        return n;
      }),
    [nodes, hiddenNodeIds, presentationMode, presentationFocusedNodeId]
  );

  const visibleEdges = useMemo(
    () =>
      edges.map((e) => {
        if (hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target))
          return { ...e, hidden: true as const };

        // In presentation mode, highlight edges connected to focused node, dim others
        if (presentationMode && presentationFocusedNodeId) {
          const isConnected =
            e.source === presentationFocusedNodeId ||
            e.target === presentationFocusedNodeId;
          return {
            ...e,
            style: {
              ...e.style,
              opacity: isConnected ? 1 : 0.1,
              transition: "opacity 0.4s ease",
            },
          };
        }
        return e;
      }),
    [edges, hiddenNodeIds, presentationMode, presentationFocusedNodeId]
  );

  const getNodeBounds = useCallback((node: Node) => {
    const w = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
    const h = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
    return {
      left: node.position.x,
      right: node.position.x + (Number(w) || DEFAULT_NODE_WIDTH),
      top: node.position.y,
      bottom: node.position.y + (Number(h) || DEFAULT_NODE_HEIGHT),
      centerX: node.position.x + (Number(w) || DEFAULT_NODE_WIDTH) / 2,
      centerY: node.position.y + (Number(h) || DEFAULT_NODE_HEIGHT) / 2,
    };
  }, []);

  const eraseAt = useCallback(
    (x: number, y: number) => {
      setNodes((prevNodes) => {
        const toRemoveIds = prevNodes
          .filter((n) => {
            if (n.type === "freeDraw") return true;
            if (["rectangle", "diamond", "circle", "document", "stickyNote", "text", "table"].includes(n.type ?? "")) {
              return true;
            }
            return false;
          })
          .filter((n) => {
            const w = n.measured?.width ?? n.width ?? DEFAULT_NODE_WIDTH;
            const h = n.measured?.height ?? n.height ?? DEFAULT_NODE_HEIGHT;
            const left = n.position.x;
            const top = n.position.y;
            const right = left + (Number(w) || DEFAULT_NODE_WIDTH);
            const bottom = top + (Number(h) || DEFAULT_NODE_HEIGHT);
            return x >= left && x <= right && y >= top && y <= bottom;
          })
          .map((n) => n.id);

        if (!toRemoveIds.length) return prevNodes;

        setEdges((eds) =>
          eds.filter((e) => !toRemoveIds.includes(e.source) && !toRemoveIds.includes(e.target))
        );
        return prevNodes.filter((n) => !toRemoveIds.includes(n.id));
      });

      // Also erase standalone edges whose path passes near the eraser point.
      // This is similar in spirit to the React Flow whiteboard eraser example:
      // if the eraser trail intersects an edge path, we delete that edge.
      setEdges((prevEdges) => {
        const ERASER_RADIUS = 10;
        const radiusSq = ERASER_RADIUS * ERASER_RADIUS;

        return prevEdges.filter((edge) => {
          const pathPoints = (edge.data as any)?.pathPoints as
            | { x: number; y: number }[]
            | undefined;

          if (!Array.isArray(pathPoints) || pathPoints.length === 0) {
            return true;
          }

          const hit = pathPoints.some((p) => {
            const dx = x - p.x;
            const dy = y - p.y;
            return dx * dx + dy * dy <= radiusSq;
          });

          return !hit;
        });
      });
    },
    [setNodes, setEdges]
  );

  const checkAlignment = useCallback(
    (draggedNode: Node) => {
      const bounds = getNodeBounds(draggedNode);
      let horizontalLine: { y: number; x1: number; x2: number } | null = null;
      let verticalLine: { x: number; y1: number; y2: number } | null = null;
      let snapX: number | null = null;
      let snapY: number | null = null;
      const w = draggedNode.measured?.width ?? draggedNode.width ?? DEFAULT_NODE_WIDTH;
      const h = draggedNode.measured?.height ?? draggedNode.height ?? DEFAULT_NODE_HEIGHT;
      const nodeW = Number(w) || DEFAULT_NODE_WIDTH;
      const nodeH = Number(h) || DEFAULT_NODE_HEIGHT;

      for (const n of nodes) {
        if (n.id === draggedNode.id || !n.position || hiddenNodeIds.has(n.id)) continue;
        const nb = getNodeBounds(n);

        const topDiff = Math.abs(bounds.top - nb.top);
        const centerYDiff = Math.abs(bounds.centerY - nb.centerY);
        const bottomDiff = Math.abs(bounds.bottom - nb.bottom);
        if (topDiff < SNAP_THRESHOLD) {
          snapY = nb.top;
          horizontalLine = { y: nb.top, x1: Math.min(bounds.left, nb.left) - 50, x2: Math.max(bounds.right, nb.right) + 50 };
        } else if (centerYDiff < SNAP_THRESHOLD) {
          snapY = nb.centerY - nodeH / 2;
          horizontalLine = { y: nb.centerY, x1: Math.min(bounds.left, nb.left) - 50, x2: Math.max(bounds.right, nb.right) + 50 };
        } else if (bottomDiff < SNAP_THRESHOLD) {
          snapY = nb.bottom - nodeH;
          horizontalLine = { y: nb.bottom, x1: Math.min(bounds.left, nb.left) - 50, x2: Math.max(bounds.right, nb.right) + 50 };
        }

        const leftDiff = Math.abs(bounds.left - nb.left);
        const centerXDiff = Math.abs(bounds.centerX - nb.centerX);
        const rightDiff = Math.abs(bounds.right - nb.right);
        if (leftDiff < SNAP_THRESHOLD) {
          snapX = nb.left;
          verticalLine = { x: nb.left, y1: Math.min(bounds.top, nb.top) - 50, y2: Math.max(bounds.bottom, nb.bottom) + 50 };
        } else if (centerXDiff < SNAP_THRESHOLD) {
          snapX = nb.centerX - nodeW / 2;
          verticalLine = { x: nb.centerX, y1: Math.min(bounds.top, nb.top) - 50, y2: Math.max(bounds.bottom, nb.bottom) + 50 };
        } else if (rightDiff < SNAP_THRESHOLD) {
          snapX = nb.right - nodeW;
          verticalLine = { x: nb.right, y1: Math.min(bounds.top, nb.top) - 50, y2: Math.max(bounds.bottom, nb.bottom) + 50 };
        }
      }

      setHelperLines({ horizontal: horizontalLine, vertical: verticalLine });
      return { x: snapX, y: snapY };
    },
    [nodes, hiddenNodeIds, getNodeBounds]
  );

  const onNodeDragStart = useCallback(() => {
    pushUndo();
  }, [pushUndo]);

  /** Get a node's position in flow coordinates (walk parent chain if it has parentId). */
  const getFlowPosition = useCallback((node: Node, allNodes: Node[]): { x: number; y: number } => {
    if (!node.parentId) return { ...node.position };
    const parent = allNodes.find((n) => n.id === node.parentId);
    if (!parent) return { ...node.position };
    const parentFlow = getFlowPosition(parent, allNodes);
    return {
      x: parentFlow.x + node.position.x,
      y: parentFlow.y + node.position.y,
    };
  }, []);

  /** Return true if `group` is a descendant of `ofNode` (would create a cycle if ofNode became parent of group). */
  const isDescendantOf = useCallback((group: Node, ofNode: Node, allNodes: Node[]): boolean => {
    let current: Node | undefined = group;
    while (current?.parentId) {
      if (current.parentId === ofNode.id) return true;
      current = allNodes.find((n) => n.id === current!.parentId);
    }
    return false;
  }, []);

  /** During drag: alignment snapping + group hover highlight (agentok-style). */
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node, allNodes: Node[]) => {
      const align = checkAlignment(draggedNode);
      if (align.x !== null || align.y !== null) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === draggedNode.id
              ? {
                  ...n,
                  position: {
                    x: align.x !== null ? align.x : n.position.x,
                    y: align.y !== null ? align.y : n.position.y,
                  },
                }
              : n
          )
        );
      }
      if (draggedNode.type === "group" || draggedNode.type === "freeDraw") return;
      const DEFAULT_GROUP_WIDTH = 280;
      const DEFAULT_GROUP_HEIGHT = 200;
      const flowPos = getFlowPosition(draggedNode, allNodes);
      const nodeW = draggedNode.measured?.width ?? (draggedNode.width as number) ?? DEFAULT_NODE_WIDTH;
      const nodeH = draggedNode.measured?.height ?? (draggedNode.height as number) ?? DEFAULT_NODE_HEIGHT;
      const centerX = flowPos.x + (Number(nodeW) || DEFAULT_NODE_WIDTH) / 2;
      const centerY = flowPos.y + (Number(nodeH) || DEFAULT_NODE_HEIGHT) / 2;
      const groupNodes = allNodes.filter((n) => n.type === "group");
      const groupsWithBounds = groupNodes.map((g) => ({
        node: g,
        flowPos: getFlowPosition(g, allNodes),
        width: (g.style?.width as number) ?? DEFAULT_GROUP_WIDTH,
        height: (g.style?.height as number) ?? DEFAULT_GROUP_HEIGHT,
      }));
      const pad = 8;
      const containing = groupsWithBounds.find(
        (g) =>
          centerX >= g.flowPos.x - pad &&
          centerX <= g.flowPos.x + g.width + pad &&
          centerY >= g.flowPos.y - pad &&
          centerY <= g.flowPos.y + g.height + pad
      );
      const hoveredGroupId = containing?.node.id ?? null;
      setNodes((nds) =>
        nds.map((n) =>
          n.type === "group" ? { ...n, data: { ...n.data, hoveredGroupId } } : n
        )
      );
    },
    [checkAlignment, getFlowPosition, setNodes]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node, allNodes: Node[]) => {
      setHelperLines({ horizontal: null, vertical: null });

      // Clear group hover state
      setNodes((nds) =>
        nds.map((n) =>
          n.type === "group" ? { ...n, data: { ...n.data, hoveredGroupId: null } } : n
        )
      );

      // Subflow: if dropped node is over a group, make it a child (parentId + extent: 'parent').
      // Run after React Flow applies drag position (setTimeout) so our update isn't overwritten by onNodesChange.
      if (node.type === "freeDraw") return;

      const nodeId = node.id;
      const DEFAULT_GROUP_WIDTH = 280;
      const DEFAULT_GROUP_HEIGHT = 200;

      setTimeout(() => {
        const currentNodes = reactFlowRef.current?.getNodes() ?? allNodes;
        const groupNodes = currentNodes.filter((n) => n.type === "group");
        if (groupNodes.length === 0) return;

        const droppedNode = currentNodes.find((n) => n.id === nodeId) ?? node;
        const flowPos = getFlowPosition(droppedNode, currentNodes);
        const nodeW = droppedNode.measured?.width ?? (droppedNode.width as number) ?? DEFAULT_NODE_WIDTH;
        const nodeH = droppedNode.measured?.height ?? (droppedNode.height as number) ?? DEFAULT_NODE_HEIGHT;
        const centerX = flowPos.x + (Number(nodeW) || DEFAULT_NODE_WIDTH) / 2;
        const centerY = flowPos.y + (Number(nodeH) || DEFAULT_NODE_HEIGHT) / 2;

        const groupsWithBounds = groupNodes.map((g) => ({
          node: g,
          flowPos: getFlowPosition(g, currentNodes),
          width: (g.style?.width as number) ?? DEFAULT_GROUP_WIDTH,
          height: (g.style?.height as number) ?? DEFAULT_GROUP_HEIGHT,
        }));
        const sortedByArea = [...groupsWithBounds].sort((a, b) => a.width * a.height - b.width * b.height);
        const pad = 8; // slight padding so drop near group edge still attaches
        const containing = sortedByArea.find(
          (g) =>
            centerX >= g.flowPos.x - pad &&
            centerX <= g.flowPos.x + g.width + pad &&
            centerY >= g.flowPos.y - pad &&
            centerY <= g.flowPos.y + g.height + pad
        );

        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== nodeId) return n;
            if (!containing || containing.node.id === nodeId || isDescendantOf(containing.node, droppedNode, currentNodes)) {
              if (droppedNode.parentId) {
                return { ...n, parentId: undefined, extent: undefined, position: { x: flowPos.x, y: flowPos.y } };
              }
              return n;
            }
            const parentFlow = containing.flowPos;
            const relativePosition = {
              x: centerX - parentFlow.x - (Number(nodeW) || DEFAULT_NODE_WIDTH) / 2,
              y: centerY - parentFlow.y - (Number(nodeH) || DEFAULT_NODE_HEIGHT) / 2,
            };
            return { ...n, parentId: containing.node.id, extent: "parent" as const, position: relativePosition };
          })
        );
      }, 0);
    },
    [getFlowPosition, isDescendantOf, setNodes]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowRef.current = instance;
  }, []);

  // When external code (like the AI page) requests a fitView, run it once after
  // the nodes/edges are synced and then clear the flag.
  useEffect(() => {
    if (!pendingFitView || !reactFlowRef.current) return;
    const id = window.setTimeout(() => {
      reactFlowRef.current?.fitView({
        padding: 0.2,
        duration: 300,
      });
      setPendingFitView(false);
    }, 100);
    return () => window.clearTimeout(id);
  }, [pendingFitView, setPendingFitView]);

  // Sync store → canvas when undo/redo or hydration updates the Zustand store.
  // We track whether the store change originated from the canvas (via onNodesChange/onEdgesChange)
  // to avoid an infinite loop.
  const fromCanvasRef = useRef(false);

  useEffect(() => {
    if (fromCanvasRef.current) {
      fromCanvasRef.current = false;
      return;
    }
    setNodes(storeNodes);
    setEdges(storeEdges);
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  // onNodesChange: update React Flow local state AND push to Zustand store in one go.
  // This guarantees that every change (including updateNodeData "replace" changes)
  // reaches the store that the auto-save reads from.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        // Push to Zustand so persistence picks it up.
        // Mark the flag so the store→canvas sync ignores this update.
        fromCanvasRef.current = true;
        setStoreNodes(updated);
        return updated;
      });
    },
    [setNodes, setStoreNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        fromCanvasRef.current = true;
        setStoreEdges(updated);
        return updated;
      });
    },
    [setEdges, setStoreEdges]
  );

  const pendingEdgeType = useCanvasStore((s) => s.pendingEdgeType);
  const onConnect = useCallback(
    (params: Connection) => {
      pushUndo();
      const sh = params.sourceHandle ?? "s";
      const th = params.targetHandle ?? "t";
      const edgeId = `e${params.source}-${sh}-${params.target}-${th}-${Date.now()}`;
      const newEdge: Edge = {
        ...params,
        id: edgeId,
        type: "labeledConnector",
        data: { connectorType: pendingEdgeType },
      };
      setEdges((eds) => [...eds, newEdge]);
      addEdgeToStore(newEdge);
    },
    [setEdges, addEdgeToStore, pendingEdgeType, pushUndo]
  );

  const onConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: {
        fromNode?: { id: string } | null;
        fromHandle?: { id?: string | null } | null;
        isValid?: boolean | null;
      }
    ) => {
      if (connectionState.isValid || !connectionState.fromNode || !reactFlowRef.current) return;
      const fromNodeData = nodes.find((n) => n.id === connectionState.fromNode?.id);
      const isFromMindMap = fromNodeData?.type === "mindMap";
      const { clientX, clientY } =
        "changedTouches" in event ? (event as TouchEvent).changedTouches[0] : (event as MouseEvent);
      const position = reactFlowRef.current.screenToFlowPosition({ x: clientX, y: clientY });
      pushUndo();
      const newNodeId = `node-${Date.now()}`;
      const newNode: Node = isFromMindMap
        ? {
            id: newNodeId,
            type: "mindMap",
            position: { x: position.x - MIND_MAP_NODE_WIDTH / 2, y: position.y - 22 },
            data: { label: "New node" },
          }
        : {
            id: newNodeId,
            type: "rectangle",
            position: { x: position.x - 70, y: position.y - 36 },
            data: { label: "New node", shape: "rectangle" },
          };
      addNode(newNode);
      setNodes((nds) => [...nds, { ...newNode, selected: false }]);
      const sourceHandleId = connectionState.fromHandle?.id ?? undefined;
      const edgeId = `e-${connectionState.fromNode.id}-${sourceHandleId ?? "s"}-${newNodeId}-left-${Date.now()}`;
      const newEdge: Edge = {
        id: edgeId,
        source: connectionState.fromNode.id,
        target: newNodeId,
        sourceHandle: sourceHandleId,
        targetHandle: "left",
        type: "labeledConnector",
        data: { connectorType: pendingEdgeType },
      };
      setEdges((eds) => [...eds, newEdge]);
      addEdgeToStore(newEdge);
    },
    [nodes, addNode, setNodes, setEdges, addEdgeToStore, pushUndo, pendingEdgeType]
  );

  const handleAddMindMapNode = useCallback(
    async (newNode: Node, newEdge: Edge) => {
      pushUndo();
      const updatedNodes = [...nodes, newNode];
      const updatedEdges = [...edges, newEdge];
      setNodes(updatedNodes);
      setEdges(updatedEdges);

      // Only layout non-freehand nodes
      const layoutableNodes = updatedNodes.filter((n) => !LAYOUT_EXCLUDED_TYPES.has(n.type ?? ""));
      const layoutableIds = new Set(layoutableNodes.map((n) => n.id));
      const layoutableEdges = updatedEdges.filter(
        (e) => layoutableIds.has(e.source) && layoutableIds.has(e.target)
      );

      try {
        const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
          layoutableNodes,
          layoutableEdges,
          mindMapLayout.direction,
          [mindMapLayout.spacingX, mindMapLayout.spacingY],
          mindMapLayout.algorithm
        );
        setEdges((all) =>
          all.map((e) => {
            const le = layoutedEdges.find((x) => x.id === e.id);
            return le ? { ...e, ...le } : e;
          })
        );
        const collisionFreeNodes = resolveCollisions(layoutedNodes, {
          maxIterations: 150,
          overlapThreshold: 0,
          margin: 24,
        });
        // Merge layouted positions back, leaving freehand nodes untouched
        setNodes((all) =>
          all.map((n) => {
            const ln = collisionFreeNodes.find((x) => x.id === n.id);
            return ln ? { ...n, position: ln.position } : n;
          })
        );
        setTimeout(() => {
          reactFlowRef.current?.fitView({
            padding: 0.2,
            duration: 300,
          });
        }, 50);
      } catch {
        // fallback: keep manual positions, still fit view
        setTimeout(() => {
          reactFlowRef.current?.fitView({
            padding: 0.2,
            duration: 300,
          });
        }, 100);
      }
    },
    [nodes, edges, setNodes, setEdges, pushUndo, mindMapLayout]
  );

  const createFreeDrawNode = useCallback(
    (stroke: Stroke) => {
      if (stroke.points.length < 2) return;
      const pts = stroke.points;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pts) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      const padding = stroke.size + 4;
      const normalizedPoints = pts.map(([x, y, p]) => [x - minX + padding, y - minY + padding, p] as [number, number, number]);
      pushUndo();
      const newNode: Node = {
        id: `fd-${Date.now()}`,
        type: "freeDraw",
        position: { x: minX - padding, y: minY - padding },
        data: {
          points: normalizedPoints,
          color: stroke.color,
          strokeSize: stroke.size,
          initialSize: {
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2,
          },
        },
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
      };
      // Keep existing selections; also select the new freehand node
      setNodes((nds) => [...nds, { ...newNode, selected: true }]);
      addNode(newNode);
    },
    [pushUndo, setNodes, addNode]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      const onPane = !target.closest(".react-flow__node") && !target.closest(".react-flow__controls");

      if (activeTool === "eraser" && reactFlowRef.current && onPane) {
        pushUndo();
        const pos = reactFlowRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        setIsErasing(true);
        setEraserPoints([{ x: pos.x, y: pos.y }]);
        eraseAt(pos.x, pos.y);
        return;
      }

      if (activeTool === "connector" && onPane && reactFlowRef.current && !edgeDrawStart) {
        const pos = reactFlowRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        setEdgeDrawStart({ x: pos.x, y: pos.y });
        setEdgeDrawEndPreview({ x: pos.x, y: pos.y });
        setEdgeDrawPoints([]);
        return;
      }

      if (activeTool === "freeDraw") {
        // Freehand drawing is handled by the overlay component.
        return;
      }
    },
    [activeTool, edgeDrawStart, eraseAt]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === "eraser" && isErasing && reactFlowRef.current) {
        const pos = reactFlowRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        setEraserPoints((pts) => [...pts, { x: pos.x, y: pos.y }]);
        eraseAt(pos.x, pos.y);
        return;
      }

      if (activeTool === "connector" && edgeDrawStart && reactFlowRef.current) {
        const pos = reactFlowRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        setEdgeDrawEndPreview({ x: pos.x, y: pos.y });

        // For straight edges, always preview a simple straight line (no intermediate points).
        if (pendingEdgeType === "straight") {
          return;
        }

        // For curved/step edges, collect preview points (downsampled) so the line follows the drag path.
        setEdgeDrawPoints((pts) => {
          const last = pts[pts.length - 1] ?? edgeDrawStart;
          const dx = pos.x - last.x;
          const dy = pos.y - last.y;
          const MIN_DIST_SQ = 16; // ~4px
          if (dx * dx + dy * dy < MIN_DIST_SQ) return pts;

          const MAX_POINTS = 200;
          const next = { x: pos.x, y: pos.y };
          if (pts.length >= MAX_POINTS) {
            return [...pts.slice(pts.length - MAX_POINTS + 1), next];
          }
          return [...pts, next];
        });
        return;
      }
      if (activeTool === "freeDraw") {
        // Freehand drawing is handled by the overlay component.
        return;
      }
    },
    [activeTool, edgeDrawStart, pendingEdgeType, isErasing, eraseAt]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === "eraser" && isErasing) {
        setIsErasing(false);
        setEraserPoints([]);
        return;
      }

      // Finish standalone connector on mouse/touch release
      if (activeTool === "connector" && edgeDrawStart && reactFlowRef.current) {
        const pos = reactFlowRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });

        // If the drag didn't really move, don't create a degenerate edge
        const dx = pos.x - edgeDrawStart.x;
        const dy = pos.y - edgeDrawStart.y;
        const distSq = dx * dx + dy * dy;
        const MIN_DIST_SQ = 4; // 2px in flow units (roughly)

        if (distSq >= MIN_DIST_SQ) {
          pushUndo();
          const half = EDGE_ANCHOR_SIZE / 2;
          const id1 = `anchor-${Date.now()}-1`;
          const id2 = `anchor-${Date.now()}-2`;
          const anchor1: Node = {
            id: id1,
            type: "edgeAnchor",
            position: { x: edgeDrawStart.x - half, y: edgeDrawStart.y - half },
            data: {},
          };
          const anchor2: Node = {
            id: id2,
            type: "edgeAnchor",
            position: { x: pos.x - half, y: pos.y - half },
            data: {},
          };
          const edgeId = `e-${id1}-${id2}-${Date.now()}`;
          const newEdge: Edge = {
            id: edgeId,
            source: id1,
            target: id2,
            sourceHandle: "right",
            targetHandle: "left",
            type: "labeledConnector",
            data: {
              connectorType: pendingEdgeType,
              // For straight edges, ignore drag path points so the edge is a true straight line.
              pathPoints: pendingEdgeType === "straight" ? [] : edgeDrawPoints,
            },
          };
          addNode(anchor1);
          addNode(anchor2);
          addEdgeToStore(newEdge);
          setNodes((nds) => [...nds, anchor1, anchor2]);
          setEdges((eds) => [...eds, newEdge]);
        }

        setEdgeDrawStart(null);
        setEdgeDrawEndPreview(null);
        setEdgeDrawPoints([]);
        return;
      }

      if (activeTool === "freeDraw") {
        // Freehand stroke lifecycle is fully handled by the overlay.
        return;
      }
    },
    [
      activeTool,
      edgeDrawStart,
      edgeDrawPoints,
      pendingEdgeType,
      addNode,
      addEdgeToStore,
      setNodes,
      setEdges,
      pushUndo,
      setEdgeDrawStart,
      setEdgeDrawEndPreview,
      setEdgeDrawPoints,
      isErasing,
    ]
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (
        activeTool === "select" ||
        activeTool === "selection" ||
        activeTool === "move" ||
        activeTool === "eraser" ||
        activeTool === "pan" ||
        activeTool === "ai" ||
        activeTool === "freeDraw"
      )
        return;

      const target = event.target as HTMLElement;
      if (target.closest(".react-flow__node")) return;

      if (!reactFlowRef.current) return;

      const { x: flowX, y: flowY } = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (activeTool === "connector") {
        // Standalone connector drawing is handled via pointer down/move/up;
        // pane clicks while in connector mode should not start or finish edges.
        return;
      }

      if (activeTool === "emoji") {
        if (pendingIconId) {
          pushUndo();
          const id = `icon-${Date.now()}`;
          const size = 64;
          const newNode: Node = {
            id,
            type: "icon",
            position: { x: flowX - size / 2, y: flowY - size / 2 },
            data: { iconId: pendingIconId },
            width: size,
            height: size,
          };
          addNode(newNode);
          setNodes((nds) => [...nds, { ...newNode, selected: true }]);
          setActiveTool("select");
          setPendingIconId(null);
        } else if (pendingEmoji) {
          pushUndo();
          const id = `emoji-${Date.now()}`;
          const size = 64;
          const newNode: Node = {
            id,
            type: "icon",
            position: { x: flowX - size / 2, y: flowY - size / 2 },
            data: { emoji: pendingEmoji },
            width: size,
            height: size,
          };
          addNode(newNode);
          setNodes((nds) => [...nds, { ...newNode, selected: true }]);
          setActiveTool("select");
          setPendingEmoji(null);
        }
        return;
      }

      if (activeTool === "image" && pendingImageUrl) {
        pushUndo();
        const id = `image-${Date.now()}`;
        const imageLabel = pendingImageLabel || "Image";
        const newNode: Node = {
          id,
          type: "image",
          position: { x: flowX - 100, y: flowY - 75 },
          data: { label: imageLabel, imageUrl: pendingImageUrl },
          width: 200,
          height: 150,
        };
        addNode(newNode);
        setNodes((nds) => [...nds, { ...newNode, selected: true }]);
        setActiveTool("select");
        setPendingImage(null);
        return;
      }

      const nodeTypesMap: Record<string, string> = {
        stickyNote: "stickyNote",
        rectangle: "rectangle",
        diamond: "diamond",
        circle: "circle",
        document: "document",
        table: "table",
        text: "text",
        mindMap: "mindMap",
        frame: "rectangle",
        list: "text",
        databaseSchema: "databaseSchema",
        service: "service",
        queue: "queue",
        actor: "actor",
        group: "group",
      };

      const isShapeType = ["rectangle", "diamond", "circle", "document"].includes(activeTool);
      const shapeFromPending = isShapeType && pendingShape ? pendingShape : null;
      const shape =
        shapeFromPending ??
        (activeTool === "rectangle"
          ? "rectangle"
          : activeTool === "document"
            ? "document"
            : activeTool === "diamond"
              ? "diamond"
              : activeTool === "circle"
                ? "circle"
                : "rectangle");

      const type =
        shape === "table"
          ? "table"
          : (nodeTypesMap[activeTool] ?? "rectangle");
      const id = `node-${Date.now()}`;

      pushUndo();

      const getDefaultData = () => {
        if (type === "table") return { tableRows: 3, tableCols: 3, cells: {} };
        if (type === "rectangle" || type === "diamond" || type === "circle" || type === "document")
          return {
            label: shape === "diamond" ? "Decision" : shape === "circle" ? "Process" : shape === "document" ? "Document" : "Node",
            shape,
          };
        if (type === "databaseSchema")
          return { label: "Table", columns: [{ name: "id", type: "uuid", key: "PK" }, { name: "created_at", type: "timestamp", key: "" }] };
        if (type === "service") return { label: "Service", subtitle: "" };
        if (type === "queue") return { label: "Queue" };
        if (type === "actor") return { label: "Actor" };
        if (type === "group") return { label: "Group" };
        return { label: type === "mindMap" ? "Mind map" : "New node" };
      };

      const newNode: Node = {
        id,
        type: type as keyof typeof nodeTypes,
        position: { x: flowX - 120, y: flowY - 80 },
        data: getDefaultData(),
        ...(type === "table" && { width: 240, height: 160 }),
        ...(type === "group" && { style: { width: 280, height: 200 } }),
      };

      addNode(newNode);
      setNodes((nds) => [...nds, { ...newNode, selected: false }]);
      setActiveTool("select");
      setPendingShape(null);
    },
    [
      activeTool,
      pendingShape,
      setPendingShape,
      pendingEmoji,
      setPendingEmoji,
      pendingIconId,
      setPendingIconId,
      pendingImageUrl,
      pendingImageLabel,
      setPendingImage,
      addNode,
      setNodes,
      setActiveTool,
      pushUndo,
    ]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const payload = getDragPayload(e.dataTransfer);
      if (!payload || !reactFlowRef.current) return;
      const position = reactFlowRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      const flowX = position.x;
      const flowY = position.y;

      const id = payload.type === "icon" ? `icon-${Date.now()}` : payload.type === "image" ? `image-${Date.now()}` : `node-${Date.now()}`;

      let newNode: Node;

      if (payload.type === "icon" && payload.data) {
        const size = 64;
        newNode = {
          id,
          type: "icon",
          position: { x: flowX - size / 2, y: flowY - size / 2 },
          data: payload.data.iconId ? { iconId: payload.data.iconId } : { emoji: payload.data.emoji ?? "" },
          width: size,
          height: size,
        };
      } else if (payload.type === "image" && payload.data) {
        newNode = {
          id,
          type: "image",
          position: { x: flowX - 100, y: flowY - 75 },
          data: { label: payload.data.label, imageUrl: payload.data.imageUrl },
          width: 200,
          height: 150,
        };
      } else {
        const typeMap: Record<string, string> = {
          rectangle: "rectangle",
          stickyNote: "stickyNote",
          text: "text",
          mindMap: "mindMap",
          databaseSchema: "databaseSchema",
          service: "service",
          queue: "queue",
          actor: "actor",
          group: "group",
        };
        const shape = payload.type === "rectangle" ? (payload.shape ?? "rectangle") : null;
        const isTable = shape === "table";
        const type = isTable ? "table" : (typeMap[payload.type] ?? "rectangle");
        const getDefaultData = (): Record<string, unknown> => {
          if (type === "table") return { tableRows: 3, tableCols: 3, cells: {} };
          if (type === "databaseSchema") return { label: "Table", columns: [{ name: "id", type: "uuid", key: "PK" }, { name: "created_at", type: "timestamp", key: "" }] };
          if (type === "service") return { label: "Service", subtitle: "" };
          if (type === "queue") return { label: "Queue" };
          if (type === "actor") return { label: "Actor" };
          if (type === "group") return { label: "Group" };
          if (type === "rectangle" && shape) {
            const label = shape === "diamond" ? "Decision" : shape === "circle" ? "Process" : shape === "document" ? "Document" : "Node";
            return { label, shape };
          }
          if (type === "stickyNote") return { label: "Note" };
          if (type === "text") return { label: "Text" };
          if (type === "mindMap") return { label: "Mind map" };
          return { label: "Node", shape: "rectangle" };
        };
        newNode = {
          id,
          type: type as keyof typeof nodeTypes,
          position: { x: flowX - 120, y: flowY - 80 },
          data: getDefaultData(),
          ...(type === "table" && { width: 240, height: 160 }),
          ...(type === "group" && { style: { width: 280, height: 200 } }),
        };
      }

      // If drop is inside a group, make this node a child (any node type can be in a group).
      const currentNodes = reactFlowRef.current.getNodes();
      const groupNodes = currentNodes.filter((n) => n.type === "group");
      const DEFAULT_GROUP_WIDTH = 280;
      const DEFAULT_GROUP_HEIGHT = 200;
      const nodeW = (newNode.width as number) ?? DEFAULT_NODE_WIDTH;
      const nodeH = (newNode.height as number) ?? DEFAULT_NODE_HEIGHT;
      const centerX = newNode.position.x + nodeW / 2;
      const centerY = newNode.position.y + nodeH / 2;

      if (groupNodes.length > 0) {
        const groupsWithBounds = groupNodes.map((g) => ({
          node: g,
          flowPos: getFlowPosition(g, currentNodes),
          width: (g.style?.width as number) ?? DEFAULT_GROUP_WIDTH,
          height: (g.style?.height as number) ?? DEFAULT_GROUP_HEIGHT,
        }));
        const sortedByArea = [...groupsWithBounds].sort((a, b) => a.width * a.height - b.width * b.height);
        const pad = 8;
        const containing = sortedByArea.find(
          (g) =>
            centerX >= g.flowPos.x - pad &&
            centerX <= g.flowPos.x + g.width + pad &&
            centerY >= g.flowPos.y - pad &&
            centerY <= g.flowPos.y + g.height + pad
        );
        if (containing && containing.node.id !== id) {
          const parentFlow = containing.flowPos;
          newNode = {
            ...newNode,
            parentId: containing.node.id,
            extent: "parent",
            position: {
              x: centerX - parentFlow.x - nodeW / 2,
              y: centerY - parentFlow.y - nodeH / 2,
            },
          };
        }
      }

      pushUndo();
      addNode(newNode);
      const nodeToAdd = { ...newNode, selected: true };
      setNodes((nds) => {
        if (nodeToAdd.parentId) {
          const groupIndex = nds.findIndex((n) => n.id === nodeToAdd.parentId);
          if (groupIndex !== -1) {
            const next = [...nds];
            next.splice(groupIndex + 1, 0, nodeToAdd);
            return next;
          }
        }
        return [...nds, nodeToAdd];
      });
      setActiveTool("select");
    },
    [addNode, setNodes, setActiveTool, pushUndo, getFlowPosition]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeTool === "freeDraw") {
          setActiveTool("select");
        } else if (activeTool === "connector" && edgeDrawStart) {
          setEdgeDrawStart(null);
          setEdgeDrawEndPreview(null);
          setEdgeDrawPoints([]);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, setActiveTool, edgeDrawStart]);

  useEffect(() => {
    return () => {
      reactFlowRef.current = null;
    };
  }, []);

  // Add default mind map template after canvas is mounted (only if store is empty)
  const hasAddedDefaultTemplate = useRef(false);
  useEffect(() => {
    if (storeNodes.length === 0 && storeEdges.length === 0 && !hasAddedDefaultTemplate.current) {
      hasAddedDefaultTemplate.current = true;
      // Wait for canvas to be fully mounted before adding nodes
      const timeout = setTimeout(() => {
        setNodes(defaultNodes);
        setEdges(defaultEdges);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [storeNodes.length, storeEdges.length, setNodes, setEdges]);

  const onPointerLeave = useCallback(() => {
    // No-op for freehand; overlay handles stroke lifecycle.
  }, []);

  const handleUpdateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        )
      );
    },
    [setNodes]
  );

  const handleFreehandStrokeComplete = useCallback(
    (stroke: Stroke) => {
      createFreeDrawNode(stroke);
    },
    [createFreeDrawNode]
  );

  // Note: localStorage persistence is now handled by useProjectPersistence() in EditorLayout.

  /** Node types excluded from layout algorithms (they have freeform positions). */
  const LAYOUT_EXCLUDED_TYPES = new Set(["freeDraw", "edgeAnchor", "group"]);

  const handleLayoutSelectedNodes = useCallback(async () => {
    if (selectedNodeIds.length < 2) return;

    const selectedSet = new Set(selectedNodeIds);
    const subNodes = nodes.filter(
      (n) => selectedSet.has(n.id) && !LAYOUT_EXCLUDED_TYPES.has(n.type ?? "")
    );
    const subEdges = edges.filter(
      (e) => selectedSet.has(e.source) && selectedSet.has(e.target)
    );

    if (subNodes.length < 2) return;

    const direction: LayoutDirection = "LR";
    const { nodes: layoutedNodes, edges: layoutedEdges } =
      await getLayoutedElements(subNodes, subEdges, direction, [140, 120], "elk-layered");

    setNodes((all) =>
      all.map((n) => {
        const ln = layoutedNodes.find((x) => x.id === n.id);
        return ln ? { ...n, position: ln.position } : n;
      })
    );
    setEdges((all) =>
      all.map((e) => {
        const le = layoutedEdges.find((x) => x.id === e.id);
        return le
          ? {
              ...e,
              sourceHandle: le.sourceHandle ?? e.sourceHandle,
              targetHandle: le.targetHandle ?? e.targetHandle,
            }
          : e;
      })
    );
  }, [selectedNodeIds, nodes, edges, setNodes, setEdges]);

  const handleLayoutAllNodes = useCallback(async () => {
    // Filter out freehand / anchor / group nodes — only layout structured nodes
    const layoutableNodes = nodes.filter((n) => !LAYOUT_EXCLUDED_TYPES.has(n.type ?? ""));
    if (layoutableNodes.length < 2) return;

    pushUndo();

    const direction: LayoutDirection = mindMapLayout.direction;
    const spacing: [number, number] = [mindMapLayout.spacingX, mindMapLayout.spacingY];

    const layoutableIds = new Set(layoutableNodes.map((n) => n.id));
    const layoutableEdges = edges.filter(
      (e) => layoutableIds.has(e.source) && layoutableIds.has(e.target)
    );

    const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
      layoutableNodes,
      layoutableEdges,
      direction,
      spacing,
      mindMapLayout.algorithm
    );

    // Merge back — only update nodes that were layouted; leave freehand/groups untouched
    setNodes((all) =>
      all.map((n) => {
        const ln = layoutedNodes.find((x) => x.id === n.id);
        return ln ? { ...n, position: ln.position } : n;
      })
    );
    setEdges((all) =>
      all.map((e) => {
        const le = layoutedEdges.find((x) => x.id === e.id);
        return le
          ? {
              ...e,
              sourceHandle: le.sourceHandle ?? e.sourceHandle,
              targetHandle: le.targetHandle ?? e.targetHandle,
            }
          : e;
      })
    );
  }, [nodes, edges, mindMapLayout, setNodes, setEdges, pushUndo]);

  return (
    <MindMapLayoutProvider
      onAddAndLayout={handleAddMindMapNode}
      onUpdateNodeData={handleUpdateNodeData}
    >
      <div
        className="w-full h-full relative"
        style={{
          cursor:
            activeTool === "freeDraw" || activeTool === "connector"
              ? "crosshair"
              : (activeTool === "emoji" && (pendingIconId || pendingEmoji)) ||
                  (activeTool === "image" && pendingImageUrl)
                ? "crosshair"
                : activeTool === "pan"
                  ? "grab"
                  : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        <KeyboardHandler
        getNodes={() => nodes}
        getEdges={() => edges}
        setNodes={setNodes}
        setEdges={setEdges}
        screenToFlowPosition={(pos) =>
          reactFlowRef.current?.screenToFlowPosition(pos) ?? pos
        }
        pushUndo={pushUndo}
        undo={undo}
        redo={redo}
      />
        {activeTool === "freeDraw" && reactFlowRef.current && (
          <FreehandOverlay
            onStrokeComplete={handleFreehandStrokeComplete}
            screenToFlowPosition={(pos) =>
              reactFlowRef.current?.screenToFlowPosition(pos) ?? pos
            }
            zoom={reactFlowRef.current?.getViewport().zoom ?? 1}
          />
        )}
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          onInit={onInit}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={!presentationMode && activeTool !== "freeDraw"}
          nodesConnectable={!presentationMode && activeTool !== "freeDraw"}
          elementsSelectable={activeTool !== "freeDraw"}
          edgesFocusable={activeTool !== "freeDraw"}
          zoomOnScroll={!presentationMode}
          zoomOnPinch={!presentationMode}
          zoomOnDoubleClick={!presentationMode}
          panOnDrag={!presentationMode && activeTool === "select"}
          panActivationKeyCode={presentationMode ? undefined : "Space"}
          selectionOnDrag={!presentationMode && activeTool === "selection"}
          selectionMode={SelectionMode.Partial}
          minZoom={0.1}
          maxZoom={4}
          connectionLineType={
            pendingEdgeType === "straight"
              ? ConnectionLineType.Straight
              : pendingEdgeType === "smoothstep"
                ? ConnectionLineType.SmoothStep
                : ConnectionLineType.Bezier
          }
          connectionLineComponent={CustomConnectionLine}
          defaultEdgeOptions={{
            type: "labeledConnector",
            data: { connectorType: "default" },
          }}
          snapGrid={[16, 16]}
          snapToGrid
          connectionRadius={40}
          proOptions={{ hideAttribution: true }}
        >
        <HelperLines horizontal={helperLines.horizontal} vertical={helperLines.vertical} />
        <EdgeDrawPreview
          start={edgeDrawStart}
          end={edgeDrawEndPreview}
          // For straight edges, preview a pure straight line.
          points={pendingEdgeType === "straight" ? [] : edgeDrawPoints}
        />
        <EraserPreview points={isErasing ? eraserPoints : []} />
        {presentationMode
          ? <Background variant={BackgroundVariant.Dots} gap={16} size={0} color="transparent" className="!bg-white" />
          : <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        }
        {!presentationMode && (
          <MiniMap
            nodeColor="#a78bfa"
            maskColor="rgba(0, 0, 0, 0.1)"
            className="!bg-gray-50"
          />
        )}
        {!presentationMode && (
          <MindMapLayoutPanel
            setNodes={setNodes}
            setEdges={setEdges}
            fitView={() =>
              reactFlowRef.current?.fitView({ padding: 0.2, duration: 300 })
            }
          />
        )}
        {!presentationMode && <MobileColorIndicator />}
        {!presentationMode && (
          <CanvasBottomBar
            selectedNodeCount={selectedNodeIds.length}
            onLayoutSelection={handleLayoutSelectedNodes}
            onLayoutAll={handleLayoutAllNodes}
          />
        )}
        <PresentationMode />
      </ReactFlow>
      {contextMenu && (
        <AIContextMenu
          nodeId={contextMenu.nodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
      </div>
    </MindMapLayoutProvider>
  );
}
