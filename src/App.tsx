import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { AuthScreen } from './components/AuthScreen';
import { BackendStatusModal } from './components/BackendStatusModal';
import { CommandSearchModal } from './components/CommandSearchModal';
import { CustomerPortal } from './components/CustomerPortal';
import { KnowledgeBase } from './components/KnowledgeBase';
import { SupportWorkspace } from './components/SupportWorkspace';
import { ROLE_PERSONAS } from './constants/personas';
import type {
  AuditLog,
  BackendStatus,
  FaqItem,
  KbArticle,
  StaffMember,
  Ticket,
  TicketStatus,
  UserRole,
  ViewPath,
} from './types/bizassist';

export default function App() {
  const [activeView, setActiveView] = useState<ViewPath>('admin-dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [kbArticles, setKbArticles] = useState<KbArticle[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    database: 'local',
    supabaseConfigured: false,
    supabaseConnected: false,
    geminiConfigured: true,
  });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCommandSearch, setShowCommandSearch] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const notify = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 3500);
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('Failed to load workspace data.');
      const data = await res.json();
      setTickets(data.tickets ?? []);
      setStaff(data.staff ?? []);
      setKbArticles(data.kbArticles ?? []);
      setFaqs(data.faqs ?? []);
      setAuditLogs(data.auditLogs ?? []);
      if (data.backendStatus) setBackendStatus(data.backendStatus);
      setSelectedTicketId((prev) => prev ?? data.tickets?.[0]?.id ?? null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to connect to backend.', true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandSearch((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowCommandSearch(false);
        setShowDbModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleRoleChange(role: UserRole, targetView?: ViewPath) {
    setCurrentRole(role);
    const nextView = targetView ?? ROLE_PERSONAS[role].defaultView;
    setActiveView(nextView);
    notify(`Switched active session to ${ROLE_PERSONAS[role].fullName}.`);
  }

  async function handleAssignTicket(ticketId: string, assigneeId: string) {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assigneeId,
        status: 'In Progress',
        trackerStep: 3,
        actor: ROLE_PERSONAS[currentRole].fullName,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Failed to assign ticket.', true);
      return;
    }
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)));
    const agent = staff.find((s) => s.id === assigneeId);
    notify(`Assigned ${data.ticket.ticketNumber} to ${agent?.name ?? assigneeId}.`);
  }

  async function handleUpdateTicket(
    ticketId: string,
    patch: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId' | 'trackerStep'>>
  ) {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...patch,
        actor: ROLE_PERSONAS[currentRole].fullName,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Update failed.', true);
      return;
    }
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)));
  }

  async function handleAutoAssign() {
    const res = await fetch('/api/tickets/auto-assign', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Auto-assign failed.', true);
      return;
    }
    setTickets(data.tickets);
    notify(
      data.assignedCount > 0
        ? `AI Engine dispatched ${data.assignedCount} unassigned ticket(s).`
        : 'All active tickets are already assigned.'
    );
  }

  async function handleRebalance() {
    const res = await fetch('/api/tickets/rebalance', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Rebalance failed.', true);
      return;
    }
    setTickets(data.tickets);
    notify('Staff workload balanced evenly across Rahul, Aisha, and Priya.');
  }

  async function handleCreateTicket(payload: {
    subject: string;
    description: string;
    referenceId?: string;
    customerName: string;
    customerEmail: string;
    company: string;
  }): Promise<Ticket> {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Failed to submit ticket.', true);
      throw new Error(data.error || 'Failed to submit ticket.');
    }
    setTickets((prev) => [data.ticket, ...prev]);
    setSelectedTicketId(data.ticket.id);
    notify(
      `Ticket ${data.ticket.ticketNumber} created · AI classified as ${data.ticket.category} (${data.ticket.priority}).`
    );
    return data.ticket;
  }

  async function handleSendMessage(
    ticketId: string,
    payload: {
      body: string;
      isInternal?: boolean;
      isSystemEvent?: boolean;
      senderRole?: 'customer' | 'support' | 'system';
      senderName?: string;
      newStatus?: TicketStatus;
      newTrackerStep?: number;
    }
  ) {
    const res = await fetch(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Failed to send message.', true);
      return;
    }
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? data.ticket : t)));
  }

  async function handlePingSpecialist(ticketId: string) {
    await handleSendMessage(ticketId, {
      body: 'Customer Marcus Vance sent a priority SLA check-in ping.',
      isSystemEvent: true,
      senderRole: 'system',
      senderName: 'Customer SLA Ping',
    });
    notify('Paged Rahul Sharma with priority SLA check-in.');
  }

  if (activeView === 'auth') {
    return (
      <>
        <AuthScreen onSelectRole={handleRoleChange} />
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl flex items-center gap-2.5 text-[13px] ${
              toast.isError
                ? 'bg-error text-on-error'
                : 'bg-inverse-surface text-inverse-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {toast.isError ? 'error' : 'check_circle'}
            </span>
            <span>{toast.message}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col justify-between">
      <AppHeader
        activeView={activeView}
        currentRole={currentRole}
        onNavigate={setActiveView}
        onRoleChange={(r) => handleRoleChange(r)}
        onOpenCommandSearch={() => setShowCommandSearch(true)}
        onOpenDbModal={() => setShowDbModal(true)}
        tickets={tickets}
        auditLogs={auditLogs}
        backendStatus={backendStatus}
      />

      <main className="w-full pt-28 lg:pt-24 pb-8 flex-1">
        {loading ? (
          <div className="max-w-7xl mx-auto px-6 py-12 space-y-4">
            <div className="h-8 w-64 bg-surface-container rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-surface-container-lowest rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-80 bg-surface-container-lowest rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            {activeView === 'admin-dashboard' && (
              <AdminDashboard
                tickets={tickets}
                staff={staff}
                onAssignTicket={handleAssignTicket}
                onUpdateStatus={(id, status) => handleUpdateTicket(id, { status })}
                onAutoAssign={handleAutoAssign}
                onRebalance={handleRebalance}
                onCreateTicket={async (p) => {
                  await handleCreateTicket(p);
                }}
                onOpenInWorkspace={(ticketId) => {
                  setSelectedTicketId(ticketId);
                  setActiveView('support-staff-workspace');
                }}
                onNotify={notify}
              />
            )}

            {activeView === 'support-staff-workspace' && (
              <SupportWorkspace
                tickets={tickets}
                staff={staff}
                kbArticles={kbArticles}
                selectedTicketId={selectedTicketId}
                onSelectTicket={setSelectedTicketId}
                onSendMessage={handleSendMessage}
                onUpdateTicket={handleUpdateTicket}
                onRefresh={fetchBootstrap}
                onNotify={notify}
              />
            )}

            {activeView === 'customer-portal' && (
              <CustomerPortal
                tickets={tickets}
                kbArticles={kbArticles}
                onCreateTicket={handleCreateTicket}
                onPingSpecialist={handlePingSpecialist}
                onNavigate={setActiveView}
                onNotify={notify}
              />
            )}

            {activeView === 'knowledge-base-and-faqs' && (
              <KnowledgeBase
                articles={kbArticles}
                faqs={faqs}
                onNavigate={setActiveView}
                onNotify={notify}
              />
            )}
          </>
        )}
      </main>

      <AppFooter backendStatus={backendStatus} onOpenDbModal={() => setShowDbModal(true)} />

      <CommandSearchModal
        open={showCommandSearch}
        onClose={() => setShowCommandSearch(false)}
        tickets={tickets}
        articles={kbArticles}
        onSelectTicket={(id) => {
          setSelectedTicketId(id);
          setActiveView('support-staff-workspace');
        }}
        onSelectView={setActiveView}
      />

      <BackendStatusModal
        open={showDbModal}
        onClose={() => setShowDbModal(false)}
        backendStatus={backendStatus}
        onRefresh={fetchBootstrap}
        onNotify={notify}
      />

      {toast && (
        <div
          className={`fixed bottom-14 left-6 z-50 px-4 py-3 rounded-lg shadow-xl flex items-center gap-2.5 text-[13px] ${
            toast.isError
              ? 'bg-error text-on-error'
              : 'bg-inverse-surface text-inverse-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.isError ? 'error' : 'check_circle'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
