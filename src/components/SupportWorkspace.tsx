import { useEffect, useMemo, useRef, useState } from 'react';
import { AVATAR_RAHUL_HEADER, formatRelativeTime } from '../constants/personas';
import type { KbArticle, StaffMember, Ticket, TicketStatus } from '../types/bizassist';
import { Avatar } from './Avatar';

interface SupportWorkspaceProps {
  tickets: Ticket[];
  staff: StaffMember[];
  kbArticles: KbArticle[];
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  onSendMessage: (
    ticketId: string,
    payload: {
      body: string;
      isInternal?: boolean;
      isSystemEvent?: boolean;
      senderRole?: 'support' | 'system';
      senderName?: string;
      newStatus?: TicketStatus;
      newTrackerStep?: number;
    }
  ) => Promise<void>;
  onUpdateTicket: (
    ticketId: string,
    patch: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId' | 'trackerStep'>>
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
  onNotify: (message: string, isError?: boolean) => void;
}

type QueueTab = 'all' | 'urgent' | 'pending' | 'resolved';

export function SupportWorkspace({
  tickets,
  staff,
  kbArticles,
  selectedTicketId,
  onSelectTicket,
  onSendMessage,
  onUpdateTicket,
  onRefresh,
  onNotify,
}: SupportWorkspaceProps) {
  const [queueTab, setQueueTab] = useState<QueueTab>('all');
  const [queuePaused, setQueuePaused] = useState(false);
  const [draftText, setDraftText] = useState(
    'Hi Marcus,\n\nI understand the urgency given your executive demo today. I have manually unlocked your 12 team seats and re-triggered the Stripe webhook listener. Your workspace is now fully active, and the $1,200 renewal receipt has been generated. Please let me know if you need anything else.'
  );
  const [internalMode, setInternalMode] = useState(false);
  const [ccRep, setCcRep] = useState(true);
  const [tone, setTone] = useState('Executive & Empathetic');
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Staff Copilot Widget State
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotInsight, setCopilotInsight] = useState({
    insight:
      'Identified retry failure in Stripe webhook payload for #TK-8942. Gateway timed out at 09:14 UTC with code STRIPE_ERR_504.',
    recommendation:
      'Dispatch event ID #wh_993182 or grant temporary grace period.',
  });

  const composerRef = useRef<HTMLTextAreaElement>(null);

  const rahul = staff.find((s) => s.id === 'rahul') ?? staff[0];

  const queueTickets = useMemo(() => {
    const active = tickets.filter((t) => t.status !== 'Closed');
    switch (queueTab) {
      case 'urgent':
        return active.filter((t) => t.priority === 'Critical' || t.priority === 'High');
      case 'pending':
        return active.filter((t) => t.status === 'Awaiting Reply' || t.status === 'Open');
      case 'resolved':
        return tickets.filter((t) => t.status === 'Resolved' || t.status === 'Closed');
      default:
        return active;
    }
  }, [tickets, queueTab]);

