import { GoogleGenAI, Type } from '@google/genai';
import type {
  FaqItem,
  KbArticle,
  Ticket,
  TicketCategory,
  TicketPriority,
} from '../src/types/bizassist.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function classifyTicketWithAI(input: {
  subject: string;
  description: string;
  referenceId?: string;
}): Promise<{
  category: TicketCategory;
  priority: TicketPriority;
  sentimentLabel: string;
  sentimentScore: number;
  detectedIntent: string;
  confidence: number;
  executiveSummary: string[];
  recommendedAssigneeId: string;
}> {
  const ai = getAiClient();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Analyze this enterprise customer support ticket and classify it accurately.
Subject: ${input.subject}
Reference ID: ${input.referenceId || 'None'}
Description: ${input.description}

Available Categories:
- Billing & Payments
- Technical Bug
- Account Access
- Shipping & Delivery
- General Inquiry

Available Priorities:
- Critical (outages, lockouts, payment failures blocking production/demos)
- High (SSO failures, security issues, severe regressions)
- Medium (non-blocking bugs, billing discrepancies)
- Low (seat expansions, general questions)

Available Staff Assignees:
- rahul (Billing, Stripe webhooks, API & Tier 2 Technical Lead)
- aisha (Escalations, Rate limits, Infrastructure & Integrations)
- priya_staff (Customer Operations, Shipping & General Inquiries)`,
    config: {
      systemInstruction:
        'You are the BizAssist AI Ticket Classification Engine. Return strictly structured JSON matching the schema.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          priority: { type: Type.STRING },
          sentimentLabel: { type: Type.STRING },
          sentimentScore: { type: Type.NUMBER },
          detectedIntent: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          executiveSummary: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          recommendedAssigneeId: { type: Type.STRING },
        },
        required: [
          'category',
          'priority',
          'sentimentLabel',
          'sentimentScore',
          'detectedIntent',
          'confidence',
          'executiveSummary',
          'recommendedAssigneeId',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    category?: string;
    priority?: string;
    sentimentLabel?: string;
    sentimentScore?: number;
    detectedIntent?: string;
    confidence?: number;
    executiveSummary?: string[];
    recommendedAssigneeId?: string;
  };

  const validCategories: TicketCategory[] = [
    'Billing & Payments',
    'Technical Bug',
    'Account Access',
    'Shipping & Delivery',
    'General Inquiry',
  ];
  const validPriorities: TicketPriority[] = ['Critical', 'High', 'Medium', 'Low'];
  const validAssignees = ['rahul', 'aisha', 'priya_staff'];

  const category = validCategories.includes(parsed.category as TicketCategory)
    ? (parsed.category as TicketCategory)
    : 'General Inquiry';
  const priority = validPriorities.includes(parsed.priority as TicketPriority)
    ? (parsed.priority as TicketPriority)
    : 'Medium';
  const recommendedAssigneeId = validAssignees.includes(parsed.recommendedAssigneeId ?? '')
    ? String(parsed.recommendedAssigneeId)
    : 'rahul';

  return {
    category,
    priority,
    sentimentLabel: parsed.sentimentLabel || 'Neutral',
    sentimentScore: Number(parsed.sentimentScore ?? 0),
    detectedIntent: parsed.detectedIntent || 'Support Request',
    confidence: Math.min(99.9, Math.max(70, Number(parsed.confidence ?? 96.5))),
    executiveSummary:
      Array.isArray(parsed.executiveSummary) && parsed.executiveSummary.length > 0
        ? parsed.executiveSummary.slice(0, 3)
        : [
            `Customer submitted "${input.subject}" in ${category}.`,
            `Assigned priority ${priority} based on operational impact.`,
            `Recommended immediate triage by ${recommendedAssigneeId}.`,
          ],
    recommendedAssigneeId,
  };
}

export async function draftSupportReplyWithAI(input: {
  ticket: Ticket;
  tone?: string;
  actionType?: 'draft' | 'kb_snippet' | 'diagnostics';
  kbArticles: KbArticle[];
}): Promise<string> {
  const ai = getAiClient();
  const threadText = input.ticket.messages
    .map((m) => `${m.senderName} (${m.senderRole}): ${m.body}`)
    .join('\n');

  const kbContext = input.kbArticles
    .map((a) => `${a.docCode} - ${a.title}: ${a.content}`)
    .join('\n');

  let directive = `Draft a clear, empathetic, action-oriented response from Support Staff Rahul Sharma to ${input.ticket.customerName} (${input.ticket.company}).`;
  if (input.actionType === 'kb_snippet') {
    directive = `Insert a concise, step-by-step verified Knowledge Base snippet citing the relevant #KB article code from the context below for ${input.ticket.customerName}.`;
  } else if (input.actionType === 'diagnostics') {
    directive = `Draft a concise diagnostic request asking ${input.ticket.customerName} for the exact HTTP headers, timestamp, or HAR trace needed to finish resolving this ticket.`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `${directive}
Tone: ${input.tone || 'Executive & Empathetic'}

Ticket ${input.ticket.ticketNumber}: ${input.ticket.subject}
Category: ${input.ticket.category} | Priority: ${input.ticket.priority}
Customer Tier: ${input.ticket.customerTier}
Thread:
${threadText || input.ticket.description}

Knowledge Base Reference:
${kbContext}

Return ONLY the ready-to-send email/reply body without markdown headers.`,
  });

  return (response.text ?? '').trim();
}

