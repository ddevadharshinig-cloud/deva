import { useEffect, useMemo, useRef, useState } from 'react';
import { formatRelativeTime } from '../constants/personas';
import type { StaffMember, Ticket, TicketPriority, TicketStatus } from '../types/bizassist';

interface AdminDashboardProps {
  tickets: Ticket[];
  staff: StaffMember[];
  onAssignTicket: (ticketId: string, assigneeId: string) => Promise<void>;
  onUpdateStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  onAutoAssign: () => Promise<void>;
  onRebalance: () => Promise<void>;
  onCreateTicket: (payload: {
    subject: string;
    description: string;
    referenceId?: string;
    customerName: string;
    customerEmail: string;
    company: string;
  }) => Promise<void>;
  onOpenInWorkspace: (ticketId: string) => void;
  onNotify: (message: string, isError?: boolean) => void;
}

export function AdminDashboard({
  tickets,
  staff,
  onAssignTicket,
  onUpdateStatus,
  onAutoAssign,
  onRebalance,
  onCreateTicket,
  onOpenInWorkspace,
  onNotify,
}: AdminDashboardProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(8);
  const [page, setPage] = useState(1);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  // New Ticket Modal state
  const [newSubject, setNewSubject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRef, setNewRef] = useState('');
  const [newCustName, setNewCustName] = useState('Marcus Vance');
  const [newCustEmail, setNewCustEmail] = useState('marcus.v@acme-saas.com');
  const [newCompany, setNewCompany] = useState('Acme Corporation');
  const [submittingNew, setSubmittingNew] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const priorityRank: Record<TicketPriority, number> = {
      Critical: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };
    return tickets
      .filter((t) => {
        if (q) {
          const hay = `${t.ticketNumber} ${t.customerName} ${t.company} ${t.subject} ${t.description} ${t.referenceId ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        if (statusFilter === 'active') {
          if (t.status === 'Resolved' || t.status === 'Closed') return false;
        } else if (statusFilter !== 'all' && t.status !== statusFilter) {
          return false;
        }
        if (assigneeFilter === 'unassigned') {
          if (t.assigneeId !== null) return false;
        } else if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  }, [tickets, search, categoryFilter, priorityFilter, statusFilter, assigneeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedTickets = filteredTickets.slice((safePage - 1) * pageSize, safePage * pageSize);

  const unassignedUrgentCount = tickets.filter(
    (t) =>
      !t.assigneeId &&
      (t.priority === 'Critical' || t.priority === 'High') &&
      t.status !== 'Resolved' &&
      t.status !== 'Closed'
  ).length;

  const pendingHumanTriage = tickets.filter(
    (t) => t.status === 'Open' || t.status === 'In Progress' || t.status === 'Awaiting Reply'
  ).length;

  const avgConfidence = useMemo(() => {
    if (tickets.length === 0) return '96.4';
    const sum = tickets.reduce((acc, t) => acc + t.aiConfidence, 0);
    return (sum / tickets.length).toFixed(1);
  }, [tickets]);

  const categoryDistribution = useMemo(() => {
    const total = Math.max(1, tickets.length);
    const billing = tickets.filter((t) => t.category === 'Billing & Payments').length;
    const bugs = tickets.filter((t) => t.category === 'Technical Bug').length;
    const auth = tickets.filter((t) => t.category === 'Account Access').length;
    const other = Math.max(0, tickets.length - billing - bugs - auth);
    return {
      billingPct: Math.round((billing / total) * 100),
      bugsPct: Math.round((bugs / total) * 100),
      authPct: Math.round((auth / total) * 100),
      otherPct: Math.max(0, 100 - Math.round((billing / total) * 100) - Math.round((bugs / total) * 100) - Math.round((auth / total) * 100)),
      otherCount: other,
    };
  }, [tickets]);

  const allDisplayedSelected =
    paginatedTickets.length > 0 && paginatedTickets.every((t) => selectedIds.includes(t.id));

  function toggleSelectAll() {
    if (allDisplayedSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedTickets.map((t) => t.id));
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleAutoAssignClick() {
    setIsAutoAssigning(true);
    try {
      await onAutoAssign();
    } finally {
      setIsAutoAssigning(false);
    }
  }

  async function handleRebalanceClick() {
    setIsRebalancing(true);
    try {
      await onRebalance();
    } finally {
      setIsRebalancing(false);
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newDesc.trim()) return;
    setSubmittingNew(true);
    try {
      await onCreateTicket({
        subject: newSubject,
        description: newDesc,
        referenceId: newRef || undefined,
        customerName: newCustName,
        customerEmail: newCustEmail,
        company: newCompany,
      });
      setShowNewModal(false);
      setNewSubject('');
      setNewDesc('');
      setNewRef('');
    } finally {
      setSubmittingNew(false);
    }
  }

  async function handleBatchResolve() {
    for (const id of selectedIds) {
      await onUpdateStatus(id, 'Resolved');
    }
    onNotify(`Marked ${selectedIds.length} selected ticket(s) as Resolved.`);
    setSelectedIds([]);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col w-full">
      {/* Top Section: Command Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-semibold tracking-wide">
              AI TRIAGE OPS
            </span>
            <span className="text-outline-variant text-[12px]">•</span>
            <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
              Auto-Clustering Active
            </span>
          </div>
          <h1 className="text-[24px] text-on-surface font-semibold tracking-tight mt-1">
            Enterprise Operations Console
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/api/tickets/export.csv"
            download="bizassist-tickets.csv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high text-[12px] font-medium transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export CSV</span>
          </a>
          <button
            type="button"
            disabled={isAutoAssigning}
            onClick={handleAutoAssignClick}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-primary hover:bg-primary-fixed text-[12px] font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-60 ${
              isAutoAssigning ? 'animate-pulse' : ''
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span>{isAutoAssigning ? 'Dispatching...' : 'Auto-Assign with AI'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-[12px] font-semibold transition-all shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {/* 1. KPI Summary Bar */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">Total Inflow</span>
            <span className="material-symbols-outlined text-[18px] text-tertiary">inbox</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[30px] font-bold text-on-surface tabular-nums">{tickets.length}</span>
            <span className="inline-flex items-center text-[11px] font-semibold text-tertiary bg-surface-container-low px-1.5 py-0.5 rounded">
              +12% wk
            </span>
          </div>
          <div className="mt-1.5 text-[12px] text-on-surface-variant tabular-nums">
            {pendingHumanTriage} pending active triage
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-error font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-error" />
              Unassigned Urgent
            </span>
            <span className="material-symbols-outlined text-[18px] text-error">priority_high</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[30px] font-bold text-error tabular-nums">
              {unassignedUrgentCount}
            </span>
            <span className="inline-flex items-center text-[11px] font-semibold text-error bg-error-container/60 px-1.5 py-0.5 rounded">
              SLA &lt; 15m
            </span>
          </div>
          <div className="mt-1.5 text-[12px] text-on-surface-variant">
            {unassignedUrgentCount > 0 ? 'Requires immediate dispatch' : 'All urgent tickets assigned'}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
              Avg Resolution
            </span>
            <span className="material-symbols-outlined text-[18px] text-primary">timer</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[30px] font-bold text-on-surface tabular-nums">2h 14m</span>
            <span className="inline-flex items-center text-[11px] font-semibold text-tertiary bg-surface-container-low px-1.5 py-0.5 rounded">
              -18m imp.
            </span>
          </div>
          <div className="mt-1.5 text-[12px] text-on-surface-variant">Baseline SLA target: 3h 00m</div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
              AI Precision
            </span>
            <span className="material-symbols-outlined text-[18px] text-secondary">psychology</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[30px] font-bold text-on-surface tabular-nums">{avgConfidence}%</span>
            <span className="inline-flex items-center text-[11px] font-semibold text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
              Gemini 4
            </span>
          </div>
          <div className="mt-1.5 text-[12px] text-on-surface-variant">Categorization &amp; sentiment</div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">CSAT Score</span>
            <span className="material-symbols-outlined text-[18px] text-tertiary">star</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-[30px] font-bold text-on-surface tabular-nums">
              4.8 <span className="text-[13px] font-normal text-outline">/ 5.0</span>
            </span>
            <span className="inline-flex items-center text-[11px] font-semibold text-tertiary bg-surface-container-low px-1.5 py-0.5 rounded">
              98.2% pos
            </span>
          </div>
          <div className="mt-1.5 text-[12px] text-on-surface-variant">Based on 312 responses</div>
        </div>
      </section>

      {/* Main Multi-Pane Workplace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Master Ticket Queue */}
        <div className="xl:col-span-9 flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <span className="material-symbols-outlined text-[18px] text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  search
                </span>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by customer, ticket ID, order reference, or keywords..."
                  className="w-full h-8 pl-9 pr-10 bg-surface-container-low rounded-lg text-[13px] text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="font-mono text-[11px] text-outline absolute right-2.5 top-1/2 -translate-y-1/2 bg-surface-container-lowest px-1 py-0.5 rounded shadow-xs">
                  ⌘F
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by Category"
                  className="h-8 px-2.5 bg-surface-container-low rounded-lg text-[12px] font-medium text-on-surface hover:bg-surface-container focus:outline-none cursor-pointer"
                >
                  <option value="all">Category: All</option>
                  <option value="Billing & Payments">Billing &amp; Payments</option>
                  <option value="Technical Bug">Technical Bug</option>
                  <option value="Account Access">Account Access</option>
                  <option value="Shipping & Delivery">Shipping &amp; Delivery</option>
                  <option value="General Inquiry">General Inquiry</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by Priority"
                  className="h-8 px-2.5 bg-surface-container-low rounded-lg text-[12px] font-medium text-on-surface hover:bg-surface-container focus:outline-none cursor-pointer"
                >
                  <option value="all">Priority: All</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by Status"
                  className="h-8 px-2.5 bg-surface-container-low rounded-lg text-[12px] font-medium text-on-surface hover:bg-surface-container focus:outline-none cursor-pointer"
                >
                  <option value="active">Status: Active (Open + In Prog)</option>
                  <option value="all">Status: All</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Awaiting Reply">Awaiting Reply</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>

                <select
                  value={assigneeFilter}
                  onChange={(e) => {
                    setAssigneeFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by Assignee"
                  className="h-8 px-2.5 bg-surface-container-low rounded-lg text-[12px] font-medium text-on-surface hover:bg-surface-container focus:outline-none cursor-pointer"
                >
                  <option value="all">Assignee: Anyone</option>
                  <option value="unassigned">Unassigned Only</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('all');
                    setPriorityFilter('all');
                    setStatusFilter('all');
                    setAssigneeFilter('all');
                    setPage(1);
                  }}
                  title="Reset Filters"
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between pt-1 px-1 text-on-surface-variant text-[11px] gap-2">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allDisplayedSelected}
                    onChange={toggleSelectAll}
                    className="rounded accent-primary cursor-pointer"
                  />
                  <span>Select All ({paginatedTickets.length} displayed)</span>
                </label>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBatchResolve}
                    className="px-2.5 py-0.5 rounded bg-primary text-on-primary font-semibold cursor-pointer"
                  >
                    Mark {selectedIds.length} Resolved
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-tertiary">tune</span>
                <span>
                  Sort by: <strong className="text-on-surface font-medium">Urgency (AI Rank)</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Master Ticket Table */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/70 text-on-surface-variant text-[11px] font-semibold uppercase tracking-wider h-9">
                    <th className="py-2 pl-4 pr-2 w-8 text-center">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="py-2 px-3 min-w-[260px]">Ticket &amp; Issue Summary</th>
                    <th className="py-2 px-3 min-w-[140px]">AI Category</th>
                    <th className="py-2 px-3 min-w-[100px]">AI Priority</th>
                    <th className="py-2 px-3 min-w-[140px]">Assignee</th>
                    <th className="py-2 px-3 min-w-[110px]">Status</th>
                    <th className="py-2 px-3 text-right min-w-[80px]">Created</th>
                    <th className="py-2 pr-4 pl-3 text-right min-w-[140px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low text-[13px]">
                  {paginatedTickets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-on-surface-variant">
                        <p className="text-[14px] font-medium text-on-surface">
                          No tickets match the current filters.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setCategoryFilter('all');
                            setPriorityFilter('all');
                            setStatusFilter('all');
                            setAssigneeFilter('all');
                          }}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-medium cursor-pointer"
                        >
                          Show All Tickets
                        </button>
                      </td>
                    </tr>
                  ) : (
                    paginatedTickets.map((t) => {
                      const assigned = t.assigneeId ? staffMap.get(t.assigneeId) : null;
                      const isCritical = t.priority === 'Critical';
                      const isHigh = t.priority === 'High';
                      const isDone = t.status === 'Resolved' || t.status === 'Closed';

                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-surface-container-low/50 transition-colors ${
                            !assigned && isCritical ? 'bg-error-container/10' : ''
                          } ${isDone ? 'opacity-85' : ''}`}
                        >
                          <td className="py-2.5 pl-4 pr-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(t.id)}
                              onChange={() => toggleRow(t.id)}
                              aria-label={`Select ${t.ticketNumber}`}
                              className="rounded accent-primary cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => onOpenInWorkspace(t.id)}
                              className="flex flex-col text-left cursor-pointer group"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[12px] font-semibold text-primary group-hover:underline">
                                  {t.ticketNumber}
                                </span>
                                <span className="text-[13px] font-semibold text-on-surface">
                                  {t.customerName}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-surface-container text-tertiary text-[10px] font-medium">
                                  {t.company}
                                </span>
                              </div>
                              <span className="text-on-surface-variant text-[12px] truncate max-w-sm mt-0.5">
                                {t.subject}
                              </span>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] font-medium text-on-surface-variant whitespace-nowrap">
                            {t.category}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                isCritical
                                  ? 'bg-error-container text-error'
                                  : isHigh
                                    ? 'bg-surface-container-high text-primary'
                                    : 'bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {assigned ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-primary-fixed text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {assigned.initials}
                                </div>
                                <span className="text-on-surface font-medium text-[12px] whitespace-nowrap">
                                  {assigned.name}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-error text-[11px] font-medium bg-error-container/40 px-2 py-0.5 rounded">
                                <span className="material-symbols-outlined text-[13px]">person_off</span>
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${
                                t.status === 'In Progress'
                                  ? 'bg-surface-container text-tertiary'
                                  : t.status === 'Open'
                                    ? 'bg-surface-container-high text-on-surface'
                                    : 'bg-surface-container-low text-outline'
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-on-surface-variant font-mono text-[11px] whitespace-nowrap tabular-nums">
                            {formatRelativeTime(t.createdAt)}
                          </td>
                          <td className="py-2.5 pr-4 pl-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <select
                                aria-label={`Assign ${t.ticketNumber}`}
                                value={t.assigneeId ?? ''}
                                onChange={(e) => {
                                  if (e.target.value) onAssignTicket(t.id, e.target.value);
                                }}
                                className="h-7 px-1.5 bg-surface-container-low rounded text-[11px] text-on-surface hover:bg-surface-container focus:outline-none cursor-pointer"
                              >
                                <option value="">{assigned ? 'Reassign' : 'Assign...'}</option>
                                {staff.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => onOpenInWorkspace(t.id)}
                                className="h-7 px-2.5 bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface rounded text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                Open
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 bg-surface-container-low/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant text-[11px]">
              <div className="flex items-center gap-2 tabular-nums">
                <span>
                  Showing{' '}
                  <strong className="text-on-surface">
                    {filteredTickets.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
                    {Math.min(safePage * pageSize, filteredTickets.length)}
                  </strong>{' '}
                  of <strong className="text-on-surface">{filteredTickets.length}</strong> tickets
                </span>
                <span className="text-outline-variant">•</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label="Rows per page"
                  className="bg-transparent text-on-surface font-medium cursor-pointer focus:outline-none"
                >
                  <option value={8}>8 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
              <div className="flex items-center gap-1 tabular-nums">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded bg-surface-container-low text-on-surface disabled:text-outline disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                      p === safePage
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded bg-surface-container-low text-on-surface disabled:text-outline disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Staff Workload & AI Dispatcher */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">groups</span>
                <h2 className="text-[16px] text-on-surface font-semibold">Staff Capacity</h2>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-tertiary">
                {staff.filter((s) => s.online).length} Online
              </span>
            </div>
            <p className="text-[12px] text-on-surface-variant">
              Real-time triage concurrency and algorithmic efficiency index.
            </p>

            {staff.map((member) => {
              const activeCount = tickets.filter(
                (t) =>
                  t.assigneeId === member.id && t.status !== 'Resolved' && t.status !== 'Closed'
              ).length;
              const pct = Math.min(100, Math.round((activeCount / member.activeCapacity) * 100));
              return (
                <div
                  key={member.id}
                  className="p-3 rounded-lg bg-surface-container-low/60 hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-fixed text-primary font-bold text-[11px] flex items-center justify-center">
                        {member.initials}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-on-surface leading-tight">
                          {member.name}
                        </div>
                        <div className="text-[11px] text-outline">{member.roleTitle}</div>
                      </div>
                    </div>
                    <span className="font-mono text-[12px] font-semibold text-primary tabular-nums">
                      {activeCount} active
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-high rounded-full h-1.5 mb-2 overflow-hidden">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant tabular-nums">
                    <span>Resolution Rate</span>
                    <span className="font-semibold text-on-surface">{member.resolutionRate}%</span>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              disabled={isRebalancing}
              onClick={handleRebalanceClick}
              className="w-full py-2 px-3 rounded-lg bg-surface-container-high text-primary hover:bg-primary-fixed text-[12px] font-semibold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">sync_alt</span>
              <span>{isRebalancing ? 'Rebalancing...' : 'Smart Rebalance Queue'}</span>
            </button>
          </div>

          {/* Autonomous Routing Breakdown */}
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
                Autonomous Routing
              </span>
              <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span>
            </div>

            <div className="flex flex-col gap-2 pt-1 tabular-nums">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-secondary" /> Billing
                </span>
                <span className="font-mono text-on-surface font-medium">
                  {categoryDistribution.billingPct}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-tertiary" /> Bugs &amp; Infra
                </span>
                <span className="font-mono text-on-surface font-medium">
                  {categoryDistribution.bugsPct}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Auth / SSO
                </span>
                <span className="font-mono text-on-surface font-medium">
                  {categoryDistribution.authPct}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-on-surface-variant flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-outline" /> Other / General
                </span>
                <span className="font-mono text-on-surface font-medium">
                  {categoryDistribution.otherPct}%
                </span>
              </div>

              <div className="w-full h-2 rounded-full flex overflow-hidden bg-surface-container-high mt-1">
                <div className="bg-secondary" style={{ width: `${categoryDistribution.billingPct}%` }} />
                <div className="bg-tertiary" style={{ width: `${categoryDistribution.bugsPct}%` }} />
                <div className="bg-primary" style={{ width: `${categoryDistribution.authPct}%` }} />
                <div className="bg-outline" style={{ width: `${categoryDistribution.otherPct}%` }} />
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-surface-container-low flex items-center justify-between text-[11px] text-outline">
              <span>Classification Model</span>
              <span className="font-mono text-on-surface font-medium">gemini-4-hydrogen</span>
            </div>
          </div>
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl max-w-lg w-full p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-on-surface">
                Create &amp; Auto-Classify Ticket
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="p-1 rounded hover:bg-surface-container-low cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant">Customer Name</label>
                  <input
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container-low text-[13px] text-on-surface focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant">Company</label>
                  <input
                    required
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container-low text-[13px] text-on-surface focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant">Customer Email</label>
                  <input
                    required
                    type="email"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container-low text-[13px] text-on-surface focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant">Reference ID</label>
                  <input
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    placeholder="e.g. ORD-9921"
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container-low text-[13px] text-on-surface focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant">Subject Line</label>
                <input
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Describe the issue headline..."
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container-low text-[13px] text-on-surface focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-on-surface-variant">Issue Description</label>
                <textarea
                  required
                  rows={4}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Provide full details so Gemini AI can classify urgency, intent, and executive summary..."
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-surface-container-low text-[13px] text-on-surface focus:outline-none resize-y"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-container-low text-on-surface text-[12px] font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary text-[12px] font-semibold cursor-pointer disabled:opacity-60"
                >
                  {submittingNew ? 'Classifying with AI...' : 'Create & Classify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
