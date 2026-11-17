'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Clock, X } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { BottomNav } from '../components/BottomNav';
import { Footer } from '../components/Footer';
import { Dialog } from '../components/ui/Dialog';
import { AppModals } from './AppModals';
import { useApp } from './AppProvider';

/** The header, bottom tab bar, footer, dialogs and toast that every public page shares. Pages render inside `<main>`. */
export function SiteShell({ children }: { children: ReactNode }) {
  const app = useApp();
  const { t } = app;
  return (
    <div className="pb-nav flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <a href="#main" className="skip-link">
        {t('skipToContent')}
      </a>
      {app.toast && (
        <div
          role="alert"
          className="fixed top-3 inset-x-3 sm:left-auto sm:right-4 sm:max-w-md z-[60] flex items-start gap-2 p-3 bg-red-600 text-white text-sm font-semibold rounded-xl shadow-xl"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{app.toast}</span>
          <button type="button" onClick={app.clearToast} aria-label={t('close')}>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <Navbar
        currentRole={app.currentRole}
        currentLang={app.currentLang}
        authSession={app.authSession}
        activeWorker={app.activeWorker}
        employerProfile={app.employerProfile}
        unreadNotificationsCount={app.unreadNotificationsCount}
        workerTab={app.workerTab}
        onOpenWorkerTab={app.openWorkerTab}
        onRoleChange={app.navigate}
        onLangChange={app.setLanguage}
        onOpenCalculator={app.openCalculator}
        onOpenReport={() => app.openReport()}
        onOpenNcvtSearch={app.openNcvtSearch}
        onOpenAuthModal={app.openAuth}
        onOpenNotifications={app.openNotifications}
        onOpenPostJob={app.requestPostJob}
        onLogout={app.logout}
      />

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <BottomNav
        t={t}
        currentRole={app.currentRole}
        signedInAs={app.authSession?.role === 'employer' ? 'employer' : app.authSession?.role === 'worker' && app.activeWorker ? 'worker' : null}
        workerTab={app.workerTab}
        unreadCount={app.unreadNotificationsCount}
        onRoleChange={app.navigate}
        onOpenWorkerTab={app.openWorkerTab}
        onOpenNotifications={app.openNotifications}
        onOpenPostJob={app.requestPostJob}
        onOpenAuthModal={app.openAuth}
        onLogout={app.logout}
      />

      <Dialog
        open={app.modals.notifications}
        onClose={() => app.closeModal('notifications')}
        variant="drawer"
        eyebrow={t('notifSubtitle')}
        title={t('notifTitle')}
        closeLabel={t('notifCloseAria')}
      >
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-meta font-semibold text-slate-700">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('notifQuiet')}</span>
        </p>
        {app.notifications.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Bell className="mb-3 h-10 w-10 text-slate-400" aria-hidden="true" />
            <h3 className="text-body font-bold text-slate-900">{t('notifEmptyTitle')}</h3>
            <p className="mt-1 max-w-xs text-body text-slate-700">{t('notifEmptyBody')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {app.notifications.map((n) => (
              <li key={n.id} className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="badge">{n.channel}</span>
                  <span className="inline-flex items-center gap-1 text-meta font-bold text-[var(--sk-green-text)]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {n.status}
                  </span>
                </div>
                <p className="text-body font-bold text-slate-900">{n.title}</p>
                <p className="text-body text-slate-700">{n.body}</p>
                <p className="text-meta tabular-nums text-slate-600">{n.createdAt}</p>
              </li>
            ))}
          </ul>
        )}
      </Dialog>

      <Footer
        currentLang={app.currentLang}
        onSelectRole={app.navigate}
        onOpenCalculator={app.openCalculator}
        onOpenReport={() => app.openReport()}
        onOpenNcvtSearch={app.openNcvtSearch}
        onOpenLegalModal={app.openLegal}
        onOpenAuthModal={app.openAuth}
      />

      <AppModals />
    </div>
  );
}
