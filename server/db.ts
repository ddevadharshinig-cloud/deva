import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AuditLog,
  BackendStatus,
  FaqItem,
  KbArticle,
  StaffMember,
  Ticket,
  TicketCategory,
  TicketMessage,
  TicketPriority,
  TicketStatus,
} from '../src/types/bizassist.ts';
import {
  AVATAR_MARCUS,
  SEED_AUDIT_LOGS,
  SEED_FAQS,
  SEED_KB_ARTICLES,
  SEED_STAFF,
  SEED_TICKETS,
} from './seedData.ts';

interface LocalStore {
  staff: StaffMember[];
  tickets: Ticket[];
  kbArticles: KbArticle[];
  faqs: FaqItem[];
  auditLogs: AuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_DB_PATH = path.join(DATA_DIR, 'db.json');

let supabaseClient: SupabaseClient | null = null;
let supabaseInitTried = false;
let supabaseOperational = false;
let lastSupabaseError: string | undefined;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  )?.trim();
  return { url, key };
}

async function getSupabase(): Promise<SupabaseClient | null> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key || url === 'MY_SUPABASE_URL' || key === 'MY_SUPABASE_SERVICE_ROLE_KEY') {
    supabaseOperational = false;
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  if (!supabaseInitTried) {
    supabaseInitTried = true;
    try {
      const { error } = await supabaseClient.from('staff_members').select('id').limit(1);
      if (error) {
        supabaseOperational = false;
        lastSupabaseError = error.message;
        console.warn('[Supabase] Table check failed, using local persistence fallback:', error.message);
      } else {
        supabaseOperational = true;
        lastSupabaseError = undefined;
        await seedSupabaseIfEmpty(supabaseClient);
      }
    } catch (err) {
      supabaseOperational = false;
      lastSupabaseError = err instanceof Error ? err.message : String(err);
    }
  }

  return supabaseOperational ? supabaseClient : null;
}

async function seedSupabaseIfEmpty(client: SupabaseClient) {
  const { count } = await client
    .from('tickets')
    .select('id', { count: 'exact', head: true });

  if ((count ?? 0) > 0) return;

  await client.from('staff_members').upsert(
    SEED_STAFF.map((s) => ({
      id: s.id,
      name: s.name,
      initials: s.initials,
      role_title: s.roleTitle,
      email: s.email,
      avatar_url: s.avatarUrl,
      online: s.online,
      active_capacity: s.activeCapacity,
      resolution_rate: s.resolutionRate,
      csat_score: s.csatScore,
      fcr_rate: s.fcrRate,
      rank_position: s.rankPosition,
    }))
  );

  for (const t of SEED_TICKETS) {
    await client.from('tickets').upsert({
      id: t.id,
      ticket_number: t.ticketNumber,
      subject: t.subject,
      description: t.description,
      reference_id: t.referenceId ?? null,
      customer_name: t.customerName,
      customer_email: t.customerEmail,
      company: t.company,
      customer_tier: t.customerTier,
      category: t.category,
      priority: t.priority,
      status: t.status,
      assignee_id: t.assigneeId,
      ai_summary: t.aiSummary,
      ai_confidence: t.aiConfidence,
      sentiment_label: t.sentimentLabel,
      sentiment_score: t.sentimentScore,
      detected_intent: t.detectedIntent,
      sla_minutes_remaining: t.slaMinutesRemaining,
      tracker_step: t.trackerStep,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    });

    if (t.messages.length > 0) {
      await client.from('ticket_messages').insert(
        t.messages.map((m) => ({
          ticket_id: t.id,
          sender_name: m.senderName,
          sender_role: m.senderRole,
          sender_avatar: m.senderAvatar ?? null,
          is_internal: m.isInternal ?? false,
          is_system_event: m.isSystemEvent ?? false,
          body: m.body,
          payload_snippet: m.payloadSnippet ?? null,
          created_at: m.createdAt,
        }))
      );
    }
  }

  await client.from('kb_articles').upsert(
    SEED_KB_ARTICLES.map((a) => ({
      doc_code: a.docCode,
      title: a.title,
      category: a.category,
      priority_tag: a.priorityTag,
      summary: a.summary,
      content: a.content,
      updated_label: a.updatedLabel,
    })),
    { onConflict: 'doc_code' }
  );

  await client.from('faqs').insert(
    SEED_FAQS.map((f) => ({
      question: f.question,
      answer: f.answer,
      confidence: f.confidence,
      verified_by: f.verifiedBy,
      runbook_ref: f.runbookRef ?? null,
    }))
  );

  await client.from('audit_logs').insert(
    SEED_AUDIT_LOGS.map((l) => ({
      ticket_number: l.ticketNumber ?? null,
      actor: l.actor,
      action: l.action,
      details: l.details,
      created_at: l.createdAt,
    }))
  );
}

