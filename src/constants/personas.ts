import type { RolePersona, UserRole } from '../types/bizassist';

export const BIZASSIST_LOGO_URL =
  'https://lh3.googleusercontent.com/aida/ALJJyrAK2EIpv2RHherGdAA2csFsWCF0l3eBbV3ZanqRa4kZhxu9JaHQKAYSMPiEOvgY_6fWCx0ax0vPi7w-PtdRIy2ykUhIYGqLabUTvLct6rwYYeVrym8Yy4tmIclYfa9enelot49RvFk8g_qzwb4p7S6-iW6K1P3kafxQ9YYwlDVIRHI6nE_XFzG07syWsANcgsUk1PrrpeqoMZE3fPrIy81SNZpo2B5ctN29ct7blNNj';

export const AVATAR_RAHUL_HEADER =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDS02YAEfquntNDoHMg2V35beA89GeVXjyfRBx4JUCltxdfKFLp-x5V-0MHWgGmDje64cKb1HcQ1ODItwrPE58kSA9OJvzcB2t1caJFE08p-a0ETBtca7j5f3PwJcAQ4SGmhcPw-S8hT_gtaOgz_Jta4YggotkHhang2I-bR0iqmrPf-uahn3Xrdj1LEUGYvfqjdDyxb7sNfW3esN9r-vB7-x6sUEPoU_mLetV4f2I';

export const AVATAR_MARCUS =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBA2jNgOx_fb2bgNgMJkUvn1RZLeXrcYOSrmytbileFYcthomvpXcW4sBtJsickUPHSTJ_ts-26sUCFIDeRd31NnyhFOoIyZv4KtiopjFG32cdb4GLBj19kSr1h_TxZiR0jTt87HBVv8qWFQdn9X1Gs9CeySf8qULrOTRQoEK3U4fbAr71Uo5B-267yQ-8241QozkQf0-QU-McUA6NC4JgCivGcULCP0xN7Z1Foaxk';

export const AVATAR_RAHUL_PORTAL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAp8vMK2Hs7BLXvXA16NjKrcjsbF8r8_shkYVYQlAmLPv-l_01eT4iNgVj03GUycdSLKfmoU3xfu3Y_ia6w2LdsbEmrlyb6Igokp70g3CJ9p1PQWKi05o9IVpGC0CApcYYXh9Ha8GYNvum6BXmmATOhI1flxc7HqtA42ilg3aQ4iRDE2bNJGayQ2udAglksIR2pj82UVCD-m3Vq1uR-NNMrM_mcFDkTMncRggpq-3E';

export const ROLE_PERSONAS: Record<UserRole, RolePersona> = {
  admin: {
    role: 'admin',
    name: 'Arun',
    fullName: 'Arun (Administrator)',
    title: 'VP Customer Success',
    email: 'arun.admin@bizassist.ai',
    company: 'BizAssist Enterprise Ops',
    avatarUrl: AVATAR_RAHUL_HEADER,
    defaultView: 'admin-dashboard',
  },
  support: {
    role: 'support',
    name: 'Rahul',
    fullName: 'Rahul (Support Staff)',
    title: 'Tier 2 Technical Lead',
    email: 'rahul.triage@bizassist.ai',
    company: 'BizAssist Support Pod',
    avatarUrl: AVATAR_RAHUL_HEADER,
    defaultView: 'support-staff-workspace',
  },
  customer: {
    role: 'customer',
    name: 'Priya',
    fullName: 'Priya (Customer)',
    title: 'Verified Customer',
    email: 'priya.customer@acmecorp.com',
    company: 'Acme Corp Ltd',
    avatarUrl: AVATAR_MARCUS,
    defaultView: 'customer-portal',
  },
};

export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
