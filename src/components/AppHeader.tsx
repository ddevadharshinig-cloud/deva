import { useState } from 'react';
import { BIZASSIST_LOGO_URL, ROLE_PERSONAS, formatRelativeTime } from '../constants/personas';
import type { AuditLog, BackendStatus, Ticket, UserRole, ViewPath } from '../types/bizassist';
import { Avatar } from './Avatar';

interface AppHeaderProps {
  activeView: ViewPath;
  currentRole: UserRole;
  onNavigate: (view: ViewPath) => void;
  onRoleChange: (role: UserRole) => void;
  onOpenCommandSearch: () => void;
  onOpenDbModal: () => void;
  tickets: Ticket[];
  auditLogs: AuditLog[];
  backendStatus: BackendStatus;
}

const NAV_ITEMS: { label: string; path: ViewPath }[] = [
  { label: 'Admin Dashboard', path: 'admin-dashboard' },
  { label: 'Support Staff Workspace', path: 'support-staff-workspace' },
  { label: 'Customer Portal', path: 'customer-portal' },
  { label: 'Knowledge Base & FAQs', path: 'knowledge-base-and-faqs' },
];

const VIEW_TITLES: Record<ViewPath, string> = {
  auth: 'Authentication & Access',
  'admin-dashboard': 'Admin Operations Console',
  'support-staff-workspace': 'Support Staff Workspace',
  'customer-portal': 'Enterprise Customer Portal',
  'knowledge-base-and-faqs': 'Knowledge Base & Self-Service',
};

export function AppHeader({
  activeView,
  currentRole,
  onNavigate,
  onRoleChange,
  onOpenCommandSearch,
  onOpenDbModal,
  tickets,
  auditLogs,
  backendStatus,
}: AppHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const persona = ROLE_PERSONAS[currentRole];
  const urgentTickets = tickets.filter(
    (t) => (t.priority === 'Critical' || !t.assigneeId) && t.status !== 'Resolved' && t.status !== 'Closed'
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-16 w-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate(persona.defaultView)}
            className="flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg px-1 py-0.5"
          >
            {!logoFailed ? (
              <img
                src={BIZASSIST_LOGO_URL}
                alt="BizAssist AI Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="h-8 w-8 object-contain rounded"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
                BA
              </div>
            )}
            <span className="text-[16px] text-on-surface tracking-tight font-semibold whitespace-nowrap">
              BizAssist AI
            </span>
          </button>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-low text-tertiary text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
            Production
          </span>
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.path;
            return (
              <button
                key={item.path}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(item.path)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-surface-container-high text-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative flex items-center bg-surface-container-low rounded-lg px-2.5 py-1.5 text-on-surface-variant gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
            <select
              aria-label="Switch Role Persona"
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              className="bg-transparent text-[12px] font-medium text-on-surface cursor-pointer focus:outline-none pr-1"
            >
              <option value="admin">Arun (Administrator)</option>
              <option value="support">Rahul (Support Staff)</option>
              <option value="customer">Priya (Customer)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onOpenCommandSearch}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors text-[11px] font-semibold cursor-pointer"
            title="Quick Search (⌘K)"
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            <span className="font-mono text-[11px] bg-surface-container-lowest px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              ⌘K
            </span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifications((v) => !v);
                setShowProfileMenu(false);
              }}
              aria-label="Notifications"
              className="relative p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {urgentTickets.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest rounded-xl shadow-xl ring-1 ring-surface-variant/60 p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
                  <span className="text-[13px] font-semibold text-on-surface">
                    Operational Alerts ({urgentTickets.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-surface-container-low mt-1">
                  {urgentTickets.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setShowNotifications(false);
                        onNavigate('support-staff-workspace');
                      }}
                      className="w-full text-left py-2 px-1.5 hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-semibold text-primary">{t.ticketNumber}</span>
                        <span className="text-error font-semibold">{t.priority}</span>
                      </div>
                      <p className="text-[12px] text-on-surface font-medium line-clamp-1 mt-0.5">
                        {t.subject}
                      </p>
                      <span className="text-[11px] text-on-surface-variant">
                        {t.assigneeId ? `SLA ${t.slaMinutesRemaining}m` : 'Unassigned'} · {formatRelativeTime(t.createdAt)}
                      </span>
                    </button>
                  ))}
                  {auditLogs.slice(0, 2).map((log) => (
                    <div key={log.id} className="py-2 px-1.5 text-[11px] text-on-surface-variant">
                      <span className="font-semibold text-on-surface">{log.actor}:</span> {log.details}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative pl-1">
            <button
              type="button"
              onClick={() => {
                setShowProfileMenu((v) => !v);
                setShowNotifications(false);
              }}
              aria-label="Account menu"
              className="flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              <Avatar
                src={persona.avatarUrl}
                alt={persona.fullName}
                initials={persona.name.slice(0, 2).toUpperCase()}
                className="w-8 h-8"
              />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest rounded-xl shadow-xl ring-1 ring-surface-variant/60 p-3 z-50">
                <div className="pb-2 border-b border-surface-container-low">
                  <p className="text-[13px] font-semibold text-on-surface">{persona.fullName}</p>
                  <p className="text-[11px] text-on-surface-variant">{persona.email}</p>
                  <p className="text-[11px] text-primary font-medium mt-0.5">{persona.title}</p>
                </div>
                <div className="pt-2 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenDbModal();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-container-low text-[12px] text-on-surface flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-tertiary">database</span>
                    <span>Supabase Integration Status</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigate('auth');
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-error-container/40 text-[12px] text-error flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Access &amp; Role Switcher Screen</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Strip */}
      <div className="lg:hidden border-t border-surface-container-low px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-surface-container-high text-primary font-semibold'
                  : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Sub-header Breadcrumb & Sync Status */}
      <div className="h-9 bg-surface-container-low/50 backdrop-blur-md border-t border-surface-container/60">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-[11px] font-medium text-on-surface-variant">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[14px] text-tertiary">layers</span>
            <span className="truncate">Enterprise Support Operations</span>
            <span className="text-outline-variant">/</span>
            <span className="text-on-surface font-semibold truncate">{VIEW_TITLES[activeView]}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Cluster: us-east-prod</span>
            </div>
            <button
              type="button"
              onClick={onOpenDbModal}
              className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
              title="View Supabase PostgreSQL & Backend Connection Details"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  backendStatus.database === 'supabase' ? 'bg-emerald-600' : 'bg-tertiary'
                }`}
              />
              <span>
                DB:{' '}
                <strong className="text-on-surface">
                  {backendStatus.database === 'supabase' ? 'Supabase Connected' : 'Local Sync (Supabase Ready)'}
                </strong>
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
