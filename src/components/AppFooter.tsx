import type { BackendStatus } from '../types/bizassist';

interface AppFooterProps {
  backendStatus: BackendStatus;
  onOpenDbModal: () => void;
}

export function AppFooter({ backendStatus, onOpenDbModal }: AppFooterProps) {
  return (
    <footer className="w-full bg-surface-container-lowest py-4 shadow-[0_-1px_8px_rgba(0,0,0,0.03)] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-on-surface-variant text-[11px] font-medium">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-tertiary" />
          <span className="font-semibold text-on-surface">
            AI Classification Engine: {backendStatus.geminiConfigured ? 'Gemini Connected' : 'Setup Required'}
          </span>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <button
            type="button"
            onClick={onOpenDbModal}
            className="hover:text-primary transition-colors cursor-pointer"
          >
            Backend:{' '}
            {backendStatus.database === 'supabase'
              ? 'Supabase PostgreSQL Active'
              : 'Local Persistence (Configure Supabase in Secrets)'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-on-surface-variant">BizAssist AI</span>
        </div>
      </div>
    </footer>
  );
}
