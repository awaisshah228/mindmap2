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
  ConnectionMode,
} from "@xyflow/react";
import { KeyboardHandler } from "./KeyboardHandler";
import { PresentationMode } from "@/components/panels/PresentationMode";
import { HelperLines } from "./HelperLines";
import { getLayoutedElements, type LayoutDirection } from "@/lib/layout-engine";
import { useAutoLayout } from "@/hooks/useAutoLayout";
import { resolveCollisions } from "@/lib/resolve-collisions";
import { getHiddenNodeIds } from "@/lib/mindmap-utils";
import "@xyflow/react/dist/style.css";
import { useCanvasStore } from "@/lib/store/canvas-store";

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
import { CustomMarkerDefs } from "@/components/edges/CustomMarkerDefs";
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
const LAYOUT_EXCLUDED_TYPES = new Set(["freeDraw", "edgeAnchor"]);

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

// Default mind map template is now created in project-storage.ts only
// for brand-new projects on first app load.
const MIND_MAP_NODE_WIDTH = 170;

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
  const pendingIconLabel = useCanvasStore((s) => s.pendingIconLabel);
  const setPendingIconLabel = useCanvasStore((s) => s.setPendingIconLabel);
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
  const pendingFitViewNodeIds = useCanvasStore((s) => (s as any).pendingFitViewNodeIds);
  const setPendingFitView = useCanvasStore((s) => (s as any).setPendingFitView);
  const setPendingFitViewNodeIds = useCanvasStore((s) => (s as any).setPendingFitViewNodeIds);
  const presentationMode = useCanvasStore((s) => s.presentationMode);
  const canvasBackgroundVariant = useCanvasStore((s) => s.canvasBackgroundVariant);
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
  // the nodes/edges are synced and the canvas has painted. Optionally fit only to specific nodes (e.g. newly added AI diagram).
  useEffect(() => {
    if (!pendingFitView || !reactFlowRef.current) return;
    const nodeIds = pendingFitViewNodeIds;
    let cancelled = false;
    const runFit = () => {
      if (cancelled || !reactFlowRef.current) return;
      if (nodeIds && nodeIds.length > 0) {
        reactFlowRef.current.fitView({
          nodes: nodeIds.map((id: string) => ({ id })),
          padding: 0.25,
          duration: 300,
        });
      } else {
        reactFlowRef.current.fitView({
          padding: 0.2,
          duration: 300,
        });
      }
      setPendingFitView(false);
      setPendingFitViewNodeIds(null);
    };
    // Wait for layout/paint then run fit so the diagram is fully in view
    const t1 = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(runFit);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
    };
  }, [pendingFitView, pendingFitViewNodeIds, setPendingFitView, setPendingFitViewNodeIds]);

  // Sync store → canvas when undo/redo or hydration updates the Zustand store.
  // We track whether the store change originated from the canvas (via onNodesChange/onEdgesChange)
  // to avoid an infinite loop.  We use a counter instead of a boolean so that
  // multiple rapid updates (e.g. setNodes + setEdges) don't accidentally reset
  // the flag before both are processed.
  const fromCanvasRef = useRef(0);

  useEffect(() => {
    // When canvas-originated changes update the Zustand store (via setStoreNodes /
    // setStoreEdges), the counter is incremented. React 18 batches multiple setState
    // calls into a single render, so multiple store updates can happen before this
    // effect runs. Resetting to 0 (instead of decrementing) correctly handles any
    // number of batched updates.
    if (fromCanvasRef.current > 0) {
      fromCanvasRef.current = 0;
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
        fromCanvasRef.current++;
        queueMicrotask(() => setStoreNodes(updated));
        return updated;
      });
    },
    [setNodes, setStoreNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        fromCanvasRef.current++;
        queueMicrotask(() => setStoreEdges(updated));
        return updated;
      });
    },
    [setEdges, setStoreEdges]
  );

  const pendingEdgeType = useCanvasStore((s) => s.pendingEdgeType);
  const onConnect = useCallback(
    (params: Connection) => {
      pushUndo();
      // If the connection originates from the easy-connect overlay, resolve to
      // a real handle based on relative position of source → target.
      let resolvedSourceHandle = params.sourceHandle;
      if (resolvedSourceHandle === "__easy-connect__" && reactFlowRef.current) {
        const sourceNode = reactFlowRef.current.getNode(params.source);
        const targetNode = reactFlowRef.current.getNode(params.target);
        if (sourceNode && targetNode) {
          const sW = (sourceNode.measured?.width ?? (sourceNode.width as number | undefined)) || 140;
          const sH = (sourceNode.measured?.height ?? (sourceNode.height as number | undefined)) || 72;
          const tW = (targetNode.measured?.width ?? (targetNode.width as number | undefined)) || 140;
          const tH = (targetNode.measured?.height ?? (targetNode.height as number | undefined)) || 72;
          const dx = (targetNode.position.x + tW / 2) - (sourceNode.position.x + sW / 2);
          const dy = (targetNode.position.y + tH / 2) - (sourceNode.position.y + sH / 2);
          if (Math.abs(dx) >= Math.abs(dy)) {
            resolvedSourceHandle = dx > 0 ? "right" : "left";
          } else {
            resolvedSourceHandle = dy > 0 ? "bottom" : "top";
          }
        } else {
          resolvedSourceHandle = "right";
        }
      }
      const sh = resolvedSourceHandle ?? "s";
      const th = params.targetHandle ?? "t";
      const edgeId = `e${params.source}-${sh}-${params.target}-${th}-${Date.now()}`;
      const newEdge: Edge = {
        ...params,
        id: edgeId,
        sourceHandle: resolvedSourceHandle,
        type: "labeledConnector",
        data: { connectorType: pendingEdgeType },
      };
      setEdges((eds) => {
        const updated = [...eds, newEdge];
        fromCanvasRef.current++;
        queueMicrotask(() => setStoreEdges(updated));
        return updated;
      });
    },
    [setEdges, setStoreEdges, pendingEdgeType, pushUndo]
  );

  const onConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: {
        fromNode?: { id: string } | null;
        fromHandle?: { id?: string | null; type?: string | null } | null;
        isValid?: boolean | null;
      }
    ) => {
      if (connectionState.isValid || !connectionState.fromNode || !reactFlowRef.current) return;

      // Read current nodes from React Flow (avoids stale closure)
      const currentNodes = reactFlowRef.current.getNodes();
      const fromNodeData = currentNodes.find((n) => n.id === connectionState.fromNode?.id);

      const { clientX, clientY } =
        "changedTouches" in event ? (event as TouchEvent).changedTouches[0] : (event as MouseEvent);
      const position = reactFlowRef.current.screenToFlowPosition({ x: clientX, y: clientY });
      pushUndo();

      const newNodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const fromType = fromNodeData?.type ?? "rectangle";

      // ── Create a new node matching the type of the source node ──
      // All shape variants (diamond, circle, document, roundedRect, hexagon, etc.)
      // are normalised to type:"rectangle" with data.shape holding the visual variant.
      // This matches the toolbar's node-creation behaviour and ensures 4 handles (top,
      // bottom, left, right) via ShapeNode.

      // Set of React Flow node types that are all rendered by ShapeNode.
      // No matter which type the source node has, the NEW node always uses "rectangle".
      const SHAPE_RF_TYPES = new Set(["rectangle", "diamond", "circle", "document"]);

      let newNode: Node;

      if (fromType === "mindMap") {
        newNode = {
          id: newNodeId,
          type: "mindMap",
          position: { x: position.x - MIND_MAP_NODE_WIDTH / 2, y: position.y - 22 },
          data: { label: "New node" },
        };
      } else if (fromType === "icon") {
        newNode = {
          id: newNodeId,
          type: "icon",
          position: { x: position.x - 32, y: position.y - 32 },
          data: { emoji: "💡" },
          width: 64,
          height: 64,
        };
      } else if (fromType === "image") {
        newNode = {
          id: newNodeId,
          type: "image",
          position: { x: position.x - 80, y: position.y - 60 },
          data: { label: "", imageUrl: "" },
          width: 160,
          height: 120,
        };
      } else if (fromType === "stickyNote") {
        newNode = {
          id: newNodeId,
          type: "stickyNote",
          position: { x: position.x - 80, y: position.y - 80 },
          data: { label: "" },
        };
      } else if (fromType === "text") {
        newNode = {
          id: newNodeId,
          type: "text",
          position: { x: position.x - 80, y: position.y - 20 },
          data: { label: "Text" },
        };
      } else if (fromType === "databaseSchema") {
        newNode = {
          id: newNodeId,
          type: "databaseSchema",
          position: { x: position.x - 100, y: position.y - 50 },
          data: { label: "new_table", columns: [] },
        };
      } else if (fromType === "table") {
        newNode = {
          id: newNodeId,
          type: "table",
          position: { x: position.x - 120, y: position.y - 80 },
          data: { tableRows: 3, tableCols: 3, cells: {} },
          width: 240,
          height: 160,
        };
      } else if (fromType === "service" || fromType === "queue" || fromType === "actor") {
        newNode = {
          id: newNodeId,
          type: fromType,
          position: { x: position.x - 60, y: position.y - 40 },
          data: { label: "New node" },
        };
      } else if (fromType === "group") {
        newNode = {
          id: newNodeId,
          type: "group",
          position: { x: position.x - 140, y: position.y - 100 },
          data: { label: "Group" },
          style: { width: 280, height: 200 },
        };
      } else {
        // Default: shape node. Always create as type:"rectangle" with the correct
        // data.shape so ShapeNode renders 4 handles. Works for any shape variant
        // (roundedRect, hexagon, cylinder, parallelogram, trapezoid, stadium,
        // triangle, diamond, circle, document, etc.) regardless of the React Flow
        // type the source node was registered under.
        const fromShape = (fromNodeData?.data?.shape as string | undefined)
          || (SHAPE_RF_TYPES.has(fromType) ? fromType : "rectangle");
        newNode = {
          id: newNodeId,
          type: "rectangle",
          position: { x: position.x - 70, y: position.y - 36 },
          data: { label: "New node", shape: fromShape },
        };
      }

      // ── Determine best source / target handle pair ──
      // All node handles are type="source" with ConnectionMode.Loose enabled.
      // Edge direction is always: fromNode → newNode.
      const rawHandle = connectionState.fromHandle?.id ?? undefined;

      const knownHandles = ["top", "bottom", "left", "right"];
      const oppositeHandle: Record<string, string> = {
        top: "bottom",
        bottom: "top",
        left: "right",
        right: "left",
      };

      let fromNodeHandle: string;
      let newNodeHandle: string;

      if (rawHandle && knownHandles.includes(rawHandle)) {
        fromNodeHandle = rawHandle;
        newNodeHandle = oppositeHandle[rawHandle] ?? "left";
      } else {
        // Easy-connect or unknown handle: pick best direction based on position
        const fromPos = fromNodeData?.position;
        const fromW = (fromNodeData?.measured?.width ?? (fromNodeData?.width as number | undefined)) || 140;
        const fromH = (fromNodeData?.measured?.height ?? (fromNodeData?.height as number | undefined)) || 72;
        if (fromPos) {
          const dx = position.x - (fromPos.x + fromW / 2);
          const dy = position.y - (fromPos.y + fromH / 2);
          if (Math.abs(dx) >= Math.abs(dy)) {
            fromNodeHandle = dx > 0 ? "right" : "left";
          } else {
            fromNodeHandle = dy > 0 ? "bottom" : "top";
          }
        } else {
          fromNodeHandle = "right";
        }
        newNodeHandle = oppositeHandle[fromNodeHandle] ?? "left";
      }

      // Edge always goes fromNode → newNode (all handles are type="source",
      // ConnectionMode.Loose allows any handle to act as either endpoint).
      const edgeId = `edge-${connectionState.fromNode.id}-${fromNodeHandle}-${newNodeId}-${newNodeHandle}-${Date.now()}`;
      const newEdge: Edge = {
        id: edgeId,
        source: connectionState.fromNode.id,
        target: newNodeId,
        sourceHandle: fromNodeHandle,
        targetHandle: newNodeHandle,
        type: "labeledConnector",
        data: { connectorType: pendingEdgeType },
      };

      // Add both node and edge in a single batched update.
      fromCanvasRef.current += 1;
      setNodes((nds) => {
        const updated = [...nds, { ...newNode, selected: false }];
        queueMicrotask(() => setStoreNodes(updated));
        return updated;
      });
      setEdges((eds) => {
        const updated = [...eds, newEdge];
        queueMicrotask(() => setStoreEdges(updated));
        return updated;
      });
    },
    [setNodes, setEdges, setStoreNodes, setStoreEdges, pushUndo, pendingEdgeType]
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
        const pendingCustomIcon = useCanvasStore.getState().pendingCustomIcon;
        const iconLabel = pendingIconLabel ?? undefined;
        if (pendingCustomIcon) {
          pushUndo();
          const id = `icon-${Date.now()}`;
          const size = 64;
          const newNode: Node = {
            id,
            type: "icon",
            position: { x: flowX - size / 2, y: flowY - size / 2 },
            data: { customIcon: pendingCustomIcon, ...(iconLabel && { label: iconLabel }) },
            width: size,
            height: size,
          };
          addNode(newNode);
          setNodes((nds) => [...nds, { ...newNode, selected: true }]);
          setActiveTool("select");
          useCanvasStore.getState().setPendingCustomIcon(null);
          setPendingIconLabel(null);
        } else if (pendingIconId) {
          pushUndo();
          const id = `icon-${Date.now()}`;
          const size = 64;
          const newNode: Node = {
            id,
            type: "icon",
            position: { x: flowX - size / 2, y: flowY - size / 2 },
            data: { iconId: pendingIconId, ...(iconLabel && { label: iconLabel }) },
            width: size,
            height: size,
          };
          addNode(newNode);
          setNodes((nds) => [...nds, { ...newNode, selected: true }]);
          setActiveTool("select");
          setPendingIconId(null);
          setPendingIconLabel(null);
        } else if (pendingEmoji) {
          pushUndo();
          const id = `emoji-${Date.now()}`;
          const size = 64;
          const newNode: Node = {
            id,
            type: "icon",
            position: { x: flowX - size / 2, y: flowY - size / 2 },
            data: { emoji: pendingEmoji, ...(iconLabel && { label: iconLabel }) },
            width: size,
            height: size,
          };
          addNode(newNode);
          setNodes((nds) => [...nds, { ...newNode, selected: true }]);
          setActiveTool("select");
          setPendingEmoji(null);
          setPendingIconLabel(null);
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
        const dropIconLabel = useCanvasStore.getState().pendingIconLabel ?? payload.data.label ?? undefined;
        newNode = {
          id,
          type: "icon",
          position: { x: flowX - size / 2, y: flowY - size / 2 },
          data: {
            ...(payload.data.customIcon
              ? { customIcon: payload.data.customIcon }
              : payload.data.iconId
                ? { iconId: payload.data.iconId }
                : { emoji: payload.data.emoji ?? "" }),
            ...(dropIconLabel && { label: dropIconLabel }),
          },
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

  // NOTE: Default mind map template is now only added when a *brand-new* project
  // is created (see project-storage.ts). We no longer reactively inject a template
  // whenever the store is empty — that caused AI-generated diagrams to be
  // overwritten after navigation.

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

  const { layoutAll, layoutSelection } = useAutoLayout({
    nodes,
    edges,
    setNodes: useCallback(
      (updater) => {
        setNodes((prev) => {
          const next = typeof updater === "function" ? updater(prev) : updater;
          fromCanvasRef.current++;
          queueMicrotask(() => setStoreNodes(next));
          return next;
        });
      },
      [setNodes, setStoreNodes]
    ),
    setEdges: useCallback(
      (updater) => {
        setEdges((prev) => {
          const next = typeof updater === "function" ? updater(prev) : updater;
          fromCanvasRef.current++;
          queueMicrotask(() => setStoreEdges(next));
          return next;
        });
      },
      [setEdges, setStoreEdges]
    ),
    fitView: useCallback(
      () => reactFlowRef.current?.fitView({ padding: 0.2, duration: 300 }),
      []
    ),
  });

  const handleLayoutSelectedNodes = useCallback(async () => {
    pushUndo();
    await layoutSelection();
  }, [layoutSelection, pushUndo]);

  const handleLayoutAllNodes = useCallback(async () => {
    pushUndo();
    await layoutAll();
  }, [layoutAll, pushUndo]);

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
              : (activeTool === "emoji" && (pendingIconId || pendingEmoji || useCanvasStore.getState().pendingCustomIcon)) ||
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
        setNodes={(nodesOrUpdater) => {
          setNodes((prev) => {
            const next = typeof nodesOrUpdater === "function" ? nodesOrUpdater(prev) : nodesOrUpdater;
            fromCanvasRef.current++;
            queueMicrotask(() => setStoreNodes(next));
            return next;
          });
        }}
        setEdges={(edgesOrUpdater) => {
          setEdges((prev) => {
            const next = typeof edgesOrUpdater === "function" ? edgesOrUpdater(prev) : edgesOrUpdater;
            fromCanvasRef.current++;
            queueMicrotask(() => setStoreEdges(next));
            return next;
          });
        }}
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
        <CustomMarkerDefs />
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
          nodesDraggable={!presentationMode && activeTool !== "freeDraw" && activeTool !== "connector"}
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
          connectOnClick
          connectionMode={ConnectionMode.Loose}
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
          : canvasBackgroundVariant === "none"
            ? null
            : <Background
                variant={
                  canvasBackgroundVariant === "lines"
                    ? BackgroundVariant.Lines
                    : canvasBackgroundVariant === "cross"
                      ? BackgroundVariant.Cross
                      : BackgroundVariant.Dots
                }
                gap={16}
                size={1}
              />
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
