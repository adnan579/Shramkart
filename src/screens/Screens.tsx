'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DualLanding } from '../components/DualLanding';
import { AboutPage } from '../components/AboutPage';
import { WorkerPortal } from '../components/WorkerPortal';
import { EmployerPortal } from '../components/EmployerPortal';
import { WorkerProfileView } from '../components/WorkerProfileView';
import { EmployerProfileView } from '../components/EmployerProfileView';
import { useApp } from '../shell/AppProvider';

/** `/` — the landing page. Old links of the form `/#/about` still land on the About page. */
export function LandingScreen() {
  const app = useApp();
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash === '#/about') router.replace('/about');
  }, [router]);
  return (
    <DualLanding
      currentLang={app.currentLang}
      authSession={app.authSession}
      activeWorker={app.activeWorker}
      employerProfile={app.employerProfile}
      jobs={app.jobs}
      candidates={app.candidates}
      stats={app.stats}
      onSelectRole={app.navigate}
      onOpenCalculator={app.openCalculator}
      onOpenReport={() => app.openReport()}
      onOpenAuthModal={app.openAuth}
      onOpenLegalModal={app.openLegal}
    />
  );
}

/** `/about` */
export function AboutScreen() {
  const app = useApp();
  return (
    <AboutPage
      t={app.t}
      jobs={app.jobs}
      isSignedIn={Boolean(app.authSession)}
      onBrowseJobs={() => app.navigate('worker')}
      onRegisterWorker={() => app.openAuth('worker', 'register')}
      onRegisterFactory={() => app.openAuth('employer', 'register')}
      onLogin={() => app.openAuth('worker', 'login')}
    />
  );
}

/** `/jobs` for a signed-in worker: the job feed with saved jobs, drives and one-tap apply. */
export function WorkerFeedScreen() {
  const app = useApp();
  return (
    <WorkerPortal
      jobs={app.jobs}
      currentLang={app.currentLang}
      activeWorker={app.activeWorker}
      applications={app.applications}
      offers={app.offers}
      hiringDrives={app.hiringDrives}
      onApplyJob={app.applyJob}
      onOpenWorkerProfile={() => (app.authSession?.role === 'worker' ? app.navigate('worker-profile') : app.openAuth('worker', 'login'))}
      onOpenAuthModal={() => app.openAuth('worker', 'login')}
      onOpenCreateProfile={app.openCreateProfile}
      onOpenReport={app.openReport}
      onRegisterDrive={app.registerDrive}
      onToggleSaveJob={app.toggleSaveJob}
    />
  );
}

/** `/employers/talent` — a signed-in factory searching the talent directory. */
export function TalentScreen() {
  const app = useApp();
  return (
    <EmployerPortal
      candidates={app.candidates}
      jobs={app.jobs}
      currentLang={app.currentLang}
      authSession={app.authSession}
      employerProfile={app.employerProfile}
      shortlistedIds={app.shortlistedIds}
      onToggleShortlist={app.toggleShortlist}
      onUnlockCandidateContact={app.unlockCandidateContact}
      onOpenEmployerProfile={() => (app.authSession?.role === 'employer' ? app.navigate('employer-profile') : app.openAuth('employer', 'login'))}
      onOpenAuthModal={() => app.openAuth('employer', 'login')}
      onRegisterFactory={() => app.openAuth('employer', 'register')}
      onSeeHow={() => app.navigate('about')}
      onOpenPostJob={app.requestPostJob}
      onInspectCertificate={app.inspectCertificate}
      onOpenVideoDemo={app.openVideoDemo}
      onOpenIssueOffer={app.openIssueOffer}
    />
  );
}

/** `/me`, `/me/applications`, `/me/id-card`, `/me/profile` — the worker's own page. The tab comes from the address. */
export function WorkerProfileScreen() {
  const app = useApp();
  if (!app.activeWorker) return null;
  return (
    <WorkerProfileView
      worker={app.activeWorker}
      applications={app.applications}
      offers={app.offers}
      currentLang={app.currentLang}
      retentionCheckIns={app.retentionCheckIns}
      activeTab={app.workerTab}
      onActiveTabChange={app.openWorkerTab}
      onUpdateWorker={app.updateWorker}
      onUpdateOfferStatus={app.updateOfferStatus}
      onSubmitCheckIn={app.submitCheckIn}
      onInspectCertificate={app.inspectCertificate}
      onOpenVideoDemo={app.openVideoDemo}
      onBrowseJobs={() => app.navigate('worker')}
      onLogout={app.logout}
      onOpenDpdpModal={app.openDpdp}
    />
  );
}

/** `/employers/dashboard` — the factory's own postings, applicants, team and credits. */
export function EmployerDashboardScreen() {
  const app = useApp();
  return (
    <EmployerProfileView
      employer={app.employerProfile}
      jobs={app.jobs}
      applications={app.applications}
      offers={app.offers}
      candidates={app.candidates}
      shortlistedIds={app.shortlistedIds}
      creditLedger={app.creditLedger}
      onUpdateEmployer={app.updateEmployerProfile}
      onUpdateJob={app.updateJob}
      onUpdateApplicationStatus={app.updateApplicationStatus}
      onPurchaseCredits={app.purchaseCredits}
      onToggleShortlist={app.toggleShortlist}
      onInspectCertificate={app.inspectCertificate}
      onOpenIssueOffer={app.openIssueOffer}
      onOpenPostJob={app.requestPostJob}
      onBrowseTalent={() => app.navigate('employer')}
      onLogout={app.logout}
    />
  );
}

/** Opens the sign-in dialog when the page loads (`/login?role=employer&mode=register&next=/employers/dashboard`). */
export function AuthLauncher({ role, mode, next }: { role: 'worker' | 'employer'; mode: 'login' | 'register'; next?: string }) {
  const { openAuth, setNextPath } = useApp();
  // biome-ignore lint/correctness/useExhaustiveDependencies: open once per visit to the page
  useEffect(() => {
    setNextPath(next);
    openAuth(role, mode);
  }, [role, mode, next]);
  return null;
}

/** Opens the Privacy Notice or Terms dialog when the page loads (`/privacy`, `/terms`). */
export function LegalLauncher({ tab }: { tab: 'privacy' | 'terms' }) {
  const { openLegal } = useApp();
  // biome-ignore lint/correctness/useExhaustiveDependencies: open once per visit to the page
  useEffect(() => {
    openLegal(tab);
  }, [tab]);
  return null;
}
