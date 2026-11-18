import { useEffect, useState } from 'react';
import type { BackendStatus } from '../types/bizassist';

interface BackendStatusModalProps {
  open: boolean;
  onClose: () => void;
  backendStatus: BackendStatus;
  onRefresh: () => Promise<void>;
  onNotify: (message: string, isError?: boolean) => void;
}

export function BackendStatusModal({
  open,
  onClose,
  backendStatus,
  onRefresh,
  onNotify,
}: BackendStatusModalProps) {
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [loadingSchema, setLoadingSchema] = useState(false);

  useEffect(() => {
    if (!open || schemaSql) return;
    setLoadingSchema(true);
    fetch('/api/supabase/schema')
      .then((r) => r.text())
      .then((txt) => setSchemaSql(txt))
      .catch(() => {})
      .finally(() => setLoadingSchema(false));
  }, [open, schemaSql]);

  if (!open) return null;

  async function handleCopySchema() {
    try {
      await navigator.clipboard.writeText(schemaSql);
      onNotify('Copied supabase/schema.sql to clipboard.');
    } catch {
      onNotify('Unable to copy automatically; select and copy from the SQL box.', true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-2xl max-w-2xl w-full p-6 flex flex-col gap-4 max-h-[88vh]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">database</span>
            <h3 className="text-[18px] font-semibold text-on-surface">
              Supabase &amp; Backend Integration Status
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-container-low cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
          <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-1">
            <span className="text-on-surface-variant font-medium">Database Backend Mode</span>
            <span className="text-[15px] font-semibold text-on-surface">
              {backendStatus.database === 'supabase'
                ? 'Supabase PostgreSQL (Connected)'
                : 'Local JSON Persistence (Fallback Active)'}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              {backendStatus.supabaseConfigured
                ? backendStatus.supabaseConnected
                  ? 'All tables verified and synced.'
                  : `Env vars found; run SQL schema in Supabase (${backendStatus.supabaseError || 'tables pending'}).`
                : 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Settings > Secrets to switch to Supabase PostgreSQL.'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-1">
            <span className="text-on-surface-variant font-medium">Server-Side AI Engine</span>
            <span className="text-[15px] font-semibold text-on-surface">
              {backendStatus.geminiConfigured
                ? 'Gemini API Connected (gemini-4-hydrogen)'
                : 'GEMINI_API_KEY Missing in Secrets'}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              Powers ticket classification, executive summaries, smart composer, Staff Copilot, and KB synthesis.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-on-surface">
              Supabase PostgreSQL Schema (supabase/schema.sql)
            </span>
            <button
              type="button"
              onClick={handleCopySchema}
              className="px-2.5 py-1 rounded bg-primary text-on-primary text-[11px] font-semibold cursor-pointer"
            >
              Copy SQL Schema
            </button>
          </div>
          <pre className="bg-inverse-surface text-inverse-on-surface p-3 rounded-lg font-mono text-[11px] max-h-60 overflow-auto leading-relaxed">
            <code>{loadingSchema ? 'Loading schema...' : schemaSql}</code>
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={async () => {
              await onRefresh();
              onNotify('Refreshed backend connection status.');
            }}
            className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-[12px] font-medium text-on-surface cursor-pointer"
          >
            Re-check Connection
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-[12px] font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
