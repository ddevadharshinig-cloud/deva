import { useEffect, useMemo, useRef, useState } from 'react';
import { AVATAR_RAHUL_HEADER } from '../constants/personas';
import type { FaqItem, KbArticle, ViewPath } from '../types/bizassist';
import { Avatar } from './Avatar';

interface KnowledgeBaseProps {
  articles: KbArticle[];
  faqs: FaqItem[];
  onNavigate: (view: ViewPath) => void;
  onNotify: (message: string, isError?: boolean) => void;
}

const CATEGORIES = [
  {
    title: 'Authentication & SSO',
    count: '18 articles',
    icon: 'lock',
    color: 'text-primary',
    description:
      'SAML 2.0, Okta, Google Workspace, multi-factor auth troubleshooting, and session token renewal.',
  },
  {
    title: 'Billing & Subscriptions',
    count: '24 articles',
    icon: 'credit_card',
    color: 'text-secondary',
    description:
      'Automated tax invoices, Stripe webhook failure recovery, dynamic tier upgrades, and seat management.',
  },
  {
    title: 'API & Webhook Integrations',
    count: '36 articles',
    icon: 'webhook',
    color: 'text-tertiary',
    description:
      'REST endpoints, Apache Kafka real-time sync, idempotent retry schemas, and enterprise rate limits.',
  },
  {
    title: 'User Management & RBAC',
    count: '19 articles',
    icon: 'manage_accounts',
    color: 'text-primary',
    description:
      'Custom role configuration, granular object permissions, automated team routing, and user audit trails.',
  },
  {
    title: 'AI Engine & Automated Triage',
    count: '22 articles',
    icon: 'neurology',
    color: 'text-secondary',
    description:
      'Customer intent scoring, confidence escalation thresholds, Copilot prompt recipes, and autonomous rules.',
  },
  {
    title: 'Compliance & Security',
    count: '15 articles',
    icon: 'shield_person',
    color: 'text-tertiary',
    description:
      'SOC-2 Type II verification, GDPR right-to-be-forgotten pipelines, encrypted data retention, and TLS 1.3 suites.',
  },
];

