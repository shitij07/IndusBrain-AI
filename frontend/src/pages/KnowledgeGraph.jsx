import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion } from 'framer-motion'
import {
  Factory,
  FileText,
  Users,
  AlertTriangle,
  Building2,
  CalendarClock,
  X,
  RefreshCw,
  Loader2,
  Share2,
} from 'lucide-react'
import api from '../api/client'
import dagre from 'dagre'

const NODE_WIDTH = 180
const NODE_HEIGHT = 80

const nodeVisuals = {
  Equipment: { icon: Factory, gradient: 'from-amber-500 to-amber-600', color: '#f59e0b' },
  Report: { icon: FileText, gradient: 'from-amber-400 to-orange-500', color: '#f59e0b' },
  Operator: { icon: Users, gradient: 'from-amber-500 to-amber-700', color: '#d97706' },
  Failure: { icon: AlertTriangle, gradient: 'from-rose-500 to-red-600', color: '#ef4444' },
  Plant: { icon: Building2, gradient: 'from-emerald-500 to-teal-600', color: '#10b981' },
  MaintenanceRecord: { icon: CalendarClock, gradient: 'from-cyan-500 to-teal-600', color: '#06b6d4' },
}

function KnowledgeNode({ data }) {
  const v = nodeVisuals[data.label] || { icon: FileText, gradient: 'from-surface-400 to-surface-500', color: '#94a3b8' }
  const Icon = v.icon

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="!bg-surface-400 !w-2 !h-2" />
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg p-3 min-w-[160px] cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-amber-400/30 dark:hover:border-amber-500/30 shadow-sm"
        style={{ borderLeft: '3px solid #f59e0b' }}
        onClick={() => data.onSelect?.(data)}
      >
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${v.gradient} flex items-center justify-center shadow-sm shrink-0`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="badge-info text-[10px] uppercase tracking-wider leading-none">{data.label}</span>
        </div>
        <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{data.name}</p>
        {data.id && (
          <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-0.5 truncate font-mono">{data.id}</p>
        )}
      </motion.div>
      <Handle type="source" position={Position.Bottom} className="!bg-surface-400 !w-2 !h-2" />
    </div>
  )
}

const nodeTypes = { knowledge: KnowledgeNode }

function layoutGraph(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 })

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    }
  })
}

export default function KnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [error, setError] = useState(null)
  const reactFlowRef = useRef(null)

  const loadGraph = useCallback(async () => {
    setLoadingGraph(true)
    setError(null)
    try {
      const { data } = await api.get('/graph')
      const apiNodes = (data.nodes || []).map((n) => ({
        id: n.id,
        type: 'knowledge',
        data: {
          id: n.id,
          label: n.label || (n.labels && n.labels[0]) || 'Unknown',
          name: n.name,
          onSelect: () => {},
        },
      }))
      const apiEdges = (data.edges || []).map((e) => ({
        id: `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: '#f59e0b', strokeWidth: 1.5 },
        label: e.label,
      }))

      if (apiNodes.length === 0) {
        setNodes([])
        setEdges([])
      } else {
        const laidOut = layoutGraph(apiNodes, apiEdges)
        setNodes(laidOut)
        setEdges(apiEdges)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load graph')
      setNodes([])
      setEdges([])
    } finally {
      setLoadingGraph(false)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const onNodeClick = useCallback(
    (_, node) => setSelectedNode(node.data),
    [],
  )

  const onSelect = useCallback((data) => setSelectedNode(data), [])

  const nodesWithHandler = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, onSelect },
      })),
    [nodes, onSelect],
  )

  const legend = useMemo(
    () =>
      Object.entries(nodeVisuals).map(([key, v]) => ({
        key,
        label: key === 'MaintenanceRecord' ? 'Maintenance' : key,
        icon: v.icon,
      })),
    [],
  )

  return (
    <div className="h-[calc(100vh-10rem)] relative">
      {loadingGraph ? (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-4 text-surface-400 dark:text-surface-500">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-sm font-mono text-[11px] uppercase tracking-wider">Traversing knowledge graph...</p>
            <div className="flex gap-2 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-16 h-10 rounded bg-surface-200 dark:bg-surface-700/50"
                  initial={{ opacity: 0.3 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse', delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full">
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg p-8 text-center max-w-md shadow-sm">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-1">Unable to load graph</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mb-4">{error}</p>
            <button onClick={() => loadGraph()} className="btn-primary text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg p-8 text-center max-w-md shadow-sm">
            <Share2 className="w-10 h-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-1">
              No knowledge graph yet
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500 leading-relaxed">
              Upload asset documents to automatically build a knowledge graph of equipment, reports, and relationships.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative h-full">
          <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-1.5">
            {legend.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.key}
                  className="bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm border border-surface-200 dark:border-surface-700 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono font-medium text-surface-600 dark:text-surface-300 shadow-sm"
                >
                  <Icon className="w-3 h-3 text-amber-500" />
                  {item.label}
                </div>
              )
            })}
            <button
              onClick={() => loadGraph()}
              className="bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm border border-surface-200 dark:border-surface-700 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono font-medium text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:border-amber-400/30 transition-colors shadow-sm"
              title="Refresh graph"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          <ReactFlow
            ref={reactFlowRef}
            nodes={nodesWithHandler}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.3}
            maxZoom={2}
            className="rounded-2xl"
          >
            <Background color="#e2e8f0" gap={20} size={1} />
            <Controls className="!rounded-xl !border-surface-200 !shadow-sm" />
            <MiniMap
              className="!rounded-xl !border-surface-200 !shadow-sm"
              nodeColor={(n) => nodeVisuals[n.data?.label]?.color || '#6366f1'}
              maskColor="rgba(0,0,0,0.08)"
            />
          </ReactFlow>
        </div>
      )}

      {selectedNode && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg max-w-sm w-full mx-4 p-5 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${(nodeVisuals[selectedNode.label] || nodeVisuals.Report).gradient} flex items-center justify-center shrink-0`}
                >
                  {(() => {
                    const Icon = (nodeVisuals[selectedNode.label] || nodeVisuals.Report).icon
                    return Icon ? <Icon className="w-5 h-5 text-white" /> : null
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">{selectedNode.name}</p>
                  <span className="tag text-[10px]">{selectedNode.label}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 rounded-lg text-surface-400 dark:text-surface-500 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm text-surface-500 dark:text-surface-400">
              <div className="flex items-center gap-2">
                <span className="data-label shrink-0">Node ID</span>
                <span className="font-mono text-[11px] text-surface-900 dark:text-surface-100 truncate">{selectedNode.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="data-label shrink-0">Type</span>
                <span className="text-surface-900 dark:text-surface-100">{selectedNode.label}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setSelectedNode(null)}
                className="btn-secondary flex-1 text-xs"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