function readLocalStore(): LocalStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const initial: LocalStore = {
      staff: SEED_STAFF,
      tickets: SEED_TICKETS,
      kbArticles: SEED_KB_ARTICLES,
      faqs: SEED_FAQS,
      auditLogs: SEED_AUDIT_LOGS,
    };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8')) as LocalStore;
}

function writeLocalStore(store: LocalStore) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function mapSupabaseTicket(row: Record<string, unknown>, messages: TicketMessage[]): Ticket {
  return {
    id: String(row.id),
    ticketNumber: String(row.ticket_number),
    subject: String(row.subject),
    description: String(row.description),
    referenceId: row.reference_id ? String(row.reference_id) : undefined,
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    company: String(row.company),
    customerTier: String(row.customer_tier),
    category: row.category as TicketCategory,
    priority: row.priority as TicketPriority,
    status: row.status as TicketStatus,
    assigneeId: row.assignee_id ? String(row.assignee_id) : null,
    aiSummary: Array.isArray(row.ai_summary) ? (row.ai_summary as string[]) : [],
    aiConfidence: Number(row.ai_confidence ?? 98),
    sentimentLabel: String(row.sentiment_label ?? 'Neutral'),
    sentimentScore: Number(row.sentiment_score ?? 0),
    detectedIntent: String(row.detected_intent ?? 'Support Request'),
    slaMinutesRemaining: Number(row.sla_minutes_remaining ?? 120),
    trackerStep: Number(row.tracker_step ?? 2),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    messages,
  };
}

export async function getBackendStatus(): Promise<BackendStatus> {
  const { url, key } = getSupabaseConfig();
  const configured = Boolean(
    url && key && url !== 'MY_SUPABASE_URL' && key !== 'MY_SUPABASE_SERVICE_ROLE_KEY'
  );
  const client = await getSupabase();
  return {
    database: client ? 'supabase' : 'local',
    supabaseConfigured: configured,
    supabaseConnected: Boolean(client),
    supabaseError: lastSupabaseError,
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    ),
  };
}

export async function listAllData() {
  const client = await getSupabase();
  if (client) {
    const [staffRes, ticketsRes, msgsRes, kbRes, faqsRes, auditRes] = await Promise.all([
      client.from('staff_members').select('*').order('rank_position', { ascending: true }),
      client.from('tickets').select('*').order('created_at', { ascending: false }),
      client.from('ticket_messages').select('*').order('created_at', { ascending: true }),
      client.from('kb_articles').select('*'),
      client.from('faqs').select('*'),
      client.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(25),
    ]);

    const msgsByTicket = new Map<string, TicketMessage[]>();
    for (const m of msgsRes.data ?? []) {
      const tid = String(m.ticket_id);
      const list = msgsByTicket.get(tid) ?? [];
      list.push({
        id: String(m.id),
        ticketId: tid,
        senderName: String(m.sender_name),
        senderRole: m.sender_role as TicketMessage['senderRole'],
        senderAvatar: m.sender_avatar ? String(m.sender_avatar) : undefined,
        isInternal: Boolean(m.is_internal),
        isSystemEvent: Boolean(m.is_system_event),
        body: String(m.body),
        payloadSnippet: m.payload_snippet ? String(m.payload_snippet) : undefined,
        createdAt: String(m.created_at),
      });
      msgsByTicket.set(tid, list);
    }

    return {
      staff: (staffRes.data ?? []).map((s) => ({
        id: String(s.id),
        name: String(s.name),
        initials: String(s.initials),
        roleTitle: String(s.role_title),
        email: String(s.email),
        avatarUrl: String(s.avatar_url ?? ''),
        online: Boolean(s.online),
        activeCapacity: Number(s.active_capacity ?? 8),
        resolutionRate: Number(s.resolution_rate ?? 92),
        csatScore: Number(s.csat_score ?? 4.9),
        fcrRate: Number(s.fcr_rate ?? 88),
        rankPosition: Number(s.rank_position ?? 1),
      })),
      tickets: (ticketsRes.data ?? []).map((t) =>
        mapSupabaseTicket(t, msgsByTicket.get(String(t.id)) ?? [])
      ),
      kbArticles: (kbRes.data ?? []).map((a) => ({
        id: String(a.id),
        docCode: String(a.doc_code),
        title: String(a.title),
        category: String(a.category),
        priorityTag: String(a.priority_tag),
        summary: String(a.summary),
        content: String(a.content),
        updatedLabel: String(a.updated_label),
      })),
      faqs: (faqsRes.data ?? []).map((f) => ({
        id: String(f.id),
        question: String(f.question),
        answer: String(f.answer),
        confidence: Number(f.confidence ?? 98.5),
        verifiedBy: String(f.verified_by ?? 'Enterprise Ops'),
        runbookRef: f.runbook_ref ? String(f.runbook_ref) : undefined,
      })),
      auditLogs: (auditRes.data ?? []).map((l) => ({
        id: String(l.id),
        ticketNumber: l.ticket_number ? String(l.ticket_number) : undefined,
        actor: String(l.actor),
        action: String(l.action),
        details: String(l.details),
        createdAt: String(l.created_at),
      })),
    };
  }

  return readLocalStore();
}

