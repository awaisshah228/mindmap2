"use client";

import { useState } from "react";
import { X, Settings, Wand2, Palette, Plus, Trash2, Cpu, Eye, EyeOff, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCanvasStore,
  type AIPromptTemplate,
  type LLMProvider,
  LLM_MODELS,
} from "@/lib/store/canvas-store";
import { ThemeSwitcher } from "./ThemeProvider";

type SettingsTab = "general" | "integration" | "ai-prompts";

export function SettingsPanel() {
  const settingsOpen = useCanvasStore((s) => s.settingsOpen);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[640px] max-w-[90vw] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-violet-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-44 border-r border-gray-200 dark:border-gray-700 py-3 px-2 shrink-0">
            {(
              [
                { id: "general" as const, label: "General", icon: Palette },
                { id: "integration" as const, label: "Integration", icon: Cpu },
                { id: "ai-prompts" as const, label: "AI Prompts", icon: Wand2 },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg",
                  tab.id !== "general" && "mt-1",
                  activeTab === tab.id
                    ? "bg-violet-50 text-violet-700 font-medium dark:bg-violet-900/30 dark:text-violet-400"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {activeTab === "general" && <GeneralSettings />}
            {activeTab === "integration" && <IntegrationSettings />}
            {activeTab === "ai-prompts" && <AIPromptsSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── General ──────────────────────────────────────────────────────── */

function GeneralSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Theme
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Choose the appearance of the editor.
        </p>
        <ThemeSwitcher />
      </div>
    </div>
  );
}

/* ─── Integration (LLM provider / model / API key) ─────────────────── */

const PROVIDER_OPTIONS: { value: LLMProvider; label: string; description: string }[] = [
  { value: "openai", label: "OpenAI", description: "GPT-4o, GPT-4.1, O3" },
  { value: "anthropic", label: "Anthropic", description: "Claude Sonnet 4, Claude 3.5" },
  { value: "google", label: "Google", description: "Gemini 2.0 Flash, 2.5 Pro" },
  { value: "openrouter", label: "OpenRouter", description: "Access multiple providers via OpenRouter" },
  { value: "custom", label: "Custom", description: "Use any OpenAI-compatible API" },
];

function IntegrationSettings() {
  const llmProvider = useCanvasStore((s) => s.llmProvider);
  const setLLMProvider = useCanvasStore((s) => s.setLLMProvider);
  const llmModel = useCanvasStore((s) => s.llmModel);
  const setLLMModel = useCanvasStore((s) => s.setLLMModel);
  const llmApiKey = useCanvasStore((s) => s.llmApiKey);
  const setLLMApiKey = useCanvasStore((s) => s.setLLMApiKey);
  const llmBaseUrl = useCanvasStore((s) => s.llmBaseUrl);
  const setLLMBaseUrl = useCanvasStore((s) => s.setLLMBaseUrl);
  const [showKey, setShowKey] = useState(false);
  const [customModel, setCustomModel] = useState("");

  const modelsForProvider = LLM_MODELS.filter((m) => m.provider === llmProvider);

  const handleProviderChange = (provider: LLMProvider) => {
    setLLMProvider(provider);
    // Auto-select first model for the provider
    const firstModel = LLM_MODELS.find((m) => m.provider === provider);
    if (firstModel) {
      setLLMModel(firstModel.id);
    } else if (provider === "openrouter" || provider === "custom") {
      setLLMModel(llmModel); // keep current
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider selection */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          AI Provider
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Select the AI service to use for diagram generation.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {PROVIDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleProviderChange(opt.value)}
              className={cn(
                "flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                llmProvider === opt.value
                  ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-500"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center",
                  llmProvider === opt.value
                    ? "border-violet-500"
                    : "border-gray-300 dark:border-gray-600"
                )}
              >
                {llmProvider === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                )}
              </div>
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {opt.label}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {opt.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Model selection */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Model
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Choose which model to use for generating diagrams.
        </p>
        {modelsForProvider.length > 0 ? (
          <select
            value={llmModel}
            onChange={(e) => setLLMModel(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          >
            {modelsForProvider.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        ) : (
          <div>
            <input
              type="text"
              value={llmProvider === "custom" || llmProvider === "openrouter" ? llmModel : customModel}
              onChange={(e) => {
                setLLMModel(e.target.value);
                setCustomModel(e.target.value);
              }}
              placeholder={
                llmProvider === "openrouter"
                  ? "e.g. openai/gpt-4o-mini, anthropic/claude-sonnet-4-20250514"
                  : "e.g. gpt-4o-mini"
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Enter the model identifier supported by your provider.
            </p>
          </div>
        )}
      </div>

      {/* API Key */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5" />
          API Key
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Your API key is stored only in your browser and never sent to our servers.
          If left empty, the server&apos;s default key will be used.
        </p>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={llmApiKey}
            onChange={(e) => setLLMApiKey(e.target.value)}
            placeholder={`Enter your ${PROVIDER_OPTIONS.find((p) => p.value === llmProvider)?.label ?? ""} API key (optional)`}
            className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
            title={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {llmApiKey && (
          <p className="text-[11px] text-green-600 dark:text-green-400 mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Custom API key configured &mdash; AI calls will be made directly from your browser
          </p>
        )}
      </div>

      {/* Custom Base URL (shown for "custom" provider) */}
      {llmProvider === "custom" && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Base URL
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            The base URL of your OpenAI-compatible API endpoint.
          </p>
          <input
            type="text"
            value={llmBaseUrl}
            onChange={(e) => setLLMBaseUrl(e.target.value)}
            placeholder="https://your-endpoint.example.com/v1"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            The <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/chat/completions</code> path will be appended automatically.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── AI Prompts ───────────────────────────────────────────────────── */

function AIPromptsSettings() {
  const aiPrompts = useCanvasStore((s) => s.aiPrompts);
  const setAIPrompts = useCanvasStore((s) => s.setAIPrompts);

  const handleUpdatePrompt = (id: string, field: "label" | "prompt", value: string) => {
    setAIPrompts(
      aiPrompts.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleRemovePrompt = (id: string) => {
    setAIPrompts(aiPrompts.filter((p) => p.id !== id));
  };

  const handleAddPrompt = () => {
    const newPrompt: AIPromptTemplate = {
      id: `custom-${Date.now()}`,
      label: "New Prompt",
      prompt: 'Describe what AI should do for node: "{label}"',
    };
    setAIPrompts([...aiPrompts, newPrompt]);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          AI Prompt Templates
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Configure the AI prompts available in the node context menu. Use{" "}
          <code className="text-violet-600 bg-violet-50 dark:bg-violet-900/30 px-1 rounded">{"{label}"}</code>{" "}
          as a placeholder for the node label.
        </p>
      </div>

      <div className="space-y-3">
        {aiPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={prompt.label}
                onChange={(e) =>
                  handleUpdatePrompt(prompt.id, "label", e.target.value)
                }
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                placeholder="Prompt name"
              />
              <button
                type="button"
                onClick={() => handleRemovePrompt(prompt.id)}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              value={prompt.prompt}
              onChange={(e) =>
                handleUpdatePrompt(prompt.id, "prompt", e.target.value)
              }
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
              rows={2}
              placeholder='AI prompt template (use {label} for node label)'
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddPrompt}
        className="flex items-center gap-2 px-3 py-2 text-sm text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add custom prompt
      </button>
    </div>
  );
}