export async function staffCopilotWithAI(input: {
  ticket: Ticket | null;
  prompt: string;
}): Promise<{ insight: string; recommendation: string }> {
  const ai = getAiClient();

  const ticketContext = input.ticket
    ? `Active Ticket: ${input.ticket.ticketNumber}
Subject: ${input.ticket.subject}
Category: ${input.ticket.category} | Priority: ${input.ticket.priority} | SLA Remaining: ${input.ticket.slaMinutesRemaining}m
Description: ${input.ticket.description}
AI Summary: ${input.ticket.aiSummary.join(' ')}`
    : 'No active ticket selected.';

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Support Staff Question/Command: ${input.prompt}

${ticketContext}`,
    config: {
      systemInstruction:
        'You are BizAssist Staff Copilot. Provide crisp technical triage insights and a concrete next remediation step in JSON.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          insight: { type: Type.STRING },
          recommendation: { type: Type.STRING },
        },
        required: ['insight', 'recommendation'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    insight?: string;
    recommendation?: string;
  };
  return {
    insight: parsed.insight || 'Analyzed current ticket telemetry and SLA thresholds.',
    recommendation: parsed.recommendation || 'Verify webhook listener state and update customer.',
  };
}

export async function synthesizeKbAnswerWithAI(input: {
  query: string;
  articles: KbArticle[];
  faqs: FaqItem[];
}): Promise<{ citationCode: string; answer: string }> {
  const ai = getAiClient();

  const kbText = input.articles
    .map((a) => `${a.docCode} (${a.title}): ${a.content}`)
    .join('\n\n');
  const faqText = input.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `User Query: ${input.query}

Knowledge Base Articles:
${kbText}

FAQs:
${faqText}`,
    config: {
      systemInstruction:
        'You are the BizAssist AI Knowledge Synthesizer. Answer the query concisely in 2-3 sentences based on the verified docs, and return the matching Doc Code (e.g. #KB-301) in JSON.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          citationCode: { type: Type.STRING },
          answer: { type: Type.STRING },
        },
        required: ['citationCode', 'answer'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    citationCode?: string;
    answer?: string;
  };
  return {
    citationCode: parsed.citationCode || '#KB-301',
    answer:
      parsed.answer ||
      'Review our verified documentation playbooks or submit a ticket to reach an enterprise specialist.',
  };
}

export async function customerPortalChatWithAI(input: {
  message: string;
  activeTicket: Ticket | null;
  articles: KbArticle[];
}): Promise<{ reply: string; source: string }> {
  const ai = getAiClient();

  const kbText = input.articles
    .map((a) => `${a.docCode} - ${a.title}: ${a.content}`)
    .join('\n');

  const ticketInfo = input.activeTicket
    ? `Customer's Active Ticket: ${input.activeTicket.ticketNumber} (${input.activeTicket.subject}) — Status: ${input.activeTicket.status}, Step ${input.activeTicket.trackerStep}/5, Est. SLA: ${input.activeTicket.slaMinutesRemaining}m.`
    : 'No active ticket in progress.';

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Customer Question: ${input.message}

${ticketInfo}

Knowledge Base:
${kbText}`,
    config: {
      systemInstruction:
        'You are BizAssist AI Assistant in the Enterprise Customer Portal. Give accurate, helpful, concise answers grounded in the Knowledge Base or the customer active ticket. Return JSON with reply and source.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          source: { type: Type.STRING },
        },
        required: ['reply', 'source'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    reply?: string;
    source?: string;
  };
  return {
    reply:
      parsed.reply ||
      'I can help troubleshoot your setup or escalate directly to Rahul Sharma via "Convert to Support Ticket".',
    source: parsed.source || 'BizAssist Knowledge Base',
  };
}
