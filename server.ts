import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  classifyTicketWithAI,
  customerPortalChatWithAI,
  draftSupportReplyWithAI,
  staffCopilotWithAI,
  synthesizeKbAnswerWithAI,
} from './server/ai.ts';
import {
  addTicketMessageRecord,
  autoAssignUnassignedTickets,
  createTicketRecord,
  getBackendStatus,
  listAllData,
  rebalanceStaffQueue,
  updateTicketRecord,
} from './server/db.ts';
import type { TicketStatus } from './src/types/bizassist.ts';

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health & Backend/Supabase status
  app.get('/api/health', async (_req, res) => {
    try {
      const status = await getBackendStatus();
      res.json({ ok: true, ...status });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Bootstrap all application state
  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const [data, backendStatus] = await Promise.all([listAllData(), getBackendStatus()]);
      res.json({ ...data, backendStatus });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Serve Supabase SQL schema for quick setup
  app.get('/api/supabase/schema', (_req, res) => {
    const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
    if (fs.existsSync(schemaPath)) {
      res.type('text/plain').send(fs.readFileSync(schemaPath, 'utf8'));
    } else {
      res.status(404).send('Schema file not found');
    }
  });

  // Create new ticket with real Gemini AI classification
  app.post('/api/tickets', async (req, res) => {
    try {
      const {
        subject,
        description,
        referenceId,
        customerName,
        customerEmail,
        company,
        customerTier,
      } = req.body as {
        subject?: string;
        description?: string;
        referenceId?: string;
        customerName?: string;
        customerEmail?: string;
        company?: string;
        customerTier?: string;
      };

      if (!subject?.trim() || !description?.trim()) {
        return res.status(400).json({ error: 'Subject and description are required.' });
      }

      const aiResult = await classifyTicketWithAI({
        subject: subject.trim(),
        description: description.trim(),
        referenceId: referenceId?.trim(),
      });

      const ticket = await createTicketRecord({
        subject: subject.trim(),
        description: description.trim(),
        referenceId: referenceId?.trim() || undefined,
        customerName: customerName?.trim() || 'Priya (Customer)',
        customerEmail: customerEmail?.trim() || 'priya.customer@acmecorp.com',
        company: company?.trim() || 'Acme Corporation',
        customerTier: customerTier?.trim() || 'Enterprise Tier ($4,000/mo)',
        category: aiResult.category,
        priority: aiResult.priority,
        assigneeId: aiResult.recommendedAssigneeId,
        aiSummary: aiResult.executiveSummary,
        aiConfidence: aiResult.confidence,
        sentimentLabel: aiResult.sentimentLabel,
        sentimentScore: aiResult.sentimentScore,
        detectedIntent: aiResult.detectedIntent,
      });

      res.status(201).json({ ticket, aiResult });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  // Update ticket (assignee, status, priority, trackerStep)
  app.patch('/api/tickets/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, priority, assigneeId, trackerStep, slaMinutesRemaining, actor } = req.body;
      const updated = await updateTicketRecord(
        id,
        { status, priority, assigneeId, trackerStep, slaMinutesRemaining },
        actor || 'Workspace Operator'
      );
      if (!updated) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }
      res.json({ ticket: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Add message / reply / remediation event to ticket
  app.post('/api/tickets/:id/messages', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        senderName,
        senderRole,
        senderAvatar,
        isInternal,
        isSystemEvent,
        body,
        newStatus,
        newTrackerStep,
      } = req.body as {
        senderName: string;
        senderRole: 'customer' | 'support' | 'system';
        senderAvatar?: string;
        isInternal?: boolean;
        isSystemEvent?: boolean;
        body: string;
        newStatus?: TicketStatus;
        newTrackerStep?: number;
      };

      if (!body?.trim()) {
        return res.status(400).json({ error: 'Message body is required.' });
      }

      const ticket = await addTicketMessageRecord({
        ticketId: id,
        senderName: senderName || 'Rahul Sharma',
        senderRole: senderRole || 'support',
        senderAvatar,
        isInternal,
        isSystemEvent,
        body: body.trim(),
        newStatus,
        newTrackerStep,
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }
      res.json({ ticket });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Auto-Assign unassigned tickets
  app.post('/api/tickets/auto-assign', async (_req, res) => {
    try {
      const result = await autoAssignUnassignedTickets();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Rebalance staff workload
  app.post('/api/tickets/rebalance', async (_req, res) => {
    try {
      const tickets = await rebalanceStaffQueue();
      res.json({ tickets });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Export CSV
  app.get('/api/tickets/export.csv', async (_req, res) => {
    try {
      const data = await listAllData();
      const header = [
        'Ticket ID',
        'Customer',
        'Company',
        'Subject',
        'Category',
        'Priority',
        'Status',
        'Assignee',
        'Created At',
      ];
      const staffMap = new Map(data.staff.map((s) => [s.id, s.name]));
      const rows = data.tickets.map((t) => [
        t.ticketNumber,
        t.customerName,
        t.company,
        `"${t.subject.replace(/"/g, '""')}"`,
        t.category,
        t.priority,
        t.status,
        t.assigneeId ? staffMap.get(t.assigneeId) || t.assigneeId : 'Unassigned',
        t.createdAt,
      ]);
      const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="bizassist-tickets.csv"');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // AI Draft Reply
  app.post('/api/ai/draft-reply', async (req, res) => {
    try {
      const { ticketId, tone, actionType } = req.body as {
        ticketId: string;
        tone?: string;
        actionType?: 'draft' | 'kb_snippet' | 'diagnostics';
      };
      const data = await listAllData();
      const ticket = data.tickets.find((t) => t.id === ticketId);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }
      const draft = await draftSupportReplyWithAI({
        ticket,
        tone,
        actionType,
        kbArticles: data.kbArticles,
      });
      res.json({ draft });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // AI Staff Copilot
  app.post('/api/ai/copilot', async (req, res) => {
    try {
      const { ticketId, prompt } = req.body as { ticketId?: string; prompt: string };
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'Prompt is required.' });
      }
      const data = await listAllData();
      const ticket = ticketId ? data.tickets.find((t) => t.id === ticketId) ?? null : null;
      const result = await staffCopilotWithAI({ ticket, prompt: prompt.trim() });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // AI KB Synthesizer
  app.post('/api/ai/kb-synthesize', async (req, res) => {
    try {
      const { query } = req.body as { query: string };
      if (!query?.trim()) {
        return res.status(400).json({ error: 'Query is required.' });
      }
      const data = await listAllData();
      const result = await synthesizeKbAnswerWithAI({
        query: query.trim(),
        articles: data.kbArticles,
        faqs: data.faqs,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // AI Customer Portal Assistant Chat
  app.post('/api/ai/customer-chat', async (req, res) => {
    try {
      const { message, activeTicketId } = req.body as {
        message: string;
        activeTicketId?: string;
      };
      if (!message?.trim()) {
        return res.status(400).json({ error: 'Message is required.' });
      }
      const data = await listAllData();
      const activeTicket = activeTicketId
        ? data.tickets.find((t) => t.id === activeTicketId) ?? null
        : data.tickets.find((t) => t.status === 'In Progress' || t.status === 'Open') ?? null;

      const result = await customerPortalChatWithAI({
        message: message.trim(),
        activeTicket,
        articles: data.kbArticles,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BizAssist AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
