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
} from "@/components/nodes";
import { FreeDrawPreview, type Stroke } from "./FreeDrawPreview";
import LabeledConnectorEdge from "@/components/edges/LabeledConnectorEdge";
import { MindMapLayoutPanel } from "@/components/panels/MindMapLayoutPanel";
import { MobileColorIndicator } from "@/components/panels/MobileColorIndicator";
import { MindMapLayoutProvider } from "@/contexts/MindMapLayoutContext";

const nodeTypes = {
  stickyNote: StickyNoteNode,
  mindMap: MindMapNode,
  rectangle: ShapeNode,
  diamond: ShapeNode,
  circle: ShapeNode,
  document: ShapeNode,
  text: TextNode,
  freeDraw: FreeDrawNode,
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

  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

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

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, nodesOnStop: Node[]) => {
      setHelperLines({ horizontal: null, vertical: null });
      setNodes((nds) =>
        resolveCollisions(nds, {
          maxIterations: 100,
          overlapThreshold: 0.5,
          margin: 15,
        })
      );
    },
    [setNodes]
  );

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
        data: { connectorType: "default" },
      };
      setEdges((eds) => [...eds, newEdge]);
      addEdgeToStore(newEdge);
    },
    [setEdges, addEdgeToStore]
  );

  const onLayout = useCallback(
    async (direction: LayoutDirection) => {
      const spacing: [number, number] = [mindMapLayout.spacingX, mindMapLayout.spacingY];
      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
        nodes,
        edges,
        direction,
        spacing,
        mindMapLayout.algorithm
      );
      setEdges(layoutedEdges);
      const collisionFreeNodes = resolveCollisions(layoutedNodes, {
        maxIterations: 150,
        overlapThreshold: 0,
        margin: 24,
      });
      setNodes(collisionFreeNodes);
    },
    [nodes, edges, setNodes, setEdges, mindMapLayout]
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
      const normalizedPoints = pts.map(([x, y, p]) => [x - minX, y - minY, p] as [number, number, number]);
      pushUndo();
      const newNode: Node = {
        id: `fd-${Date.now()}`,
        type: "freeDraw",
        position: { x: minX - padding, y: minY - padding },
        data: { points: normalizedPoints, color: stroke.color, strokeSize: stroke.size },
      };
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      setNodes((nds) => [...nds, { ...newNode, selected: true }]);
      addNode(newNode);
      setActiveTool("select");
    },
    [pushUndo, setNodes, addNode, setActiveTool]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool !== "freeDraw" || !reactFlowRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest(".react-flow__node") || target.closest(".react-flow__controls")) return;
      e.preventDefault();
      const pos = reactFlowRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const pressure = e.pressure || 0.5;
      setCurrentStroke({
        id: `stroke-${Date.now()}`,
        points: [[pos.x, pos.y, pressure]],
        color: "#000000",
        size: 8,
      });
    },
    [activeTool]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool !== "freeDraw" || !currentStroke || !reactFlowRef.current) return;
      e.preventDefault();
      const pos = reactFlowRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const pressure = e.pressure || 0.5;
      setCurrentStroke((s) =>
        s ? { ...s, points: [...s.points, [pos.x, pos.y, pressure]] } : null
      );
    },
    [activeTool, currentStroke]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool !== "freeDraw" || !currentStroke) return;
      e.preventDefault();
      if (currentStroke.points.length > 1) {
        createFreeDrawNode(currentStroke);
      }
      setCurrentStroke(null);
    },
    [activeTool, currentStroke, createFreeDrawNode]
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (activeTool === "select" || activeTool === "pan" || activeTool === "ai" || activeTool === "freeDraw")
        return;

      const target = event.target as HTMLElement;
      if (target.closest(".react-flow__node")) return;

      if (!reactFlowRef.current) return;

      const { x: flowX, y: flowY } = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nodeTypesMap: Record<string, string> = {
        stickyNote: "stickyNote",
        rectangle: "rectangle",
        diamond: "diamond",
        circle: "circle",
        document: "document",
        text: "text",
        mindMap: "mindMap",
        frame: "rectangle",
        list: "text",
      };

      const type = nodeTypesMap[activeTool] ?? "rectangle";
      const id = `node-${Date.now()}`;
      const isShapeType = ["rectangle", "diamond", "circle", "document"].includes(activeTool);
      const shapeFromPending = isShapeType && pendingShape ? pendingShape : null;
      const defaultShape =
        type === "rectangle"
          ? (activeTool === "rectangle" ? "rectangle" : "document")
          : type === "diamond"
            ? "diamond"
            : type === "circle"
              ? "circle"
              : type === "document"
                ? "document"
                : "rectangle";
      const shape = shapeFromPending ?? defaultShape;

      pushUndo();

      const newNode: Node = {
        id,
        type: type as keyof typeof nodeTypes,
        position: { x: flowX - 60, y: flowY - 25 },
        data:
          type === "rectangle" || type === "diamond" || type === "circle" || type === "document"
            ? {
                label:
                  shape === "diamond" ? "Decision" : shape === "circle" ? "Process" : shape === "document" ? "Document" : shape === "table" ? "Table" : "Node",
                shape,
              }
            : { label: type === "mindMap" ? "Mind map" : "New node" },
      };

      addNode(newNode);
      setNodes((nds) => [...nds, { ...newNode, selected: false }]);
      setActiveTool("select");
      setPendingShape(null);
    },
    [activeTool, pendingShape, setPendingShape, addNode, setNodes, setActiveTool, pushUndo]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeTool === "freeDraw") {
        setCurrentStroke(null);
        setActiveTool("select");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, setActiveTool]);

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
    if (activeTool === "freeDraw" && currentStroke && currentStroke.points.length > 1) {
      createFreeDrawNode(currentStroke);
      setCurrentStroke(null);
    }
  }, [activeTool, currentStroke, createFreeDrawNode]);

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

  return (
    <MindMapLayoutProvider
      onAddAndLayout={handleAddMindMapNode}
      onUpdateNodeData={handleUpdateNodeData}
    >
      <div
        className="w-full h-full"
        style={{ cursor: activeTool === "freeDraw" ? "crosshair" : undefined }}
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
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onInit={onInit}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable
        nodesConnectable
        elementsSelectable
        edgesFocusable
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        minZoom={0.1}
        maxZoom={4}
        connectionLineType={ConnectionLineType.Bezier}
        defaultEdgeOptions={{ type: "labeledConnector", data: { connectorType: "default" } }}
        snapGrid={[16, 16]}
        snapToGrid
        connectionRadius={40}
        proOptions={{ hideAttribution: true }}
      >
        <HelperLines horizontal={helperLines.horizontal} vertical={helperLines.vertical} />
        <FreeDrawPreview currentStroke={currentStroke} />
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