export async function createTicketRecord(input: {
  subject: string;
  description: string;
  referenceId?: string;
  customerName: string;
  customerEmail: string;
  company: string;
  customerTier: string;
  category: TicketCategory;
  priority: TicketPriority;
  assigneeId: string | null;
  aiSummary: string[];
  aiConfidence: number;
  sentimentLabel: string;
  sentimentScore: number;
  detectedIntent: string;
}): Promise<Ticket> {
  const nowIso = new Date().toISOString();
  const id = crypto.randomUUID();
  const num = Math.floor(8943 + Math.random() * 900);
  const ticketNumber = `#TK-${num}`;
  const slaMinutes =
    input.priority === 'Critical'
      ? 25
      : input.priority === 'High'
        ? 90
        : input.priority === 'Medium'
          ? 240
          : 480;

  const initialMessages: TicketMessage[] = [
    {
      id: crypto.randomUUID(),
      ticketId: id,
      senderName: input.customerName,
      senderRole: 'customer',
      senderAvatar: AVATAR_MARCUS,
      body: input.description,
      payloadSnippet: input.referenceId ? `Reference ID: ${input.referenceId}` : undefined,
      createdAt: nowIso,
    },
    {
      id: crypto.randomUUID(),
      ticketId: id,
      senderName: 'AI Engine',
      senderRole: 'system',
      isSystemEvent: true,
      body: `Classified as ${input.category} • Priority set to ${input.priority} (${input.aiConfidence.toFixed(1)}% confidence).`,
      createdAt: nowIso,
    },
  ];

  const ticket: Ticket = {
    id,
    ticketNumber,
    subject: input.subject,
    description: input.description,
    referenceId: input.referenceId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    company: input.company,
    customerTier: input.customerTier,
    category: input.category,
    priority: input.priority,
    status: input.assigneeId ? 'In Progress' : 'Open',
    assigneeId: input.assigneeId,
    aiSummary: input.aiSummary,
    aiConfidence: input.aiConfidence,
    sentimentLabel: input.sentimentLabel,
    sentimentScore: input.sentimentScore,
    detectedIntent: input.detectedIntent,
    slaMinutesRemaining: slaMinutes,
    trackerStep: input.assigneeId ? 3 : 2,
    createdAt: nowIso,
    updatedAt: nowIso,
    messages: initialMessages,
  };

  const client = await getSupabase();
  if (client) {
    await client.from('tickets').insert({
      id: ticket.id,
      ticket_number: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      reference_id: ticket.referenceId ?? null,
      customer_name: ticket.customerName,
      customer_email: ticket.customerEmail,
      company: ticket.company,
      customer_tier: ticket.customerTier,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignee_id: ticket.assigneeId,
      ai_summary: ticket.aiSummary,
      ai_confidence: ticket.aiConfidence,
      sentiment_label: ticket.sentimentLabel,
      sentiment_score: ticket.sentimentScore,
      detected_intent: ticket.detectedIntent,
      sla_minutes_remaining: ticket.slaMinutesRemaining,
      tracker_step: ticket.trackerStep,
      created_at: ticket.createdAt,
      updated_at: ticket.updatedAt,
    });
    await client.from('ticket_messages').insert(
      initialMessages.map((m) => ({
        id: m.id,
        ticket_id: ticket.id,
        sender_name: m.senderName,
        sender_role: m.senderRole,
        sender_avatar: m.senderAvatar ?? null,
        is_internal: false,
        is_system_event: m.isSystemEvent ?? false,
        body: m.body,
        payload_snippet: m.payloadSnippet ?? null,
        created_at: m.createdAt,
      }))
    );
    await client.from('audit_logs').insert({
      ticket_number: ticket.ticketNumber,
      actor: 'AI Triage Engine',
      action: 'CREATE_AND_CLASSIFY',
      details: `${ticket.category} / ${ticket.priority} assigned to ${ticket.assigneeId ?? 'Unassigned queue'}`,
    });
    return ticket;
  }

  const store = readLocalStore();
  store.tickets.unshift(ticket);
  store.auditLogs.unshift({
    id: crypto.randomUUID(),
    ticketNumber: ticket.ticketNumber,
    actor: 'AI Triage Engine',
    action: 'CREATE_AND_CLASSIFY',
    details: `${ticket.category} / ${ticket.priority} assigned to ${ticket.assigneeId ?? 'Unassigned queue'}`,
    createdAt: nowIso,
  });
  writeLocalStore(store);
  return ticket;
}

