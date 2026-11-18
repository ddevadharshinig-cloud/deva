import { useMemo, useRef, useState } from 'react';
import { AVATAR_RAHUL_PORTAL, formatRelativeTime } from '../constants/personas';
import type { KbArticle, Ticket, ViewPath } from '../types/bizassist';
import { Avatar } from './Avatar';

interface CustomerPortalProps {
  tickets: Ticket[];
  kbArticles: KbArticle[];
  onCreateTicket: (payload: {
    subject: string;
    description: string;
    referenceId?: string;
    customerName: string;
    customerEmail: string;
    company: string;
  }) => Promise<Ticket>;
  onPingSpecialist: (ticketId: string) => Promise<void>;
  onNavigate: (view: ViewPath) => void;
  onNotify: (message: string, isError?: boolean) => void;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  source?: string;
}

export function CustomerPortal({
  tickets,
  kbArticles,
  onCreateTicket,
  onPingSpecialist,
  onNavigate,
  onNotify,
}: CustomerPortalProps) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('All');
  const [viewedThreadTicket, setViewedThreadTicket] = useState<Ticket | null>(null);

  // Docked AI Assistant state
  const [chatOpen, setChatOpen] = useState(true);
  const [botInput, setBotInput] = useState('');
  const [botLoading, setBotLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'c-1',
      sender: 'ai',
      text: 'Hello! I am your AI concierge. I can instantly answer setup questions or escalate complex issues to Rahul.',
      source: 'BizAssist LLM',
    },
    {
      id: 'c-2',
      sender: 'ai',
      text: 'To download tax invoices: Head to Organization Settings > Billing > Invoices. Select the date range and click "Export ZIP of Invoices & Receipts" for official compliance PDFs.',
      source: 'Source: BizAssist Knowledge Base #KB-221',
    },
  ]);

  const subjectInputRef = useRef<HTMLInputElement>(null);
  const submitAnchorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTicket = useMemo(() => {
    return (
      tickets.find(
        (t) =>
          (t.company === 'Acme Corporation' || t.customerName === 'Marcus Vance' || t.customerName === 'Priya (Customer)') &&
          t.status !== 'Resolved' &&
          t.status !== 'Closed'
      ) ??
      tickets.find((t) => t.status !== 'Resolved' && t.status !== 'Closed') ??
      tickets[0] ??
      null
    );
  }, [tickets]);

  const historyTickets = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return tickets.filter((t) => {
      if (historyStatus !== 'All' && t.status !== historyStatus) return false;
      if (q) {
        const hay = `${t.ticketNumber} ${t.subject} ${t.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, historySearch, historyStatus]);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const created = await onCreateTicket({
        subject: subject.trim(),
        description: attachedFileName
          ? `${description.trim()}\n\n[Attached Diagnostic: ${attachedFileName}]`
          : description.trim(),
        referenceId: referenceId.trim() || undefined,
        customerName: 'Marcus Vance',
        customerEmail: 'marcus.v@acme-saas.com',
        company: 'Acme Corporation',
      });
      setSubject('');
      setDescription('');
      setReferenceId('');
      setAttachedFileName(null);
      onNotify(
        `Ticket ${created.ticketNumber} dispatched! AI classified as "${created.category}" (${created.priority}).`
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function askBot(query: string) {
    if (!query.trim()) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
    };
    setChatHistory((prev) => [...prev, userMsg]);
    setBotInput('');
    setBotLoading(true);
    try {
      const res = await fetch('/api/ai/customer-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query.trim(),
          activeTicketId: activeTicket?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assistant unavailable.');
      setChatHistory((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'ai',
          text: data.reply,
          source: data.source,
        },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          sender: 'ai',
          text: err instanceof Error ? err.message : 'Unable to reach AI assistant.',
        },
      ]);
    } finally {
      setBotLoading(false);
    }
  }

  function convertChatToTicket() {
    const lastUserQuery = [...chatHistory].reverse().find((m) => m.sender === 'user')?.text;
    setSubject(lastUserQuery ? `Assistance needed: ${lastUserQuery.slice(0, 60)}` : 'Assistance needed: Enterprise SSO SAML query');
    setDescription(
      `Exported from Live AI Assistant session:\n${chatHistory
        .slice(-3)
        .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
        .join('\n')}`
    );
    setChatOpen(false);
    submitAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => subjectInputRef.current?.focus(), 300);
  }

  const stepIndex = activeTicket?.trackerStep ?? 4;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col w-full gap-6">
      {/* Hero Surface */}
      <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-6 shadow-sm">
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-primary-fixed/30 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary text-[11px] font-semibold">
                Enterprise Tier Tier-1
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">
                Acme Corp Global (#ACM-8491)
              </span>
            </div>
            <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">
              Welcome back, Marcus! How can we assist you today?
            </h1>
            <p className="text-[13px] text-on-surface-variant">
              Your dedicated enterprise SLA coverage is fully active. Triage AI continually monitors critical webhook, authentication, and platform pipelines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                submitAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
                subjectInputRef.current?.focus();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-[12px] font-semibold hover:bg-surface-tint shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Submit New Ticket</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('knowledge-base-and-faqs')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container text-on-surface text-[12px] font-medium hover:bg-surface-container-high cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-tertiary">menu_book</span>
              <span>Browse Help Center</span>
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-secondary text-on-secondary text-[12px] font-medium hover:bg-secondary-container shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              <span>Open Live Assistant</span>
            </button>
          </div>
        </div>

        {/* Quick Status Cards */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-container-lowest/70 backdrop-blur rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">bolt</span>
            </div>
            <div>
              <p className="text-[11px] text-on-surface-variant">Priority Response SLA</p>
              <p className="text-[15px] text-on-surface font-semibold tabular-nums">&lt; 15 min</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <div>
              <p className="text-[11px] text-on-surface-variant">Dedicated Lead Specialist</p>
              <p className="text-[15px] text-on-surface font-semibold">Rahul Sharma</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">schedule</span>
            </div>
            <div>
              <p className="text-[11px] text-on-surface-variant">Real-Time Operational Status</p>
              <p className="text-[15px] text-on-surface font-semibold">All Gateways Online</p>
            </div>
          </div>
        </div>
      </section>

      {/* Active Ticket Tracker */}
      {activeTicket && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-semibold text-on-surface">Active Ticket Tracker</h2>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-mono text-[11px] font-semibold">
                {activeTicket.status}
              </span>
            </div>
            <span className="font-mono text-[11px] text-on-surface-variant hidden sm:inline">
              Telemetry ID: {activeTicket.ticketNumber}
            </span>
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface-container-low/60 p-4 rounded-lg">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] px-2 py-0.5 rounded bg-primary text-on-primary font-bold">
                    {activeTicket.ticketNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[11px] font-semibold">
                    {activeTicket.priority} Urgency
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant text-[11px]">
                    {activeTicket.category}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Logged {formatRelativeTime(activeTicket.createdAt)}
                  </span>
                </div>
                <h3 className="text-[16px] text-on-surface font-semibold pt-1">
                  {activeTicket.subject}
                </h3>
              </div>

              <div className="flex items-center gap-3 bg-surface-container-lowest px-4 py-2.5 rounded-lg shadow-sm self-start md:self-auto">
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">timer</span>
                </div>
                <div>
                  <div className="text-[11px] text-on-surface-variant">Est. Resolution Time</div>
                  <div className="text-[15px] text-primary font-bold tabular-nums">
                    {activeTicket.slaMinutesRemaining > 0
                      ? `~${activeTicket.slaMinutesRemaining} minutes`
                      : 'Completed'}
                  </div>
                </div>
              </div>
            </div>

            {/* 5-Step Progress Tracker */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                { step: 1, title: 'Ticket Submitted', detail: 'Logged in queue' },
                { step: 2, title: 'AI Analyzed', detail: `${activeTicket.category} (${activeTicket.aiConfidence}%)` },
                { step: 3, title: 'Assigned Specialist', detail: 'Rahul Sharma (FinOps)' },
                { step: 4, title: 'Investigation', detail: 'Agent drafting response' },
                { step: 5, title: 'Resolution & Sign-off', detail: 'Customer confirmation' },
              ].map((s) => {
                const done = stepIndex > s.step;
                const current = stepIndex === s.step;
                return (
                  <div
                    key={s.step}
                    className={`flex flex-col space-y-1.5 p-2.5 rounded-lg ${
                      current ? 'bg-surface-container-low/80' : ''
                    } ${!done && !current ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shadow-xs ${
                          done
                            ? 'bg-tertiary text-on-tertiary'
                            : current
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {done ? (
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        ) : current ? (
                          <span className="material-symbols-outlined text-[16px]">sync</span>
                        ) : (
                          s.step
                        )}
                      </div>
                      <span
                        className={`text-[12px] font-semibold ${
                          current ? 'text-primary' : 'text-on-surface'
                        }`}
                      >
                        Step {s.step}
                      </span>
                    </div>
                    <p className="text-[13px] font-semibold text-on-surface">{s.title}</p>
                    <p className="text-[11px] text-on-surface-variant">{s.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2 text-on-surface-variant text-[11px]">
                <span className="material-symbols-outlined text-[16px] text-tertiary">lock_clock</span>
                <span>SLA Target: Guaranteed under 60-min MTTR for Critical incidents</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPingSpecialist(activeTicket.id)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-[12px] font-medium hover:bg-surface-container flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">priority_high</span>
                  <span>Ping Specialist</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewedThreadTicket(activeTicket)}
                  className="px-3 py-1.5 rounded-lg bg-primary-fixed text-on-primary-fixed-variant text-[12px] font-medium hover:bg-primary-fixed-dim flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>View Live Stream</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ticket Submission & Context Visual */}
      <div
        ref={submitAnchorRef}
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
      >
        <section className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-semibold text-on-surface">Submit New Ticket</h2>
              <p className="text-[12px] text-on-surface-variant">
                Intelligent automated routing dispatch to the senior engineering triage queue.
              </p>
            </div>
            <span className="material-symbols-outlined text-primary text-[28px]">smart_toy</span>
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm space-y-4">
            <div className="p-3 rounded-lg bg-surface-container-low flex items-start gap-2.5">
              <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">
                auto_awesome
              </span>
              <p className="text-[12px] text-on-surface-variant leading-relaxed">
                <strong className="font-semibold text-primary">Zero manual classification required:</strong>{' '}
                Priority, category, and target team are automatically classified by Gemini AI upon submission.
              </p>
            </div>

            <form className="space-y-3.5" onSubmit={handleFormSubmit}>
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-on-surface" htmlFor="cp-subject">
                  Subject Line <span className="text-error">*</span>
                </label>
                <input
                  ref={subjectInputRef}
                  id="cp-subject"
                  required
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Unable to invite new team members via SAML SSO"
                  className="w-full px-3.5 py-2 text-on-surface text-[13px] rounded-lg bg-surface-container-low/60 placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[12px] font-semibold text-on-surface" htmlFor="cp-desc">
                    Issue Description <span className="text-error">*</span>
                  </label>
                  <span className="text-[11px] text-outline">AI summarizes automatically</span>
                </div>
                <textarea
                  id="cp-desc"
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your issue in detail. Our AI will analyze your query, categorize the urgency, and route it to the right specialist immediately."
                  className="w-full px-3.5 py-2.5 text-on-surface text-[13px] rounded-lg bg-surface-container-low/60 placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/25 resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-on-surface" htmlFor="cp-ref">
                  Reference / Order ID <span className="font-normal text-outline text-[11px]">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline">
                    tag
                  </span>
                  <input
                    id="cp-ref"
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder="e.g. ORD-94821 or Inv #4412"
                    className="w-full pl-9 pr-3.5 py-2 text-on-surface text-[13px] rounded-lg bg-surface-container-low/60 placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-on-surface">
                  Attachments &amp; Diagnostics
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setAttachedFileName(f.name);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg bg-surface-container-low/70 p-4 text-center hover:bg-surface-container transition-colors cursor-pointer flex flex-col items-center justify-center gap-1"
                >
                  <div className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
                  </div>
                  <p className="text-[12px] text-on-surface font-semibold">
                    {attachedFileName ? `Attached: ${attachedFileName}` : 'Click to attach logs or screenshots'}
                  </p>
                  <p className="text-[11px] text-outline">Supports HAR, JSON, PNG, PDF up to 25MB</p>
                </button>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-tertiary" />
                  <span className="text-[11px] text-on-surface-variant">
                    Instant Gemini classification active
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold hover:bg-surface-tint shadow-md cursor-pointer disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>{submitting ? 'Analyzing & Dispatching...' : 'Submit Ticket to AI Queue'}</span>
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Side Panel */}
        <aside className="lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-on-surface">Assigned Enterprise Pod</h3>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-primary text-[11px] font-semibold">
                Tier-1 Direct
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Avatar
                src={AVATAR_RAHUL_PORTAL}
                alt="Rahul Sharma"
                initials="RS"
                className="w-12 h-12"
              />
              <div>
                <h4 className="text-[15px] font-semibold text-on-surface">Rahul Sharma</h4>
                <p className="text-[12px] text-on-surface-variant">Principal Solutions Architect</p>
                <p className="text-[11px] text-tertiary font-medium mt-0.5">
                  Available &amp; Monitoring Queue
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-surface-container-low p-3.5 space-y-2 tabular-nums">
              <div className="flex justify-between text-[11px]">
                <span className="text-on-surface-variant">Acme Corp Monthly SLA Quota</span>
                <span className="text-primary font-semibold">99.98% Met</span>
              </div>
              <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '98%' }} />
              </div>
              <div className="flex justify-between text-[11px] text-on-surface-variant">
                <span>Avg Response: 8.4 mins</span>
                <span>Target: &lt; 15 mins</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-low p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">lightbulb</span>
              <h3 className="text-[15px] font-semibold text-on-surface">
                Suggested Self-Service Fixes
              </h3>
            </div>
            <p className="text-[12px] text-on-surface-variant">
              Frequently referenced solutions based on Acme Corp&apos;s recent API events:
            </p>
            <div className="space-y-2">
              {kbArticles.slice(0, 3).map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => {
                    setChatOpen(true);
                    askBot(`Explain ${article.title}`);
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <span className="text-[12px] font-medium text-on-surface group-hover:text-primary line-clamp-1 pr-2">
                    {article.title}
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-outline shrink-0">
                    arrow_forward_ios
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Ticket History & Resolution Log */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-semibold text-on-surface">
              Ticket History &amp; Resolution Log
            </h2>
            <p className="text-[12px] text-on-surface-variant">
              Archival records of past resolutions, compliance sign-offs, and root-cause analyses.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search tickets..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-container-lowest text-[12px] text-on-surface shadow-sm focus:outline-none w-44 md:w-56"
              />
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-outline">
                search
              </span>
            </div>
            <select
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              aria-label="Filter history status"
              className="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest text-[12px] font-medium text-on-surface shadow-sm focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-[11px] text-on-surface-variant uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Ticket ID</th>
                  <th className="py-3 px-4 font-semibold">Subject &amp; Category</th>
                  <th className="py-3 px-4 font-semibold">Submitted</th>
                  <th className="py-3 px-4 font-semibold">Urgency</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low text-[13px]">
                {historyTickets.slice(0, 6).map((t) => (
                  <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[12px] font-bold text-primary">
                      {t.ticketNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-on-surface">{t.subject}</div>
                      <div className="text-[11px] text-outline">{t.category}</div>
                    </td>
                    <td className="py-3 px-4 text-[12px] text-on-surface-variant tabular-nums">
                      {formatRelativeTime(t.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          t.priority === 'Critical' || t.priority === 'High'
                            ? 'bg-error-container text-on-error-container'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[11px] font-semibold">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setViewedThreadTicket(t)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container text-on-surface text-[11px] font-medium hover:bg-surface-container-high cursor-pointer"
                      >
                        <span>View Thread</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Docked AI Assistant Widget */}
      {chatOpen ? (
        <aside className="fixed bottom-12 right-6 z-40 w-96 max-w-[calc(100vw-2rem)] rounded-xl bg-surface-container-lowest shadow-2xl flex flex-col overflow-hidden ring-1 ring-surface-variant/40">
          <div className="bg-primary p-3.5 text-on-primary flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-white">smart_toy</span>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-white">BizAssist AI Assistant</h3>
                <p className="text-[11px] text-primary-fixed">Live Knowledge Base &amp; Triage</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="p-1 rounded text-primary-fixed hover:text-white cursor-pointer"
              aria-label="Minimize assistant"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="p-3.5 space-y-3 max-h-72 overflow-y-auto bg-surface-bright text-[12px]">
            {chatHistory.map((m) =>
              m.sender === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="bg-primary text-on-primary p-2.5 rounded-xl rounded-tr-none max-w-[85%]">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary shrink-0 flex items-center justify-center text-on-primary">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  </div>
                  <div className="space-y-1">
                    <div className="bg-surface-container-low p-2.5 rounded-xl rounded-tl-none text-on-surface leading-relaxed">
                      {m.text}
                    </div>
                    {m.source && <span className="text-[10px] text-outline pl-1">{m.source}</span>}
                  </div>
                </div>
              )
            )}

            {botLoading && (
              <div className="text-[11px] text-primary pl-8">Thinking with Gemini...</div>
            )}

            <div className="space-y-1.5 pl-8">
              <p className="text-[11px] text-on-surface-variant font-semibold">Common inquiries:</p>
              <button
                type="button"
                onClick={() => askBot('How do I reset SAML SSO?')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-medium flex items-center justify-between cursor-pointer"
              >
                <span>How do I reset SAML SSO?</span>
                <span className="material-symbols-outlined text-[14px] text-primary">send</span>
              </button>
            </div>
          </div>

          <div className="p-2.5 bg-surface-container-low flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant">Need specialist help?</span>
            <button
              type="button"
              onClick={convertChatToTicket}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary text-on-secondary text-[11px] font-semibold hover:bg-secondary-container cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">assignment_turned_in</span>
              <span>Convert to Support Ticket</span>
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              askBot(botInput);
            }}
            className="p-2.5 bg-surface-container-lowest flex items-center gap-2"
          >
            <input
              type="text"
              value={botInput}
              onChange={(e) => setBotInput(e.target.value)}
              placeholder="Type a question or error snippet..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface text-[12px] placeholder:text-outline focus:outline-none"
            />
            <button
              type="submit"
              disabled={botLoading}
              className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center hover:bg-surface-tint cursor-pointer disabled:opacity-60"
              aria-label="Send message"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            </button>
          </form>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-12 right-6 z-40 w-14 h-14 rounded-full bg-primary text-on-primary shadow-xl flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
          aria-label="Open AI Assistant"
        >
          <span className="material-symbols-outlined text-[26px]">smart_toy</span>
        </button>
      )}

      {/* Thread Drawer Modal */}
      {viewedThreadTicket && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl max-w-2xl w-full p-6 flex flex-col gap-4 max-h-[85vh]">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-[12px] font-bold text-primary">
                  {viewedThreadTicket.ticketNumber}
                </span>
                <h3 className="text-[17px] font-semibold text-on-surface">
                  {viewedThreadTicket.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewedThreadTicket(null)}
                className="p-1 rounded hover:bg-surface-container-low cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto pr-1">
              {viewedThreadTicket.messages.length === 0 ? (
                <p className="text-[13px] text-on-surface-variant">
                  {viewedThreadTicket.description}
                </p>
              ) : (
                viewedThreadTicket.messages.map((m) => (
                  <div key={m.id} className="p-3 rounded-lg bg-surface-container-low text-[13px]">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface mb-1">
                      <span>{m.senderName}</span>
                      <span className="font-mono text-on-surface-variant">
                        {formatRelativeTime(m.createdAt)}
                      </span>
                    </div>
                    <p className="text-on-surface leading-relaxed">{m.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
