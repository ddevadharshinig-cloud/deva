export type UserRole = 'admin' | 'support' | 'customer';

export type ViewPath =
  | 'auth'
  | 'admin-dashboard'
  | 'support-staff-workspace'
  | 'customer-portal'
  | 'knowledge-base-and-faqs';

export type TicketCategory =
  | 'Billing & Payments'
  | 'Technical Bug'
  | 'Account Access'
  | 'Shipping & Delivery'
  | 'General Inquiry';

export type TicketPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type TicketStatus = 'Open' | 'In Progress' | 'Awaiting Reply' | 'Resolved' | 'Closed';

export interface RolePersona {
  role: UserRole;
  name: string;
  fullName: string;
  title: string;
  email: string;
  company: string;
  avatarUrl: string;
  defaultView: ViewPath;
}

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  roleTitle: string;
  email: string;
  avatarUrl: string;
  online: boolean;
  activeCapacity: number;
  resolutionRate: number;
  csatScore: number;
  fcrRate: number;
  rankPosition: number;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderName: string;
  senderRole: 'customer' | 'support' | 'system';
  senderAvatar?: string;
  isInternal?: boolean;
  isSystemEvent?: boolean;
  body: string;
  payloadSnippet?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  referenceId?: string;
  customerName: string;
  customerEmail: string;
  company: string;
  customerTier: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string | null;
  aiSummary: string[];
  aiConfidence: number;
  sentimentLabel: string;
  sentimentScore: number;
  detectedIntent: string;
  slaMinutesRemaining: number;
  trackerStep: number;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface KbArticle {
  id: string;
  docCode: string;
  title: string;
  category: string;
  priorityTag: string;
  summary: string;
  content: string;
  updatedLabel: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  verifiedBy: string;
  runbookRef?: string;
}

export interface AuditLog {
  id: string;
  ticketNumber?: string;
  actor: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface BackendStatus {
  database: 'supabase' | 'local';
  supabaseConfigured: boolean;
  supabaseConnected: boolean;
  supabaseError?: string;
  geminiConfigured: boolean;
}