export async function updateTicketRecord(
  ticketId: string,
  patch: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId' | 'trackerStep' | 'slaMinutesRemaining'>>,
  actor = 'Arun (Administrator)'
): Promise<Ticket | null> {
  const nowIso = new Date().toISOString();
  const client = await getSupabase();

  if (client) {
    const dbPatch: Record<string, unknown> = { updated_at: nowIso };
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.priority !== undefined) dbPatch.priority = patch.priority;
    if (patch.assigneeId !== undefined) dbPatch.assignee_id = patch.assigneeId;
    if (patch.trackerStep !== undefined) dbPatch.tracker_step = patch.trackerStep;
    if (patch.slaMinutesRemaining !== undefined)
      dbPatch.sla_minutes_remaining = patch.slaMinutesRemaining;

    const { data } = await client
      .from('tickets')
      .update(dbPatch)
      .eq('id', ticketId)
      .select('*')
      .single();

    if (!data) return null;

    await client.from('audit_logs').insert({
      ticket_number: String(data.ticket_number),
      actor,
      action: 'UPDATE_TICKET',
      details: `Updated fields: ${Object.keys(patch).join(', ')}`,
    });

    const { data: msgs } = await client
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    return mapSupabaseTicket(
      data,
      (msgs ?? []).map((m) => ({
        id: String(m.id),
        ticketId,
        senderName: String(m.sender_name),
        senderRole: m.sender_role as TicketMessage['senderRole'],
        senderAvatar: m.sender_avatar ? String(m.sender_avatar) : undefined,
        isInternal: Boolean(m.is_internal),
        isSystemEvent: Boolean(m.is_system_event),
        body: String(m.body),
        payloadSnippet: m.payload_snippet ? String(m.payload_snippet) : undefined,
        createdAt: String(m.created_at),
      }))
    );
  }

  const store = readLocalStore();
  const idx = store.tickets.findIndex((t) => t.id === ticketId);
  if (idx === -1) return null;

  store.tickets[idx] = {
    ...store.tickets[idx],
    ...patch,
    updatedAt: nowIso,
  };
  store.auditLogs.unshift({
    id: crypto.randomUUID(),
    ticketNumber: store.tickets[idx].ticketNumber,
    actor,
    action: 'UPDATE_TICKET',
    details: `Updated fields: ${Object.keys(patch).join(', ')}`,
    createdAt: nowIso,
  });
  writeLocalStore(store);
  return store.tickets[idx];
}

