import { useEffect, useMemo, useRef, useState } from 'react';
import type { KbArticle, Ticket, ViewPath } from '../types/bizassist';

interface CommandSearchModalProps {
  open: boolean;
  onClose: () => void;
  tickets: Ticket[];
  articles: KbArticle[];
  onSelectTicket: (ticketId: string) => void;
  onSelectView: (view: ViewPath) => void;
}

export function CommandSearchModal({
  open,
  onClose,
  tickets,
  articles,
  onSelectTicket,
  onSelectView,
}: CommandSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const matchedTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter((t) =>
        !q
          ? true
          : `${t.ticketNumber} ${t.subject} ${t.customerName} ${t.company}`
              .toLowerCase()
              .includes(q)
      )
      .slice(0, 4);
  }, [tickets, query]);

  const matchedArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles
      .filter((a) =>
        !q ? true : `${a.docCode} ${a.title} ${a.category}`.toLowerCase().includes(q)
      )
      .slice(0, 3);
  }, [articles, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-start justify-center pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-xl shadow-2xl max-w-xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-container-low">
          <span className="material-symbols-outlined text-primary text-[20px]">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to ticket (#TK-8942), customer, or Knowledge Base article..."
            className="flex-1 bg-transparent text-[14px] text-on-surface placeholder:text-outline focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-outline px-2 mb-1">
              Tickets
            </p>
            {matchedTickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSelectTicket(t.id);
                  onClose();
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-container-low flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <span className="font-mono text-[11px] font-bold text-primary mr-2">
                    {t.ticketNumber}
                  </span>
                  <span className="text-[13px] font-medium text-on-surface">{t.subject}</span>
                </div>
                <span className="text-[11px] text-on-surface-variant shrink-0">{t.status}</span>
              </button>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-outline px-2 mb-1">
              Knowledge Base
            </p>
            {matchedArticles.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onSelectView('knowledge-base-and-faqs');
                  onClose();
                }}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-container-low flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <span className="font-mono text-[11px] font-bold text-tertiary mr-2">
                    {a.docCode}
                  </span>
                  <span className="text-[13px] font-medium text-on-surface">{a.title}</span>
                </div>
                <span className="text-[11px] text-on-surface-variant shrink-0">{a.category}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
