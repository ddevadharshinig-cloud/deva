import { useState } from 'react';
import { BIZASSIST_LOGO_URL } from '../constants/personas';
import type { UserRole, ViewPath } from '../types/bizassist';

interface AuthScreenProps {
  onSelectRole: (role: UserRole, targetView?: ViewPath) => void;
}

export function AuthScreen({ onSelectRole }: AuthScreenProps) {
  const [email, setEmail] = useState('arun.admin@bizassist.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [remember, setRemember] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

  function triggerLaunch(role: UserRole, label: string, nextEmail: string) {
    setEmail(nextEmail);
    setFeedback(`Authenticating live session credentials for ${label}...`);
    setTimeout(() => {
      onSelectRole(role);
    }, 350);
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lower = email.toLowerCase();
    if (lower.includes('rahul') || lower.includes('triage') || lower.includes('support')) {
      triggerLaunch('support', 'Rahul (Support Staff)', email);
    } else if (lower.includes('priya') || lower.includes('marcus') || lower.includes('acme')) {
      triggerLaunch('customer', 'Priya (Customer)', email);
    } else {
      triggerLaunch('admin', 'Arun (Administrator)', email);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center p-4 sm:p-6">
      <div className="flex flex-col w-full max-w-6xl mx-auto py-6 relative">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-3/4 h-72 bg-gradient-to-b from-primary-fixed/40 via-surface-container-low/20 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />

        {/* Top Brand & Header Section */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative flex items-center justify-center p-2 bg-surface-container-lowest rounded-xl shadow-sm mb-3">
            {!logoFailed ? (
              <img
                src={BIZASSIST_LOGO_URL}
                alt="BizAssist AI Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="w-12 h-12 object-contain"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold text-lg">
                BA
              </div>
            )}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-container-high rounded-full mb-2">
            <span className="material-symbols-outlined text-[14px] text-primary">bolt</span>
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              Enterprise Intelligence Engine
            </span>
          </div>
          <h1 className="text-[24px] font-semibold text-on-surface tracking-tight">
            Sign in to BizAssist AI
          </h1>
          <p className="text-[13px] text-on-surface-variant max-w-md mt-1">
            Enterprise AI-Powered Customer Support &amp; Autonomous Resolution Engine
          </p>
        </div>

        {/* Main Asymmetric Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Standard Enterprise Authentication */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl shadow-md p-6 flex flex-col relative">
            <div className="flex items-center justify-between pb-3 mb-4">
              <div>
                <h2 className="text-[16px] font-semibold text-on-surface">Workspace Access</h2>
                <p className="text-[12px] text-on-surface-variant">
                  Sign in with authorized corporate credentials
                </p>
              </div>
              <span className="material-symbols-outlined text-outline text-xl">encrypted</span>
            </div>

            <div className="flex flex-col gap-2 mb-5">
              <button
                type="button"
                onClick={() => triggerLaunch('admin', 'Google Workspace SSO (Arun)', 'arun.admin@bizassist.ai')}
                className="w-full flex items-center justify-center gap-3 h-9 px-4 bg-surface-container-low hover:bg-surface-container text-on-surface text-[12px] font-medium rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.33 24 12 24z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continue with Google Workspace</span>
              </button>

              <button
                type="button"
                onClick={() => triggerLaunch('support', 'Okta / SAML SSO (Rahul)', 'rahul.triage@bizassist.ai')}
                className="w-full flex items-center justify-center gap-3 h-9 px-4 bg-surface-container-low hover:bg-surface-container text-on-surface text-[12px] font-medium rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-tertiary">key</span>
                <span>Sign in with Okta / SAML SSO</span>
              </button>
            </div>

            <div className="relative flex items-center justify-center mb-5">
              <div className="w-full h-px bg-surface-variant" />
              <span className="absolute px-2 bg-surface-container-lowest text-[11px] font-semibold text-outline uppercase tracking-wider">
                or email access
              </span>
            </div>

            <form className="flex flex-col gap-3" onSubmit={handleFormSubmit}>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="work-email">
                  Work Email Address
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                    mail
                  </span>
                  <input
                    id="work-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-9 pl-10 pr-3 bg-surface-container-low text-on-surface text-[13px] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setFeedback('Password reset link instructions sent to your corporate email.')}
                    className="text-[11px] font-semibold text-primary hover:text-primary-container cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                    lock
                  </span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full h-9 pl-10 pr-3 bg-surface-container-low text-on-surface text-[13px] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                  <span className="text-[12px] text-on-surface-variant">Remember for 30 days</span>
                </label>
                <span className="font-mono text-[11px] text-tertiary bg-tertiary-fixed/40 px-2 py-0.5 rounded">
                  Enterprise SSO
                </span>
              </div>

              <button
                type="submit"
                className="w-full h-10 mt-2 bg-primary hover:bg-primary-container text-on-primary text-[14px] font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Sign in to Workspace</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </form>
          </div>

          {/* Right Column: Interactive Evaluation & Demo Role Selector */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="bg-surface-container-low rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-base">
                    swap_horizontal_circle
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-secondary font-bold">
                    Evaluation Sandbox
                  </span>
                </div>
                <h3 className="text-[20px] font-semibold text-on-surface mt-0.5">
                  One-Click Instant Role Login
                </h3>
                <p className="text-[12px] text-on-surface-variant">
                  Switch personas instantly to audit role-specific dashboards, AI summaries, and approval queues.
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2 bg-surface-container-highest px-3 py-1 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-secondary-container" />
                <span className="font-mono text-[11px] text-on-surface-variant">Live Demo Mode</span>
              </div>
            </div>

            {/* Role Cards */}
            <div className="flex flex-col gap-2.5">
              {/* Arun (Admin) */}
              <div className="group bg-surface-container-lowest hover:bg-surface-container-low rounded-xl p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                <div className="flex items-start gap-3 min-w-0 pl-1">
                  <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant shrink-0">
                    <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[16px] font-semibold text-on-surface">Arun</span>
                      <span className="text-[12px] text-outline">·</span>
                      <span className="text-[11px] text-on-primary-fixed-variant bg-primary-fixed px-2 py-0.5 rounded font-semibold">
                        Admin Access
                      </span>
                      <span className="text-[11px] text-on-surface-variant">VP Customer Success</span>
                    </div>
                    <p className="text-[12px] text-on-surface-variant">
                      Full governance across master triage queue, team workload balancing, SLA analytics, and dispatch rules.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerLaunch('admin', 'Arun (Administrator)', 'arun.admin@bizassist.ai')}
                  className="shrink-0 h-9 px-4 bg-surface-container-high hover:bg-primary hover:text-on-primary text-on-surface text-[12px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Launch as Arun</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>

              {/* Rahul (Support) */}
              <div className="group bg-surface-container-lowest hover:bg-surface-container-low rounded-xl p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary-container" />
                <div className="flex items-start gap-3 min-w-0 pl-1">
                  <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed-variant shrink-0">
                    <span className="material-symbols-outlined text-xl">support_agent</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[16px] font-semibold text-on-surface">Rahul</span>
                      <span className="text-[12px] text-outline">·</span>
                      <span className="text-[11px] text-on-secondary-fixed-variant bg-secondary-fixed px-2 py-0.5 rounded font-semibold">
                        Support Agent Tier 2
                      </span>
                      <span className="text-[11px] text-on-surface-variant">Active Agent</span>
                    </div>
                    <p className="text-[12px] text-on-surface-variant">
                      High-throughput triage view, native AI Executive Summaries, and 1-click Copilot draft replies.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerLaunch('support', 'Rahul (Support Staff)', 'rahul.triage@bizassist.ai')}
                  className="shrink-0 h-9 px-4 bg-surface-container-high hover:bg-secondary hover:text-on-secondary text-on-surface text-[12px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Launch as Rahul</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>

              {/* Priya (Customer) */}
              <div className="group bg-surface-container-lowest hover:bg-surface-container-low rounded-xl p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary" />
                <div className="flex items-start gap-3 min-w-0 pl-1">
                  <div className="w-10 h-10 rounded-lg bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed-variant shrink-0">
                    <span className="material-symbols-outlined text-xl">person_pin</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[16px] font-semibold text-on-surface">Priya</span>
                      <span className="text-[12px] text-outline">·</span>
                      <span className="text-[11px] text-on-tertiary-fixed-variant bg-tertiary-fixed px-2 py-0.5 rounded font-semibold">
                        Verified Customer
                      </span>
                      <span className="text-[11px] text-on-surface-variant">Acme Corp Ltd</span>
                    </div>
                    <p className="text-[12px] text-on-surface-variant">
                      Streamlined portal with AI auto-tagging, live resolution step tracker, and automated knowledge base resolver.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerLaunch('customer', 'Priya (Customer)', 'priya.customer@acmecorp.com')}
                  className="shrink-0 h-9 px-4 bg-surface-container-high hover:bg-tertiary hover:text-on-tertiary text-on-surface text-[12px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Launch as Priya</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>

            {feedback && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-primary-fixed/60 text-on-primary-fixed-variant rounded-lg text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>{feedback}</span>
                </div>
                <span className="font-mono text-[11px]">Redirecting...</span>
              </div>
            )}
          </div>
        </div>

        {/* Compliance Footer */}
        <div className="mt-8 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-[11px] font-semibold">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-tertiary">verified_user</span>
              <span>SOC-2 Type II Certified</span>
            </div>
            <span className="text-outline-variant">·</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-tertiary">lock</span>
              <span>256-bit TLS Encryption</span>
            </div>
            <span className="text-outline-variant">·</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-tertiary">policy</span>
              <span>GDPR &amp; ISO-27001 Ready</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <button
              type="button"
              onClick={() => onSelectRole('customer', 'knowledge-base-and-faqs')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Knowledge Base
            </button>
            <button
              type="button"
              onClick={() => onSelectRole('admin', 'admin-dashboard')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Admin Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
