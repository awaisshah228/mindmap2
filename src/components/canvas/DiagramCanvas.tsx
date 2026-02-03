"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
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
  Panel,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import { KeyboardHandler } from "./KeyboardHandler";
import { HelperLines } from "./HelperLines";
import { getLayoutedElements } from "@/lib/layout-engine";
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
  const addNode = useCanvasStore((s) => s.addNode);
  const addEdgeToStore = useCanvasStore((s) => s.addEdge);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const mindMapLayout = useCanvasStore((s) => s.mindMapLayout);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const skipCanvasToStoreRef = useRef(false);

  const [helperLines, setHelperLines] = useState<{
    horizontal: { y: number; x1: number; x2: number } | null;
    vertical: { x: number; y1: number; y2: number } | null;
  }>({ horizontal: null, vertical: null });

  const [edgeDrawStart, setEdgeDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [edgeDrawEndPreview, setEdgeDrawEndPreview] = useState<{ x: number; y: number } | null>(null);
  const [edgeDrawPoints, setEdgeDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [eraserPoints, setEraserPoints] = useState<{ x: number; y: number }[]>([]);
  const [isErasing, setIsErasing] = useState(false);

  const hiddenNodeIds = useMemo(
    () => getHiddenNodeIds(nodes, edges),
    [nodes, edges]
  );

  const visibleNodes = useMemo(
    () =>
      nodes.map((n) =>
        hiddenNodeIds.has(n.id) ? { ...n, hidden: true as const } : n
      ),
    [nodes, hiddenNodeIds]
  );

  const visibleEdges = useMemo(
    () =>
      edges.map((e) =>
        hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target)
          ? { ...e, hidden: true as const }
          : e
      ),
    [edges, hiddenNodeIds]
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

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const align = checkAlignment(node);
      if (align.x !== null || align.y !== null) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === node.id
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
    },
    [checkAlignment, setNodes]
  );

  const onNodeDragStop = useCallback(() => {
    setHelperLines({ horizontal: null, vertical: null });
    setNodes((nds) => {
      const movable = nds.filter((n) => n.type !== "freeDraw");
      const freeDraw = nds.filter((n) => n.type === "freeDraw");
      const resolved = resolveCollisions(movable, {
        maxIterations: 100,
        overlapThreshold: 0.5,
        margin: 15,
      });
      return [...resolved, ...freeDraw];
    });
  }, [setNodes]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowRef.current = instance;
  }, []);

  // Sync canvas → store for persistence (skip when we just applied store → canvas to avoid loop)
  useEffect(() => {
    if (skipCanvasToStoreRef.current) {
      skipCanvasToStoreRef.current = false;
      return;
    }
    setStoreNodes(nodes);
    setStoreEdges(edges);
  }, [nodes, edges, setStoreNodes, setStoreEdges]);

  // Sync store → canvas when undo/redo (or store) updates; apply so position/dimension/delete undo works
  useEffect(() => {
    setNodes(storeNodes);
    setEdges(storeEdges);
    skipCanvasToStoreRef.current = true;
  }, [storeNodes, storeEdges, setNodes, setEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
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

      try {
        const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
          updatedNodes,
          updatedEdges,
          mindMapLayout.direction,
          [mindMapLayout.spacingX, mindMapLayout.spacingY],
          mindMapLayout.algorithm
        );
        setEdges(layoutedEdges);
        const collisionFreeNodes = resolveCollisions(layoutedNodes, {
          maxIterations: 150,
          overlapThreshold: 0,
          margin: 24,
        });
        setNodes(collisionFreeNodes);
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
          setActiveTool("move");
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
          setActiveTool("move");
          setPendingEmoji(null);
        }
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

      const newNode: Node = {
        id,
        type: type as keyof typeof nodeTypes,
        position: { x: flowX - 120, y: flowY - 80 },
        data:
          type === "table"
            ? {
                tableRows: 3,
                tableCols: 3,
                cells: {},
              }
            : type === "rectangle" || type === "diamond" || type === "circle" || type === "document"
              ? {
                  label:
                    shape === "diamond" ? "Decision" : shape === "circle" ? "Process" : shape === "document" ? "Document" : "Node",
                  shape,
                }
              : { label: type === "mindMap" ? "Mind map" : "New node" },
        ...(type === "table" && { width: 240, height: 160 }),
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
      addNode,
      setNodes,
      setActiveTool,
      pushUndo,
    ]
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
        {activeTool === "freeDraw" && (
          <FreehandOverlay onStrokeComplete={handleFreehandStrokeComplete} />
        )}
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
          onPaneClick={onPaneClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={activeTool !== "freeDraw"}
          nodesConnectable={activeTool !== "freeDraw"}
          elementsSelectable={activeTool !== "freeDraw"}
          edgesFocusable={activeTool !== "freeDraw"}
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick
          panOnDrag={activeTool === "pan"}
          selectionOnDrag={activeTool === "select"}
          selectionMode="partial"
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
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showZoom showFitView showInteractive />
        <MiniMap
          nodeColor="#a78bfa"
          maskColor="rgba(0, 0, 0, 0.1)"
          className="!bg-gray-50"
        />
        <MindMapLayoutPanel
          setNodes={setNodes}
          setEdges={setEdges}
          fitView={() =>
            reactFlowRef.current?.fitView({ padding: 0.2, duration: 300 })
          }
        />
        <MobileColorIndicator />
        <Panel position="bottom-right" className="flex flex-col gap-2 m-2">
          <span className="text-xs text-gray-500 px-2 py-1 bg-white/80 rounded shadow">
            Ctrl/Cmd+Z undo • Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo • Ctrl+A select all • Ctrl+C/V copy/paste • Del delete • Esc deselect
          </span>
        </Panel>
      </ReactFlow>
      </div>
    </MindMapLayoutProvider>
  );
}
