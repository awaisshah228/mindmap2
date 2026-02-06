"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3,
  Users,
  FileText,
  LayoutTemplate,
  Plus,
  Pencil,
  Trash2,
  X,
  Cpu,
} from "lucide-react";

type Stats = {
  totalDocuments: number;
  totalUsers: number;
  totalCreditsAccounts: number;
  totalCreditTransactions: number;
  totalPresets: number;
};

type UserRow = { userId: string; docCount: number; balance: number };

type PresetRow = {
  id: string;
  name: string;
  label: string;
  description?: string;
  diagramType: string;
  level: string;
  isTemplate: boolean;
  sortOrder: number;
  hasNodes: boolean;
};

type AIModelRow = {
  id: string;
  provider: string;
  model: string;
  label: string;
  baseUrl?: string | null;
  isDefault: boolean;
  sortOrder: number;
};

type EnvModelsData = {
  envProviders: { provider: string; configured: boolean; label: string }[];
  defaultModelInUse: { source: string; label: string; provider: string; model: string } | null;
};

const LEVELS = [
  "high-level-flow",
  "high-level-system-design",
  "high-level-diagram",
  "flows",
  "sequence",
  "architecture",
  "entity-relationship",
  "bpmn",
  "mindmap",
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [aiModels, setAiModels] = useState<AIModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [envModels, setEnvModels] = useState<EnvModelsData | null>(null);
  const [aiModelForm, setAiModelForm] = useState<{
    open: boolean;
    id: string | null;
    provider: string;
    model: string;
    label: string;
    baseUrl: string;
    isDefault: boolean;
    sortOrder: number;
  }>({
    open: false,
    id: null,
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    baseUrl: "",
    isDefault: true,
    sortOrder: 0,
  });

  const [presetForm, setPresetForm] = useState<{
    open: boolean;
    id: string | null;
    name: string;
    label: string;
    description: string;
    diagramType: string;
    level: string;
    prompt: string;
    isTemplate: boolean;
    sortOrder: number;
    previewImageUrl: string;
    nodesJson: string;
    edgesJson: string;
  }>({
    open: false,
    id: null,
    name: "",
    label: "",
    description: "",
    diagramType: "flow",
    level: "high-level-flow",
    prompt: "",
    isTemplate: false,
    sortOrder: 0,
    previewImageUrl: "",
    nodesJson: "[]",
    edgesJson: "[]",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, presetsRes, aiModelsRes, envModelsRes] = await Promise.all([
        fetch("/api/admin/stats", { credentials: "include" }),
        fetch("/api/admin/users", { credentials: "include" }),
        fetch("/api/admin/presets", { credentials: "include" }),
        fetch("/api/admin/ai-models", { credentials: "include" }),
        fetch("/api/admin/env-models", { credentials: "include" }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users ?? []);
      }
      if (presetsRes.ok) {
        const data = await presetsRes.json();
        setPresets(data.presets ?? []);
      }
      if (aiModelsRes.ok) {
        const data = await aiModelsRes.json();
        setAiModels(data.models ?? []);
      }
      if (envModelsRes.ok) {
        const data = await envModelsRes.json();
        setEnvModels(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNewPreset = () => {
    setPresetForm({
      open: true,
      id: null,
      name: "",
      label: "",
      description: "",
      diagramType: "flow",
      level: "high-level-flow",
      prompt: "",
      isTemplate: false,
      sortOrder: 0,
      previewImageUrl: "",
      nodesJson: "[]",
      edgesJson: "[]",
    });
  };

  const openEditPreset = async (id: string) => {
    const res = await fetch(`/api/presets/${id}`, { credentials: "include" });
    if (!res.ok) return;
    const p = await res.json();
    setPresetForm({
      open: true,
      id,
      name: p.name ?? "",
      label: p.label ?? "",
      description: p.description ?? "",
      diagramType: p.diagramType ?? "flow",
      level: p.level ?? "high-level-flow",
      prompt: p.prompt ?? "",
      isTemplate: p.isTemplate ?? false,
      sortOrder: p.sortOrder ?? 0,
      previewImageUrl: p.previewImageUrl ?? "",
      nodesJson: JSON.stringify(Array.isArray(p.nodes) ? p.nodes : [], null, 2),
      edgesJson: JSON.stringify(Array.isArray(p.edges) ? p.edges : [], null, 2),
    });
  };

  const closeForm = () => setPresetForm((f) => ({ ...f, open: false }));

  const savePreset = async () => {
    let nodes: object[] = [];
    let edges: object[] = [];
    try {
      nodes = JSON.parse(presetForm.nodesJson);
    } catch {
      return alert("Invalid nodes JSON");
    }
    try {
      edges = JSON.parse(presetForm.edgesJson);
    } catch {
      return alert("Invalid edges JSON");
    }
    const body = {
      name: presetForm.name.trim() || presetForm.label.trim(),
      label: presetForm.label.trim() || presetForm.name.trim(),
      description: presetForm.description || undefined,
      diagramType: presetForm.diagramType,
      level: presetForm.level,
      nodes,
      edges,
      prompt: presetForm.prompt || undefined,
      isTemplate: presetForm.isTemplate,
      sortOrder: presetForm.sortOrder,
      previewImageUrl: presetForm.previewImageUrl || undefined,
    };
    const url = presetForm.id
      ? `/api/admin/presets/${presetForm.id}`
      : "/api/admin/presets";
    const method = presetForm.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return alert((e as { error?: string }).error || "Failed to save");
    }
    closeForm();
    load();
  };

  const deletePreset = async (id: string) => {
    if (!confirm("Delete this preset?")) return;
    const res = await fetch(`/api/admin/presets/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) load();
    else alert("Failed to delete");
  };

  if (loading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>

      {/* Stats */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Stats
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <StatCard label="Documents" value={stats?.totalDocuments ?? 0} icon={<FileText className="w-5 h-5" />} />
          <StatCard label="Users" value={stats?.totalUsers ?? 0} icon={<Users className="w-5 h-5" />} />
          <StatCard label="Credits accounts" value={stats?.totalCreditsAccounts ?? 0} />
          <StatCard label="Credit transactions" value={stats?.totalCreditTransactions ?? 0} />
          <StatCard label="Presets" value={stats?.totalPresets ?? 0} icon={<LayoutTemplate className="w-5 h-5" />} />
        </div>
      </section>

      {/* Users */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Users
        </h2>
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-gray-400">
              <tr>
                <th className="px-4 py-2">User ID</th>
                <th className="px-4 py-2">Documents</th>
                <th className="px-4 py-2">Credits balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-4 text-gray-500">No users</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.userId} className="hover:bg-gray-900/50">
                    <td className="px-4 py-2 font-mono text-xs truncate max-w-[200px]" title={u.userId}>{u.userId}</td>
                    <td className="px-4 py-2">{u.docCount}</td>
                    <td className="px-4 py-2">{u.balance}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* AI Models (for paid users without API key) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            AI Models (paid users)
          </h2>
          <button
            type="button"
            onClick={() => setAiModelForm({ open: true, id: null, provider: "openrouter", model: "openai/gpt-4o-mini", label: "GPT-4o Mini", baseUrl: "", isDefault: aiModels.length === 0, sortOrder: aiModels.length })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm"
          >
            <Plus className="w-4 h-4" /> Add model
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Models available when users have no API key (use credits). Configure API keys in env (OPENAI_API_KEY, OPENROUTER_API_KEY, etc).
        </p>
        {envModels && (
          <div className="rounded-lg border border-gray-800 p-3 mb-3 bg-gray-900/50">
            <p className="text-xs font-medium text-gray-400 mb-2">Env status (which providers have keys)</p>
            <div className="flex flex-wrap gap-3 mb-2">
              {envModels.envProviders?.map((p) => (
                <span key={p.provider} className={`text-xs ${p.configured ? "text-green-500" : "text-gray-500"}`}>
                  {p.label}: {p.configured ? "✓" : "—"}
                </span>
              ))}
            </div>
            {envModels.defaultModelInUse && (
              <p className="text-xs text-amber-400">
                Default model in use when no admin models: <strong>{envModels.defaultModelInUse.label}</strong> (via {envModels.defaultModelInUse.source})
              </p>
            )}
          </div>
        )}
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-gray-400">
              <tr>
                <th className="px-4 py-2">Label</th>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2">Base URL</th>
                <th className="px-4 py-2">Default</th>
                <th className="px-4 py-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {aiModels.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-4 text-gray-500">No AI models. Add one or use env fallback.</td></tr>
              ) : (
                aiModels.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-2">{m.label}</td>
                    <td className="px-4 py-2 text-gray-500">{m.provider}</td>
                    <td className="px-4 py-2 font-mono text-xs">{m.model}</td>
                    <td className="px-4 py-2 font-mono text-[10px] max-w-[120px] truncate" title={m.baseUrl ?? undefined}>{m.baseUrl || "—"}</td>
                    <td className="px-4 py-2">{m.isDefault ? "Yes" : "No"}</td>
                    <td className="px-4 py-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setAiModelForm({ open: true, id: m.id, provider: m.provider, model: m.model, label: m.label, baseUrl: m.baseUrl ?? "", isDefault: m.isDefault, sortOrder: m.sortOrder })}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Delete this model?")) return;
                          const res = await fetch(`/api/admin/ai-models/${m.id}`, { method: "DELETE", credentials: "include" });
                          if (res.ok) load();
                          else alert("Failed to delete");
                        }}
                        className="p-1.5 rounded hover:bg-red-900/30 text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Presets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4" />
            Presets &amp; Templates
          </h2>
          <button
            type="button"
            onClick={openNewPreset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm"
          >
            <Plus className="w-4 h-4" /> Add preset
          </button>
        </div>
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-gray-400">
              <tr>
                <th className="px-4 py-2">Label</th>
                <th className="px-4 py-2">Level</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Template</th>
                <th className="px-4 py-2 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {presets.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-4 text-gray-500">No presets. Add one or run seed script.</td></tr>
              ) : (
                presets.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-2">{p.label}</td>
                    <td className="px-4 py-2 text-gray-500">{p.level}</td>
                    <td className="px-4 py-2 text-gray-500">{p.diagramType}</td>
                    <td className="px-4 py-2">{p.isTemplate ? "Yes" : "No"}</td>
                    <td className="px-4 py-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEditPreset(p.id)}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePreset(p.id)}
                        className="p-1.5 rounded hover:bg-red-900/30 text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* AI Model form modal */}
      {aiModelForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="font-semibold">{aiModelForm.id ? "Edit AI model" : "New AI model"}</h3>
              <button type="button" onClick={() => setAiModelForm((f) => ({ ...f, open: false }))} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Provider</label>
                <select
                  value={aiModelForm.provider}
                  onChange={(e) => setAiModelForm((f) => ({ ...f, provider: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                >
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="custom">Custom (self-hosted)</option>
                </select>
              </div>
              <LabelInput label="Model ID (e.g. gpt-4o-mini or openai/gpt-4o-mini)" value={aiModelForm.model} onChange={(v) => setAiModelForm((f) => ({ ...f, model: v }))} />
              <LabelInput label="Label (display name)" value={aiModelForm.label} onChange={(v) => setAiModelForm((f) => ({ ...f, label: v }))} />
              <LabelInput label="Base URL (optional, for custom/self-hosted; leave empty to use env default)" value={aiModelForm.baseUrl} onChange={(v) => setAiModelForm((f) => ({ ...f, baseUrl: v }))} />
              <LabelInput label="Sort order" type="number" value={String(aiModelForm.sortOrder)} onChange={(v) => setAiModelForm((f) => ({ ...f, sortOrder: parseInt(v, 10) || 0 }))} />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="aiModelDefault"
                  checked={aiModelForm.isDefault}
                  onChange={(e) => setAiModelForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="rounded border-gray-600 bg-gray-800"
                />
                <label htmlFor="aiModelDefault" className="text-sm">Default model for paid users</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-800">
              <button type="button" onClick={() => setAiModelForm((f) => ({ ...f, open: false }))} className="px-3 py-1.5 rounded-lg border border-gray-600 hover:bg-gray-800 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!aiModelForm.model.trim()) return alert("Model ID is required");
                  const body = { provider: aiModelForm.provider, model: aiModelForm.model.trim(), label: aiModelForm.label.trim() || aiModelForm.model, baseUrl: aiModelForm.baseUrl.trim() || null, isDefault: aiModelForm.isDefault, sortOrder: aiModelForm.sortOrder };
                  const url = aiModelForm.id ? `/api/admin/ai-models/${aiModelForm.id}` : "/api/admin/ai-models";
                  const method = aiModelForm.id ? "PATCH" : "POST";
                  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
                  if (!res.ok) {
                    const e = await res.json().catch(() => ({}));
                    return alert((e as { error?: string }).error || "Failed to save");
                  }
                  setAiModelForm((f) => ({ ...f, open: false }));
                  load();
                }}
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset form modal */}
      {presetForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="font-semibold">{presetForm.id ? "Edit preset" : "New preset"}</h3>
              <button type="button" onClick={closeForm} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <LabelInput label="Name" value={presetForm.name} onChange={(v) => setPresetForm((f) => ({ ...f, name: v }))} />
                <LabelInput label="Label" value={presetForm.label} onChange={(v) => setPresetForm((f) => ({ ...f, label: v }))} />
              </div>
              <LabelInput label="Description" value={presetForm.description} onChange={(v) => setPresetForm((f) => ({ ...f, description: v }))} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Diagram type</label>
                  <select
                    value={presetForm.diagramType}
                    onChange={(e) => setPresetForm((f) => ({ ...f, diagramType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                  >
                    <option value="flow">flow</option>
                    <option value="sequence">sequence</option>
                    <option value="architecture">architecture</option>
                    <option value="entity-relationship">entity-relationship</option>
                    <option value="bpmn">bpmn</option>
                    <option value="mindmap">mindmap</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Level</label>
                  <select
                    value={presetForm.level}
                    onChange={(e) => setPresetForm((f) => ({ ...f, level: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <LabelInput label="Prompt (for AI)" value={presetForm.prompt} onChange={(v) => setPresetForm((f) => ({ ...f, prompt: v }))} textarea />
              <div className="grid grid-cols-2 gap-3">
                <LabelInput label="Sort order" type="number" value={String(presetForm.sortOrder)} onChange={(v) => setPresetForm((f) => ({ ...f, sortOrder: parseInt(v, 10) || 0 }))} />
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isTemplate"
                    checked={presetForm.isTemplate}
                    onChange={(e) => setPresetForm((f) => ({ ...f, isTemplate: e.target.checked }))}
                    className="rounded border-gray-600 bg-gray-800"
                  />
                  <label htmlFor="isTemplate" className="text-sm">Show as template in sidebar</label>
                </div>
              </div>
              <LabelInput label="Preview image URL" value={presetForm.previewImageUrl} onChange={(v) => setPresetForm((f) => ({ ...f, previewImageUrl: v }))} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nodes (JSON). Use data.icon or data.iconUrl for icons.</label>
                <textarea
                  value={presetForm.nodesJson}
                  onChange={(e) => setPresetForm((f) => ({ ...f, nodesJson: e.target.value }))}
                  className="w-full h-32 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 font-mono text-xs"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Edges (JSON)</label>
                <textarea
                  value={presetForm.edgesJson}
                  onChange={(e) => setPresetForm((f) => ({ ...f, edgesJson: e.target.value }))}
                  className="w-full h-24 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 font-mono text-xs"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-800">
              <button type="button" onClick={closeForm} className="px-3 py-1.5 rounded-lg border border-gray-600 hover:bg-gray-800 text-sm">
                Cancel
              </button>
              <button type="button" onClick={savePreset} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center gap-3">
      {icon && <span className="text-violet-500">{icon}</span>}
      <div>
        <p className="text-2xl font-semibold text-gray-100">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function LabelInput({
  label,
  value,
  onChange,
  type = "text",
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm resize-none h-20"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm"
        />
      )}
    </div>
  );
}
