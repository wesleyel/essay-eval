import { REASONING_EFFORTS, type AISettingsInput, type AISettingsView, type ReasoningEffort } from '@essay/domain';
import { AlertCircle, CheckCircle2, Cpu, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../hooks/library';
import { errorMessage, LOCAL_MODE } from '../lib/http';
import { cx, Dialog, Segmented, useToast } from './ui';

type Preset = Omit<AISettingsInput, 'apiKey'> & { name: string };

const PRESETS: Preset[] = [
  { name: 'DeepSeek V3 对话', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', reasoningEffort: 'auto' },
  { name: 'DeepSeek R1 深度思考', baseUrl: 'https://api.deepseek.com', model: 'deepseek-reasoner', reasoningEffort: 'high' },
  { name: 'SiliconFlow 硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', reasoningEffort: 'auto' },
  { name: 'OpenAI GPT-4o', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', reasoningEffort: 'auto' },
  { name: 'OpenAI o3-mini', baseUrl: 'https://api.openai.com/v1', model: 'o3-mini', reasoningEffort: 'medium' },
];

const EFFORT_LABELS: Record<ReasoningEffort, string> = { auto: '自动', none: '关闭', low: '浅度', medium: '中度', high: '深度' };

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings } = useSettings();
  return (
    <Dialog title="模型接入配置" subtitle="支持 DeepSeek、OpenAI 及任何兼容 OpenAI 协议的服务" onClose={onClose}>
      {settings.data ? <SettingsForm initial={settings.data} onDone={onClose} /> : <p className="text-xs text-zinc-500">{settings.error ? errorMessage(settings.error) : '正在加载…'}</p>}
    </Dialog>
  );
}

function SettingsForm({ initial, onDone }: { initial: AISettingsView; onDone: () => void }) {
  const notify = useToast();
  const { save, test } = useSettings();
  const [form, setForm] = useState<Omit<AISettingsInput, 'apiKey'>>({ baseUrl: initial.baseUrl, model: initial.model, reasoningEffort: initial.reasoningEffort });
  /** 留空表示沿用已保存的密钥 */
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const input: AISettingsInput = { ...form, ...(apiKey && { apiKey }) };

  const edit = (patch: Partial<typeof form>) => {
    setForm((previous) => ({ ...previous, ...patch }));
    test.reset();
  };

  async function submit() {
    try {
      await save.mutateAsync(input);
      notify('设置已保存');
      onDone();
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  return (
    <div className="space-y-5 text-xs">
      <div>
        <p className="mb-2 font-semibold text-zinc-700">常用服务预设</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(({ name, ...preset }) => (
            <button key={name} type="button" onClick={() => edit(preset)} className="flex flex-col items-start rounded-lg border border-zinc-200 p-2.5 text-left hover:border-accent hover:bg-accent-wash">
              <span className="flex items-center gap-1 font-semibold text-zinc-800">
                <Sparkles className="size-3 text-accent" />
                {name}
              </span>
              <span className="mt-0.5 w-full truncate text-[11px] text-zinc-400">{preset.model}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block font-semibold text-zinc-700">API Base URL</span>
        <input value={form.baseUrl} onChange={(event) => edit({ baseUrl: event.target.value })} className="field font-mono" placeholder="https://api.deepseek.com" />
        <span className="mt-1 block text-[11px] text-zinc-400">自动补全 /v1/chat/completions</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block font-semibold text-zinc-700">模型</span>
        <input value={form.model} onChange={(event) => edit({ model: event.target.value })} className="field font-mono" placeholder="deepseek-chat" />
      </label>

      <div>
        <span className="mb-1.5 block font-semibold text-zinc-700">思考强度 (reasoning_effort)</span>
        <Segmented label="思考强度" value={form.reasoningEffort} onChange={(reasoningEffort) => edit({ reasoningEffort })} options={REASONING_EFFORTS.map((value) => ({ value, label: EFFORT_LABELS[value] }))} />
        <span className="mt-1.5 block text-[11px] text-zinc-400">仅推理模型支持；普通对话模型请保持「自动」。</span>
      </div>

      <label className="block">
        <span className="mb-1.5 block font-semibold text-zinc-700">API Key</span>
        <span className="relative block">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value);
              test.reset();
            }}
            className="field pr-10 font-mono"
            placeholder={initial.apiKeySet ? '已保存，留空则不修改' : 'sk-...'}
            autoComplete="off"
          />
          <button type="button" className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400" aria-label={showKey ? '隐藏密钥' : '显示密钥'} onClick={() => setShowKey(!showKey)}>
            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
        <span className="mt-1 block text-[11px] text-zinc-400">{LOCAL_MODE ? '密钥与全部数据仅保存在本机浏览器（IndexedDB），请求由浏览器直连模型服务。' : '密钥保存在服务端数据库，不会再返回给浏览器。'}</span>
      </label>

      <div>
        <button type="button" className="btn" disabled={test.isPending} onClick={() => test.mutate(input)}>
          {test.isPending ? <Loader2 className="animate-spin" /> : <Cpu />}
          测试连通性
        </button>
        {(test.data || test.error) && (
          <p className={cx('notice mt-2 border', test.data?.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800')}>
            {test.data?.ok ? <CheckCircle2 /> : <AlertCircle />}
            <span className="break-all">{test.data?.message ?? errorMessage(test.error)}</span>
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          取消
        </button>
        <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={() => void submit()}>
          保存配置
        </button>
      </div>
    </div>
  );
}