export function KnowledgeBase({
  articles,
  faqs,
  onNavigate,
  onNotify,
}: KnowledgeBaseProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openFaqIds, setOpenFaqIds] = useState<string[]>([faqs[0]?.id ?? 'faq-1']);
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);

  // AI Smart Synthesizer state
  const [synthQuery, setSynthQuery] = useState('');
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthResult, setSynthResult] = useState<{
    citationCode: string;
    answer: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (document.activeElement !== searchInputRef.current) {
          // Let global handler or local search focus cleanly
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      if (selectedCategory && a.category !== selectedCategory) return false;
      if (q) {
        const hay = `${a.docCode} ${a.title} ${a.category} ${a.summary} ${a.content}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [articles, selectedCategory, searchQuery]);

  function toggleFaq(id: string) {
    setOpenFaqIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSynthesize(customQuery?: string) {
    const queryToUse =
      (customQuery ?? synthQuery).trim() ||
      'How do I configure Okta SAML certificate rollover without SLA interruption?';
    if (!synthQuery.trim() && !customQuery) {
      setSynthQuery(queryToUse);
    }
    setSynthLoading(true);
    try {
      const res = await fetch('/api/ai/kb-synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToUse }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI synthesis failed.');
      setSynthResult({ citationCode: data.citationCode, answer: data.answer });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'AI synthesis failed.', true);
    } finally {
      setSynthLoading(false);
    }
  }

  function handleDownloadSpec(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Downloaded ${filename}`);
  }

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 overflow-hidden">
      <div className="absolute -top-32 right-1/4 w-96 h-96 bg-primary-fixed/30 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 1. Header & Semantic Search Area */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant">
            <span>Enterprise Support Operations</span>
            <span className="text-outline-variant">/</span>
            <span className="text-on-surface font-semibold">Knowledge Base &amp; Self-Service</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1 rounded-full text-on-surface-variant text-[11px] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-secondary-container" />
            <span className="font-medium text-on-surface">Vector Index: Synced</span>
            <span className="text-outline-variant">•</span>
            <span>Enterprise Knowledge Graph</span>
          </div>
        </div>

        <div className="flex flex-col max-w-3xl gap-2">
          <h1 className="text-[30px] sm:text-[32px] text-on-surface tracking-tight font-bold">
            Knowledge Base &amp; AI Self-Service Directory
          </h1>
          <p className="text-[15px] text-on-surface-variant leading-relaxed">
            Search verified technical documentation, API guides, billing troubleshooting, and instant AI-summarized solutions designed for enterprise velocity.
          </p>
        </div>

        {/* Semantic Search Command Input */}
        <div className="relative w-full bg-surface-container-lowest rounded-xl shadow-md p-2 focus-within:shadow-xl focus-within:ring-2 focus-within:ring-primary/20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                handleSynthesize(searchQuery);
              }
            }}
            className="flex items-center gap-3 px-3 py-1.5"
          >
            <span className="material-symbols-outlined text-primary text-[24px]">travel_explore</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask a question or search error codes, SSO setup, webhooks (e.g. 'Stripe webhook 504 retry')..."
              className="w-full bg-transparent text-[15px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                }}
                className="text-[11px] text-outline hover:text-on-surface cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={synthLoading}
              className="bg-primary hover:bg-secondary text-on-primary text-[12px] font-medium px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">spark</span>
              <span>{synthLoading ? 'Searching...' : 'AI Search'}</span>
            </button>
          </form>

          {/* Quick Filter Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-2 px-3 pb-1">
            <span className="text-[11px] text-on-surface-variant font-medium mr-1">
              Trending Topics:
            </span>
            {[
              { label: 'Stripe 504 Webhook', q: 'Stripe' },
              { label: 'Okta SAML 2.0 SSO', q: 'Okta' },
              { label: 'RBAC Permissions', q: 'RBAC' },
              { label: 'VAT & Invoice Receipts', q: 'Invoice' },
              { label: 'API Rate Limits', q: 'Rate' },
            ].map((tag) => (
              <button
                key={tag.label}
                type="button"
                onClick={() => {
                  setSearchQuery(tag.q);
                  setSelectedCategory(null);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container-high text-on-surface text-[11px] font-medium transition-colors cursor-pointer"
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Top Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 tabular-nums">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[16px] text-on-surface font-bold">142</span>
              <span className="text-[11px] text-on-surface-variant">Verified Articles</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">model_training</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[16px] text-on-surface font-bold">98.4%</span>
              <span className="text-[11px] text-on-surface-variant">AI Answer Accuracy</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[20px]">timer</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[16px] text-on-surface font-bold">3.2m</span>
              <span className="text-[11px] text-on-surface-variant">Avg Self-Resolution</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface">
              <span className="material-symbols-outlined text-[20px]">support_agent</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[16px] text-on-surface font-bold">24/7 Live</span>
              <span className="text-[11px] text-on-surface-variant">Triage Fallback Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Categories Grid */}
      <div className="mt-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">folder_managed</span>
            <h2 className="text-[20px] text-on-surface font-semibold">Documentation Categories</h2>
          </div>
          {selectedCategory ? (
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-[12px] text-primary font-semibold hover:underline cursor-pointer"
            >
              Clear Category Filter ({selectedCategory})
            </button>
          ) : (
            <span className="text-[11px] text-on-surface-variant">
              Click any subsystem to filter playbooks
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.title;
            return (
              <button
                key={cat.title}
                type="button"
                onClick={() =>
                  setSelectedCategory((prev) => (prev === cat.title ? null : cat.title))
                }
                className={`text-left group rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-surface-container-high ring-2 ring-primary'
                    : 'bg-surface-container-lowest hover:bg-surface-bright'
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center ${cat.color}`}
                    >
                      <span className="material-symbols-outlined text-[22px]">{cat.icon}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-primary text-[11px] font-semibold">
                      {cat.count}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[16px] text-on-surface font-semibold group-hover:text-primary transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-[13px] text-on-surface-variant mt-1">{cat.description}</p>
                  </div>
                </div>
                <div className="pt-4 flex items-center text-primary text-[12px] font-medium gap-1">
                  <span>{isSelected ? 'Filtering active' : 'Explore guides'}</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Two-Column Layout */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Featured Resolution Playbooks */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
                <h2 className="text-[20px] text-on-surface font-semibold">
                  {selectedCategory
                    ? `${selectedCategory} Playbooks`
                    : 'Featured Resolution Playbooks'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setSearchQuery('');
                }}
                className="text-[12px] text-primary font-medium hover:underline cursor-pointer"
              >
                View all {articles.length} guides
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {filteredArticles.length === 0 ? (
                <div className="bg-surface-container-lowest p-6 rounded-xl text-center text-on-surface-variant text-[13px]">
                  No articles matched &ldquo;{searchQuery}&rdquo;. Try using AI Smart Synthesizer on the right.
                </div>
              ) : (
                filteredArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => setSelectedArticle(article)}
                    className="w-full text-left bg-surface-container-lowest p-4 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container shrink-0 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">article</span>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] text-on-surface font-medium hover:text-primary">
                            {article.title}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-surface-container text-primary text-[11px] font-medium">
                            {article.priorityTag}
                          </span>
                        </div>
                        <p className="text-[13px] text-on-surface-variant line-clamp-1 mt-0.5">
                          {article.summary}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center text-[11px] text-on-surface-variant">
                      <span>{article.updatedLabel}</span>
                      <span className="material-symbols-outlined text-[16px] text-outline">
                        chevron_right
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Interactive FAQ Accordion */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">help_center</span>
                <h2 className="text-[20px] text-on-surface font-semibold">
                  Frequently Asked Questions
                </h2>
              </div>
              <span className="text-[11px] text-on-surface-variant">Updated daily by AI clustering</span>
            </div>

            <div className="flex flex-col gap-3">
              {faqs.map((faq) => {
                const isOpen = openFaqIds.includes(faq.id);
                return (
                  <div
                    key={faq.id}
                    className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full p-4 flex items-center justify-between text-left cursor-pointer focus:outline-none"
                    >
                      <span className="text-[15px] text-on-surface font-semibold pr-4">
                        {faq.question}
                      </span>
                      <span
                        className={`material-symbols-outlined text-[20px] text-primary transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      >
                        expand_more
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 flex flex-col gap-3">
                        <p className="text-[13px] text-on-surface-variant leading-relaxed">
                          {faq.answer}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container-low p-2.5 rounded-lg text-[11px]">
                          <div className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                            <span>
                              AI Confidence: <strong>{faq.confidence}%</strong>
                            </span>
                          </div>
                          <span className="text-on-surface-variant">
                            Verified by {faq.verifiedBy}
                            {faq.runbookRef ? ` · ${faq.runbookRef}` : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column Sidebar Tools */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* AI Smart Synthesizer */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[18px]">neurology</span>
              </div>
              <div>
                <h3 className="text-[16px] text-on-surface font-semibold">AI Smart Synthesizer</h3>
                <p className="text-[11px] text-on-surface-variant">
                  Ask questions across all verified articles
                </p>
              </div>
            </div>

            <textarea
              rows={3}
              value={synthQuery}
              onChange={(e) => setSynthQuery(e.target.value)}
              placeholder="e.g. How do I rotate my SAML signing certificate without downtime?"
              className="w-full bg-surface-container-low rounded-lg p-3 text-[13px] text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />

            <button
              type="button"
              disabled={synthLoading}
              onClick={() => handleSynthesize()}
              className="w-full bg-secondary-fixed hover:bg-surface-container-high text-primary text-[12px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors font-semibold cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              <span>{synthLoading ? 'Synthesizing...' : 'Synthesize Solution'}</span>
            </button>

            {synthResult && (
              <div className="bg-surface-container-low/80 p-3 rounded-lg flex flex-col gap-2">
                <div className="flex items-center justify-between text-primary text-[11px]">
                  <span className="flex items-center gap-1 font-semibold">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    Verified Citation
                  </span>
                  <span className="font-mono font-semibold">{synthResult.citationCode}</span>
                </div>
                <p className="text-[12px] text-on-surface leading-relaxed">{synthResult.answer}</p>
              </div>
            )}
          </div>

          {/* Still Need Assistance */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary" />
                <h3 className="text-[16px] text-on-surface font-semibold">Still Need Assistance?</h3>
              </div>
              <p className="text-[13px] text-on-surface-variant">
                Enterprise customer tier accounts are backed by round-the-clock priority escalation engineers.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onNavigate('customer-portal')}
                className="w-full bg-primary hover:bg-secondary text-on-primary text-[12px] py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_task</span>
                <span>Submit Support Ticket</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('customer-portal')}
                className="w-full bg-surface-container-low hover:bg-surface-container-high text-on-surface text-[12px] py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">chat_spark</span>
                <span>Launch AI Copilot Assistant</span>
              </button>
            </div>

            <div className="bg-surface-container-low p-3 rounded-lg flex items-center gap-3">
              <Avatar
                src={AVATAR_RAHUL_HEADER}
                alt="Rahul Sharma"
                initials="RS"
                className="w-10 h-10"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] text-on-surface font-semibold truncate">
                  Rahul Sharma
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  Lead FinOps &amp; Integration Lead
                </span>
                <span className="text-[11px] text-tertiary font-medium">
                  Response SLA &lt; 15 mins
                </span>
              </div>
            </div>
          </div>

          {/* Resources & Specs */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">download</span>
              <h3 className="text-[16px] text-on-surface font-semibold">Resources &amp; Specs</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() =>
                  handleDownloadSpec(
                    'BizAssist-Enterprise-Security-Architecture.txt',
                    'BizAssist AI Enterprise Security Architecture\n- SOC-2 Type II Certified\n- 256-bit TLS 1.3 Encryption\n- SAML 2.0 + SCIM 2.0 Directory Sync\n- Signed NDJSON Audit Trail Exports'
                  )
                }
                className="w-full text-left flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-error text-[22px]">
                    picture_as_pdf
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] text-on-surface font-medium truncate group-hover:text-primary">
                      Enterprise Security Architecture
                    </span>
                    <span className="text-[11px] text-on-surface-variant">Spec Sheet • Summary</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-primary">
                  arrow_downward
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDownloadSpec(
                    'bizassist-openapi-3.1.json',
                    JSON.stringify(
                      {
                        openapi: '3.1.0',
                        info: { title: 'BizAssist AI Enterprise API', version: '4.18.2' },
                        paths: {
                          '/api/tickets': { post: { summary: 'Submit & AI Classify Ticket' } },
                          '/api/ai/kb-synthesize': { post: { summary: 'Synthesize KB Answer' } },
                        },
                      },
                      null,
                      2
                    )
                  )
                }
                className="w-full text-left flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-tertiary text-[22px]">
                    data_object
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] text-on-surface font-medium truncate group-hover:text-primary">
                      OpenAPI 3.1 &amp; Postman Collection
                    </span>
                    <span className="text-[11px] text-on-surface-variant">JSON • Schema</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-primary">
                  arrow_downward
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl max-w-2xl w-full p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[12px] font-bold text-primary">
                    {selectedArticle.docCode}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-medium text-on-surface">
                    {selectedArticle.category}
                  </span>
                </div>
                <h3 className="text-[19px] font-semibold text-on-surface">
                  {selectedArticle.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="p-1 rounded hover:bg-surface-container-low cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="text-[13px] text-on-surface-variant font-medium">
              {selectedArticle.summary}
            </p>
            <div className="p-4 rounded-xl bg-surface-container-low text-[13px] text-on-surface leading-relaxed">
              {selectedArticle.content}
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-on-surface-variant">
                {selectedArticle.updatedLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedArticle(null);
                  onNavigate('customer-portal');
                }}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-[12px] font-semibold cursor-pointer"
              >
                Need Help With This? Submit Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