export async function addTicketMessageRecord(input: {
  ticketId: string;
  senderName: string;
  senderRole: 'customer' | 'support' | 'system';
  senderAvatar?: string;
  isInternal?: boolean;
  isSystemEvent?: boolean;
  body: string;
  newStatus?: TicketStatus;
  newTrackerStep?: number;
}): Promise<Ticket | null> {
  const nowIso = new Date().toISOString();
  const msg: TicketMessage = {
    id: crypto.randomUUID(),
    ticketId: input.ticketId,
    senderName: input.senderName,
    senderRole: input.senderRole,
    senderAvatar: input.senderAvatar,
    isInternal: input.isInternal ?? false,
    isSystemEvent: input.isSystemEvent ?? false,
    body: input.body,
    createdAt: nowIso,
  };

  const client = await getSupabase();
  if (client) {
    await client.from('ticket_messages').insert({
      id: msg.id,
      ticket_id: msg.ticketId,
      sender_name: msg.senderName,
      sender_role: msg.senderRole,
      sender_avatar: msg.senderAvatar ?? null,
      is_internal: msg.isInternal ?? false,
      is_system_event: msg.isSystemEvent ?? false,
      body: msg.body,
      created_at: msg.createdAt,
    });

    const patch: Record<string, unknown> = { updated_at: nowIso };
    if (input.newStatus) patch.status = input.newStatus;
    if (input.newTrackerStep !== undefined) patch.tracker_step = input.newTrackerStep;
    if (input.newStatus === 'Resolved' || input.newStatus === 'Closed') {
      patch.sla_minutes_remaining = 0;
    }

    await client.from('tickets').update(patch).eq('id', input.ticketId);

    const { data: ticketRow } = await client
      .from('tickets')
      .select('*')
      .eq('id', input.ticketId)
      .single();
    if (!ticketRow) return null;

    const { data: msgs } = await client
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', input.ticketId)
      .order('created_at', { ascending: true });

    return mapSupabaseTicket(
      ticketRow,
      (msgs ?? []).map((m) => ({
        id: String(m.id),
        ticketId: input.ticketId,
        senderName: String(m.sender_name),
        senderRole: m.sender_role as TicketMessage['senderRole'],
        senderAvatar: m.sender_avatar ? String(m.sender_avatar) : undefined,
        isInternal: Boolean(m.is_internal),
        isSystemEvent: Boolean(m.is_system_event),
        body: String(m.body),
        payloadSnippet: m.payload_snippet ? String(m.payload_snippet) : undefined,
        createdAt: String(m.created_at),
      }))
    );
  }

  const store = readLocalStore();
  const idx = store.tickets.findIndex((t) => t.id === input.ticketId);
  if (idx === -1) return null;

  store.tickets[idx].messages.push(msg);
  store.tickets[idx].updatedAt = nowIso;
  if (input.newStatus) {
    store.tickets[idx].status = input.newStatus;
    if (input.newStatus === 'Resolved' || input.newStatus === 'Closed') {
      store.tickets[idx].slaMinutesRemaining = 0;
    }
  }
  if (input.newTrackerStep !== undefined) {
    store.tickets[idx].trackerStep = input.newTrackerStep;
  }
  writeLocalStore(store);
  return store.tickets[idx];
}

export async function autoAssignUnassignedTickets(): Promise<{
  assignedCount: number;
  tickets: Ticket[];
}> {
  const data = await listAllData();
  const unassigned = data.tickets.filter((t) => !t.assigneeId && t.status !== 'Resolved' && t.status !== 'Closed');
  if (unassigned.length === 0) {
    return { assignedCount: 0, tickets: data.tickets };
  }

  // Balance load across staff
  const loadMap = new Map<string, number>();
  for (const s of data.staff) loadMap.set(s.id, 0);
  for (const t of data.tickets) {
    if (t.assigneeId && t.status !== 'Resolved' && t.status !== 'Closed') {
      loadMap.set(t.assigneeId, (loadMap.get(t.assigneeId) ?? 0) + 1);
    }
  }

  for (const t of unassigned) {
    let bestId = data.staff[0]?.id ?? 'rahul';
    let minLoad = Infinity;
    for (const s of data.staff) {
      const load = loadMap.get(s.id) ?? 0;
      if (load < minLoad) {
        minLoad = load;
        bestId = s.id;
      }
    }
    loadMap.set(bestId, minLoad + 1);
    await updateTicketRecord(
      t.id,
      { assigneeId: bestId, status: 'In Progress', trackerStep: Math.max(t.trackerStep, 3) },
      'AI Auto-Dispatcher'
    );
  }

  const updated = await listAllData();
  return { assignedCount: unassigned.length, tickets: updated.tickets };
}

export async function rebalanceStaffQueue(): Promise<Ticket[]> {
  const data = await listAllData();
  const active = data.tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed');
  if (data.staff.length === 0) return data.tickets;

  for (let i = 0; i < active.length; i++) {
    const targetStaff = data.staff[i % data.staff.length];
    if (active[i].assigneeId !== targetStaff.id) {
      await updateTicketRecord(
        active[i].id,
        { assigneeId: targetStaff.id, status: 'In Progress', trackerStep: Math.max(active[i].trackerStep, 3) },
        'Smart Rebalance Queue'
      );
    }
  }

  const updated = await listAllData();
  return updated.tickets;
}