  const activeTicket = useMemo(() => {
    return (
      tickets.find((t) => t.id === selectedTicketId) ??
      queueTickets[0] ??
      tickets[0] ??
      null
    );
  }, [tickets, queueTickets, selectedTicketId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Tab' &&
        document.activeElement &&
        document.activeElement.tagName !== 'TEXTAREA' &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'SELECT'
      ) {
        if (composerRef.current) {
          e.preventDefault();
          composerRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  async function handleGenerateDraft(actionType: 'draft' | 'kb_snippet' | 'diagnostics', nextTone?: string) {
    if (!activeTicket) return;
    setDraftLoading(true);
    try {
      const res = await fetch('/api/ai/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          tone: nextTone ?? tone,
          actionType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate AI draft.');
      setDraftText(data.draft);
      onNotify(
        actionType === 'draft'
          ? 'AI Copilot drafted a contextual response.'
          : actionType === 'kb_snippet'
            ? 'Inserted verified Knowledge Base snippet.'
            : 'Drafted diagnostics request.'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'AI draft failed.', true);
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleSendReply(targetStatus: TicketStatus) {
    if (!activeTicket || !draftText.trim()) return;
    setSending(true);
    try {
      const prefix = internalMode ? '[Internal Note] ' : '';
      const suffix = ccRep && !internalMode ? '\n\n(CC: Account Rep Lisa T.)' : '';
      await onSendMessage(activeTicket.id, {
        body: `${prefix}${draftText.trim()}${suffix}`,
        isInternal: internalMode,
        senderRole: 'support',
        senderName: rahul?.name || 'Rahul Sharma',
        newStatus: targetStatus,
        newTrackerStep: targetStatus === 'Resolved' ? 5 : 4,
      });
      setDraftText('');
      onNotify(
        targetStatus === 'Resolved'
          ? `Sent response & marked ${activeTicket.ticketNumber} Resolved.`
          : `Reply sent to ${activeTicket.customerName}.`
      );
    } finally {
      setSending(false);
    }
  }

  async function handleEscalate() {
    if (!activeTicket) return;
    await onUpdateTicket(activeTicket.id, { priority: 'Critical', status: 'In Progress' });
    await onSendMessage(activeTicket.id, {
      body: `Escalated ${activeTicket.ticketNumber} to Tier 3 Platform Engineering with full payload diagnostics.`,
      isSystemEvent: true,
      senderRole: 'system',
      senderName: 'AI Escalation Router',
    });
    onNotify(`Escalated ${activeTicket.ticketNumber} to Engineering.`);
  }

  async function handleInstantRemediation(label: string, detail: string) {
    if (!activeTicket) return;
    await onSendMessage(activeTicket.id, {
      body: `${label}: ${detail}`,
      isSystemEvent: true,
      senderRole: 'system',
      senderName: 'Automated Remediation',
    });
    onNotify(`Executed: ${label}`);
  }

  async function handleCopilotPrompt(promptText: string) {
    if (!promptText.trim()) return;
    setCopilotLoading(true);
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicket?.id,
          prompt: promptText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Copilot request failed.');
      setCopilotInsight({ insight: data.insight, recommendation: data.recommendation });
      setCopilotInput('');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Copilot error.', true);
    } finally {
      setCopilotLoading(false);
    }
  }

  const countAll = tickets.filter((t) => t.status !== 'Closed').length;
  const countUrgent = tickets.filter(
    (t) => t.status !== 'Closed' && (t.priority === 'Critical' || t.priority === 'High')
  ).length;
  const countPending = tickets.filter(
    (t) => t.status === 'Open' || t.status === 'Awaiting Reply'
  ).length;
  const countResolved = tickets.filter(
    (t) => t.status === 'Resolved' || t.status === 'Closed'
  ).length;

  const pastTickets = useMemo(() => {
    if (!activeTicket) return [];
    return tickets.filter(
      (t) =>
        t.id !== activeTicket.id &&
        (t.company === activeTicket.company || t.status === 'Resolved' || t.status === 'Closed')
    ).slice(0, 3);
  }, [tickets, activeTicket]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col w-full gap-4">
      {/* Command Strip */}
      <div className="w-full bg-surface-container-low rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${queuePaused ? 'bg-outline' : 'bg-primary'}`} />
            <span className="text-[15px] font-semibold text-on-surface">
              Queue Dispatch: {rahul?.name || 'Rahul Sharma'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary text-[11px] font-semibold">
            {rahul?.roleTitle || 'Tier 2 Technical & Billing'}
          </span>
          <span className="hidden md:inline font-mono text-[11px] text-on-surface-variant">
            Cluster: us-east-prod · {queuePaused ? 'Inbound Paused' : 'Live Dispatch'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container text-on-surface text-[12px] font-medium tabular-nums">
            <span className="material-symbols-outlined text-[16px] text-tertiary">timer</span>
            <span>Active SLA Budget:</span>
            <span className="font-semibold text-error">
              {activeTicket ? `${activeTicket.slaMinutesRemaining}m Remaining` : 'Nominal'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setQueuePaused((p) => !p);
                onNotify(queuePaused ? 'Resumed inbound queue dispatch.' : 'Paused inbound queue dispatch.');
              }}
              title={queuePaused ? 'Resume Inbound Queue' : 'Pause Inbound Queue'}
              className="p-1.5 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {queuePaused ? 'play_circle' : 'pause_circle'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onRefresh();
                onNotify('Refreshed live support queue.');
              }}
              title="Refresh Live Feeds"
              className="p-1.5 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">sync</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tri-Column Workspace Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* PANE 1: LEFT - Assigned Ticket Queue */}
        <section className="lg:col-span-3 flex flex-col gap-3">
          <div className="bg-surface-container-lowest rounded-xl p-2.5 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between px-1.5 py-0.5">
              <span className="text-[12px] font-semibold text-on-surface">Assigned Queue</span>
              <span className="font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded tabular-nums">
                {countAll} active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setQueueTab('all')}
                className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                  queueTab === 'all'
                    ? 'bg-surface-container text-primary font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span>All Active</span>
                <span className="tabular-nums font-mono">{countAll}</span>
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('urgent')}
                className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                  queueTab === 'urgent'
                    ? 'bg-error-container text-error font-semibold'
                    : 'bg-surface-container-low text-error hover:bg-surface-container'
                }`}
              >
                <span>Crit / High</span>
                <span className="tabular-nums font-mono">{countUrgent}</span>
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('pending')}
                className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                  queueTab === 'pending'
                    ? 'bg-surface-container text-primary font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span>Pending Reply</span>
                <span className="tabular-nums font-mono">{countPending}</span>
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('resolved')}
                className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer ${
                  queueTab === 'resolved'
                    ? 'bg-surface-container text-tertiary font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span>Resolved</span>
                <span className="tabular-nums font-mono">{countResolved}</span>
              </button>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-2 shadow-sm flex flex-col gap-1.5 max-h-[680px] overflow-y-auto">
            {queueTickets.map((t) => {
              const isSelected = activeTicket?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTicket(t.id)}
                  className={`p-3 rounded-lg text-left transition-colors cursor-pointer flex flex-col gap-1.5 relative ${
                    isSelected
                      ? 'bg-surface-container-high shadow-xs'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r" />
                  )}
                  <div className="flex items-center justify-between gap-1 pl-1">
                    <span className="font-mono text-[11px] font-semibold text-primary">
                      {t.ticketNumber}
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          t.priority === 'Critical'
                            ? 'bg-error text-on-error'
                            : t.priority === 'High'
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-surface-container text-on-surface'
                        }`}
                      >
                        {t.priority}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface-variant text-[10px]">
                        {t.status}
                      </span>
                    </div>
                  </div>
                  <div className="pl-1">
                    <h4 className="text-[13px] font-semibold text-on-surface line-clamp-1">
                      {t.subject}
                    </h4>
                    <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
                      {t.customerName} ({t.company})
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-0.5 text-[11px] text-on-surface-variant pl-1 tabular-nums">
                    <span className={t.slaMinutesRemaining <= 20 && t.slaMinutesRemaining > 0 ? 'text-error font-medium' : ''}>
                      {t.slaMinutesRemaining > 0 ? `${t.slaMinutesRemaining}m SLA` : 'Completed'}
                    </span>
                    <span className="font-mono">{formatRelativeTime(t.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* PANE 2: CENTER - Ticket Detail & AI Workspace */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          {activeTicket ? (
            <>
              {/* Ticket Header Strip */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded">
                      {activeTicket.ticketNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        activeTicket.priority === 'Critical'
                          ? 'bg-error text-on-error'
                          : 'bg-surface-container-high text-primary'
                      }`}
                    >
                      {activeTicket.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[11px] font-medium">
                      {activeTicket.status}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant text-[11px] font-medium">
                      {activeTicket.category}
                    </span>
                  </div>
                  {activeTicket.slaMinutesRemaining > 0 && (
                    <span className="px-2.5 py-1 rounded bg-error-container text-on-error-container text-[11px] font-semibold flex items-center gap-1.5 tabular-nums">
                      <span className="material-symbols-outlined text-[15px]">timer</span>
                      {activeTicket.slaMinutesRemaining}m to SLA breach
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="text-[20px] font-semibold text-on-surface leading-snug">
                    {activeTicket.subject}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-[12px] text-on-surface-variant">
                    <span className="font-medium text-on-surface">{activeTicket.customerName}</span>
                    <span>•</span>
                    <span className="text-primary">{activeTicket.customerEmail}</span>
                    <span>•</span>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-tertiary text-[11px] font-semibold">
                      {activeTicket.customerTier}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Executive Summary */}
              <div className="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-on-surface">
                          AI Executive Summary
                        </h3>
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary font-mono text-[10px]">
                          Gemini Synthesized
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Auto-extracted key facts &amp; recommended resolution plan
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-error-container text-on-error-container text-[11px] font-semibold flex items-center gap-1 tabular-nums">
                    <span className="material-symbols-outlined text-[14px]">sentiment_satisfied</span>
                    Sentiment: {activeTicket.sentimentLabel} ({activeTicket.sentimentScore})
                  </span>
                </div>

                <ul className="space-y-2 pt-1 text-[13px] text-on-surface">
                  {activeTicket.aiSummary.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-[16px] mt-0.5 shrink-0">
                        arrow_right
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-between pt-2 text-on-surface-variant text-[11px] border-t border-surface-container">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-on-surface">Detected Intent:</span>
                    <span className="px-2 py-0.5 rounded bg-surface-container font-medium text-on-surface">
                      {activeTicket.detectedIntent}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums">
                    Confidence: {activeTicket.aiConfidence}%
                  </span>
                </div>
              </div>

              {/* Conversation Timeline */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-on-surface">Ticket Thread</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Chronological ({activeTicket.messages.length} events)
                  </span>
                </div>

                {activeTicket.messages.map((msg) => {
                  if (msg.isSystemEvent || msg.senderRole === 'system') {
                    return (
                      <div
                        key={msg.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-container-high/60"
                      >
                        <span className="material-symbols-outlined text-[18px] text-primary">
                          smart_toy
                        </span>
                        <div className="flex-1 flex flex-wrap items-center justify-between gap-1 text-[12px] text-on-surface">
                          <span>
                            <strong>{msg.senderName}:</strong> {msg.body}
                          </span>
                          <span className="font-mono text-[11px] text-on-surface-variant">
                            {formatRelativeTime(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const isSupport = msg.senderRole === 'support';
                  return (
                    <div key={msg.id} className="flex items-start gap-3">
                      <Avatar
                        src={msg.senderAvatar || (isSupport ? AVATAR_RAHUL_HEADER : undefined)}
                        alt={msg.senderName}
                        initials={msg.senderName.slice(0, 2).toUpperCase()}
                        className="w-8 h-8 mt-0.5"
                      />
                      <div
                        className={`flex-1 rounded-xl p-3.5 flex flex-col gap-2 ${
                          msg.isInternal
                            ? 'bg-error-container/25'
                            : isSupport
                              ? 'bg-surface-container'
                              : 'bg-surface-container-low'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold text-on-surface">
                              {msg.senderName}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                isSupport
                                  ? 'bg-primary text-on-primary'
                                  : 'bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              {msg.isInternal
                                ? 'Internal Note'
                                : isSupport
                                  ? 'Support Staff'
                                  : 'Customer'}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-on-surface-variant">
                            {formatRelativeTime(msg.createdAt)}
                          </span>
                        </div>
                        <p className="text-[13px] text-on-surface leading-relaxed whitespace-pre-line">
                          {msg.body}
                        </p>
                        {msg.payloadSnippet && (
                          <div className="bg-inverse-surface text-inverse-on-surface p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                            <pre className="text-tertiary-fixed leading-tight whitespace-pre-wrap">
                              <code>{msg.payloadSnippet}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Smart Composer */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      auto_fix_high
                    </span>
                    <span className="text-[15px] font-semibold text-on-surface">
                      AI Smart Composer
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={draftLoading}
                      onClick={() => handleGenerateDraft('draft')}
                      className="px-2.5 py-1 rounded bg-secondary-container text-on-secondary-container hover:bg-secondary text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[14px]">magic_button</span>
                      <span>{draftLoading ? 'Drafting...' : 'Draft AI Response'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={draftLoading}
                      onClick={() => handleGenerateDraft('kb_snippet')}
                      className="px-2.5 py-1 rounded bg-surface-container-low text-on-surface hover:bg-surface-container text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">menu_book</span>
                      <span>Insert KB Snippet</span>
                    </button>
                    <button
                      type="button"
                      disabled={draftLoading}
                      onClick={() => handleGenerateDraft('diagnostics')}
                      className="px-2.5 py-1 rounded bg-surface-container-low text-on-surface hover:bg-surface-container text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">troubleshoot</span>
                      <span>Request Diagnostics</span>
                    </button>
                  </div>
                </div>

                <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-primary font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">bolt</span>
                        Copilot Suggestion ({tone})
                      </span>
                      <span className="text-on-surface-variant font-mono hidden sm:inline">
                        Press Tab to focus
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowToneMenu((v) => !v)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">tune</span>
                      <span>Adjust Tone</span>
                    </button>

                    {showToneMenu && (
                      <div className="absolute right-0 top-7 bg-surface-container-lowest shadow-lg rounded-lg p-1.5 z-20 flex flex-col gap-1 ring-1 ring-surface-variant">
                        {['Executive & Empathetic', 'Concise & Technical', 'Warm & Reassuring'].map(
                          (tOption) => (
                            <button
                              key={tOption}
                              type="button"
                              onClick={() => {
                                setTone(tOption);
                                setShowToneMenu(false);
                                handleGenerateDraft('draft', tOption);
                              }}
                              className="text-left px-2.5 py-1 rounded hover:bg-surface-container-low text-[11px] text-on-surface cursor-pointer whitespace-nowrap"
                            >
                              {tOption}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <textarea
                    ref={composerRef}
                    rows={4}
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder="Draft your reply..."
                    className="w-full bg-surface-container-lowest text-on-surface p-3 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-primary shadow-xs resize-y"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInternalMode((m) => !m)}
                      title="Toggle Internal Note Mode"
                      className={`p-1.5 rounded flex items-center gap-1 text-[11px] cursor-pointer ${
                        internalMode
                          ? 'bg-error-container text-error font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">lock</span>
                      {internalMode && <span>Internal Only</span>}
                    </button>
                    <label className="flex items-center gap-1.5 text-[11px] text-on-surface-variant cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ccRep}
                        onChange={(e) => setCcRep(e.target.checked)}
                        className="rounded accent-primary cursor-pointer"
                      />
                      <span>Send copy to Account Rep (Lisa T.)</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleEscalate}
                      className="px-3 py-1.5 rounded bg-surface-container text-on-surface hover:bg-surface-container-high text-[12px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                      <span>Escalate</span>
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => handleSendReply('In Progress')}
                      className="px-3 py-1.5 rounded bg-surface-container-high text-on-surface hover:bg-surface-variant text-[12px] font-medium cursor-pointer disabled:opacity-60"
                    >
                      Send as In Progress
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => handleSendReply('Resolved')}
                      className="px-4 py-1.5 rounded bg-primary text-on-primary hover:bg-surface-tint text-[12px] font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[16px]">send_and_archive</span>
                      <span>Send &amp; Mark Resolved</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl p-10 text-center text-on-surface-variant">
              Select a ticket from the queue to inspect its thread and AI summary.
            </div>
          )}
        </section>

        {/* PANE 3: RIGHT - Contextual Inspector Sidebar */}
        <aside className="lg:col-span-3 flex flex-col gap-4">
          {activeTicket && (
            <>
              {/* Customer Profile */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-on-surface">Customer Profile</span>
                  <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed text-[11px] font-semibold">
                    Tier 1 VIP
                  </span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-[16px] text-primary font-bold">
                    {activeTicket.company.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-[14px] font-semibold text-on-surface">
                      {activeTicket.company}
                    </h4>
                    <p className="text-[11px] text-on-surface-variant">SaaS Platform Infrastructure</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] tabular-nums">
                  <div className="p-2 rounded bg-surface-container-low flex flex-col">
                    <span className="text-on-surface-variant">Annual ARR</span>
                    <span className="text-[14px] text-on-surface font-semibold">$48,000</span>
                  </div>
                  <div className="p-2 rounded bg-surface-container-low flex flex-col">
                    <span className="text-on-surface-variant">Contract Since</span>
                    <span className="text-[14px] text-on-surface font-semibold">March 2022</span>
                  </div>
                  <div className="p-2 rounded bg-surface-container-low flex flex-col">
                    <span className="text-on-surface-variant">Licensed Seats</span>
                    <span className="text-[14px] text-on-surface font-semibold">12 Enterprise</span>
                  </div>
                  <div className="p-2 rounded bg-surface-container-low flex flex-col">
                    <span className="text-on-surface-variant">Health Index</span>
                    <span className="text-[14px] text-tertiary font-semibold">94/100</span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-on-surface-variant">
                  <span>Primary Contact:</span>
                  <span className="font-medium text-on-surface">{activeTicket.customerName}</span>
                </div>
              </div>

              {/* AI Automated Remediation */}
              <div className="bg-surface-container-low rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">flash_on</span>
                  <h4 className="text-[15px] font-semibold text-on-surface">
                    AI Automated Remediation
                  </h4>
                </div>
                <p className="text-[12px] text-on-surface-variant">
                  Predictive actions calibrated to playbook for {activeTicket.category}.
                </p>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleInstantRemediation(
                        'Force-Synced Billing Webhook',
                        'Dispatched event ID #wh_993182 and unlocked 12 Enterprise seats.'
                      )
                    }
                    className="w-full p-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high transition-colors flex items-center justify-between text-left shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-primary">
                        sync_saved_locally
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-on-surface">
                          Force-Sync Billing Webhook
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Dispatches event ID #wh_993182
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                      chevron_right
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleInstantRemediation(
                        'Issued $50 SLA Courtesy Credit',
                        'Applied $50 account credit memo to next invoice cycle.'
                      )
                    }
                    className="w-full p-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high transition-colors flex items-center justify-between text-left shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-tertiary">
                        card_giftcard
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-on-surface">
                          Issue $50 SLA Courtesy Credit
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Recommended for CSAT protection
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                      chevron_right
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleInstantRemediation(
                        'Sent Renewal Confirmation',
                        `Delivered verified PDF receipt to ${activeTicket.customerEmail}.`
                      )
                    }
                    className="w-full p-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high transition-colors flex items-center justify-between text-left shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-on-surface">
                        mark_email_read
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-on-surface">
                          Send Renewal Confirmation
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Emails updated PDF receipt
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                      chevron_right
                    </span>
                  </button>
                </div>
              </div>

              {/* Past Tickets History */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-on-surface">
                    Past Ticket History
                  </span>
                  <span className="text-[11px] text-on-surface-variant tabular-nums">
                    Related: {pastTickets.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {pastTickets.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => onSelectTicket(pt.id)}
                      className="p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container flex flex-col gap-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono text-[11px] font-semibold text-primary">
                          {pt.ticketNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-tertiary text-[10px] font-medium">
                          {pt.status}
                        </span>
                      </div>
                      <p className="text-[12px] font-medium text-on-surface line-clamp-1">
                        {pt.subject}
                      </p>
                      <span className="text-[11px] text-on-surface-variant">
                        {formatRelativeTime(pt.createdAt)} · {pt.category}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuditModal(true)}
                  className="w-full py-1.5 rounded bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors text-[11px] font-medium cursor-pointer"
                >
                  View Full Account Audit Trail
                </button>
              </div>
            </>
          )}

          {/* Agent Metrics Micro-Widget */}
          {rahul && (
            <div className="bg-surface-container-low rounded-xl p-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Avatar src={rahul.avatarUrl} alt={rahul.name} initials={rahul.initials} className="w-7 h-7" />
                <div>
                  <p className="text-[11px] font-semibold text-on-surface">
                    {rahul.name}&apos;s Shift Stats
                  </p>
                  <p className="font-mono text-[11px] text-on-surface-variant tabular-nums">
                    CSAT: {rahul.csatScore}/5.0 • FCR: {rahul.fcrRate}%
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-surface-container-highest text-primary text-[11px] font-semibold">
                Rank #{rahul.rankPosition}
              </span>
            </div>
          )}
        </aside>
      </div>

      {/* Staff Copilot Floating Dock */}
      <div className="fixed bottom-12 right-6 z-40 flex flex-col items-end gap-2">
        {copilotOpen && (
          <div className="w-96 max-w-[calc(100vw-2rem)] bg-surface-container-lowest rounded-xl shadow-xl ring-1 ring-surface-variant/40 flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-primary-container to-secondary flex items-center justify-between text-on-primary">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-white">smart_toy</span>
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-white">BizAssist Staff Copilot</h4>
                  <p className="text-[10px] text-white/80">Real-time Triage &amp; Diagnostics</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCopilotOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-white cursor-pointer"
                aria-label="Minimize Copilot"
              >
                <span className="material-symbols-outlined text-[16px]">remove</span>
              </button>
            </div>

            <div className="px-3 py-2 bg-surface-container-low border-b border-surface-container-high/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
              {[
                'Summarize Diagnostic Logs',
                'Draft Escalation Note',
                'Lookup SLA Policy',
                'Verify Webhook Payload',
              ].map((pill) => (
                <button
                  key={pill}
                  type="button"
                  disabled={copilotLoading}
                  onClick={() => handleCopilotPrompt(pill)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-surface-container-lowest hover:bg-surface-container-high text-primary font-medium shadow-xs cursor-pointer"
                >
                  {pill}
                </button>
              ))}
            </div>

            <div className="p-3.5 bg-surface-bright text-[12px] max-h-64 overflow-y-auto">
              <div className="bg-surface-container-lowest p-3 rounded-xl shadow-xs border border-surface-container-high/60 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary text-[11px]">
                    {copilotLoading ? 'Analyzing with Gemini...' : 'Copilot Real-time Insight'}
                  </span>
                </div>
                <p className="text-on-surface-variant leading-relaxed">{copilotInsight.insight}</p>
                <div className="bg-surface-container-low p-2 rounded-lg text-[11px] text-on-surface">
                  <strong className="text-primary">Recommended:</strong> {copilotInsight.recommendation}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftText((prev) => `${prev ? `${prev}\n\n` : ''}${copilotInsight.recommendation}`);
                      composerRef.current?.focus();
                      onNotify('Applied Copilot recommendation into composer.');
                    }}
                    className="px-2.5 py-1 rounded bg-primary text-on-primary text-[11px] font-medium cursor-pointer"
                  >
                    Apply to Reply
                  </button>
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCopilotPrompt(copilotInput);
              }}
              className="p-2.5 bg-surface-container-lowest border-t border-surface-container-high flex items-center gap-1.5"
            >
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                placeholder="Ask Copilot about this ticket..."
                className="flex-1 bg-surface-container-low text-on-surface text-[12px] px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={copilotLoading}
                className="p-1.5 rounded-lg bg-primary text-on-primary hover:bg-surface-tint cursor-pointer disabled:opacity-60"
                aria-label="Send to Copilot"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCopilotOpen((o) => !o)}
          className="px-3.5 py-2 rounded-full bg-primary hover:bg-surface-tint text-on-primary shadow-lg flex items-center gap-2 cursor-pointer ring-2 ring-surface"
        >
          <span className="material-symbols-outlined text-[18px]">smart_toy</span>
          <span className="text-[12px] font-semibold">Staff Copilot</span>
        </button>
      </div>

      {/* Audit Trail Modal */}
      {showAuditModal && activeTicket && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl max-w-lg w-full p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-on-surface">
                Account Audit Trail — {activeTicket.company}
              </h3>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="p-1 rounded hover:bg-surface-container-low cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto text-[12px]">
              {activeTicket.messages.map((m) => (
                <div key={m.id} className="p-2.5 rounded-lg bg-surface-container-low">
                  <div className="flex justify-between font-semibold text-on-surface">
                    <span>{m.senderName}</span>
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      {formatRelativeTime(m.createdAt)}
                    </span>
                  </div>
                  <p className="text-on-surface-variant mt-1">{m.body}</p>
                </div>
              ))}
              {kbArticles.slice(0, 1).map((a) => (
                <div key={a.id} className="p-2.5 rounded-lg bg-surface-container text-primary">
                  Linked Runbook: <strong>{a.docCode}</strong> — {a.title}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
