'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type {
  AuthSession,
  CandidateProfile,
  CreditLedgerEntry,
  DpdpAuditLog,
  DpdpGrievanceTicket,
  EmployerFactoryProfile,
  HiringDrive,
  JobApplication,
  JobListing,
  Language,
  NotificationEvent,
  OfferLetter,
  RetentionCheckIn,
  UserRole,
} from '../types';
import { EMPTY_EMPLOYER } from '../data/emptyState';
import { makeT } from '../data/translations';
import { isUnread, savedJobIdSet, toggleId } from '../modules/discovery';
import type { WorkerTab } from '../components/Navbar';
import { stopJobAudio } from '../utils/audioNarrator';
import {
  fetchBootstrap,
  logoutApi,
  createCandidateApi,
  updateCandidateApi,
  createJobApi,
  updateJobApi,
  createApplicationApi,
  updateApplicationStatusApi,
  createOfferApi,
  updateOfferStatusApi,
  updateEmployerApi,
  toggleShortlistApi,
  eraseDpdpDataApi,
  unlockCandidateContactApi,
  purchaseCreditPackApi,
  registerHiringDriveApi,
  submitRetentionCheckInApi,
  updateDpdpConsentApi,
  updateDpdpNomineeApi,
  submitDpdpGrievanceApi,
  downloadMyDataApi,
  UNAUTHORIZED_EVENT,
  ERROR_EVENT,
  type BootstrapPayload,
} from '../utils/api';
import { APP_ROLE_PATHS, pathForWorkerTab, roleForPath, roleNeededForPath, workerTabForPath } from '../utils/routes';

/**
 * The one place the browser holds what the server says this person may see, and everything that changes it.
 * `app/(public)/layout.tsx` mounts it once, so the data survives moving between pages. Pages and the site shell
 * read it with `useApp()` instead of receiving props from a parent screen.
 */

type AuthTab = 'worker' | 'employer';
type AuthMode = 'login' | 'register';
type LegalTab = 'privacy' | 'terms';

export interface ModalState {
  auth: { open: boolean; tab: AuthTab; mode: AuthMode };
  legal: { open: boolean; tab: LegalTab };
  dpdp: boolean;
  calculator: boolean;
  report: { open: boolean; company: string };
  createProfile: boolean;
  postJob: boolean;
  ncvtSearch: boolean;
  notifications: boolean;
  ncvtCandidate: CandidateProfile | null;
  offerCandidate: CandidateProfile | null;
  videoCandidate: CandidateProfile | null;
}

const CLOSED: ModalState = {
  auth: { open: false, tab: 'worker', mode: 'login' },
  legal: { open: false, tab: 'privacy' },
  dpdp: false,
  calculator: false,
  report: { open: false, company: '' },
  createProfile: false,
  postJob: false,
  ncvtSearch: false,
  notifications: false,
  ncvtCandidate: null,
  offerCandidate: null,
  videoCandidate: null,
};

export interface AppContextValue {
  /** True until the first answer about who is signed in has arrived. */
  booting: boolean;
  t: ReturnType<typeof makeT>;
  currentLang: Language;
  setLanguage: (language: Language) => void;

  // What the server sent.
  authSession: AuthSession | null;
  jobs: JobListing[];
  candidates: CandidateProfile[];
  offers: OfferLetter[];
  applications: JobApplication[];
  employerProfile: EmployerFactoryProfile;
  shortlistedIds: string[];
  notifications: NotificationEvent[];
  creditLedger: CreditLedgerEntry[];
  hiringDrives: HiringDrive[];
  retentionCheckIns: RetentionCheckIn[];
  grievances: DpdpGrievanceTicket[];
  auditLogs: DpdpAuditLog[];
  stats: { workers: number; factories: number; jobs: number };
  activeWorker: CandidateProfile | undefined;
  unreadNotificationsCount: number;

  // Where we are.
  currentRole: UserRole;
  workerTab: WorkerTab;
  navigate: (role: UserRole) => void;
  openWorkerTab: (tab: WorkerTab) => void;

  // Messages and dialogs.
  toast: string;
  showToast: (message: string) => void;
  clearToast: () => void;
  modals: ModalState;
  closeModal: (name: 'auth' | 'legal' | 'dpdp' | 'calculator' | 'report' | 'createProfile' | 'postJob' | 'ncvtSearch' | 'notifications') => void;
  closeCandidateModal: (name: 'ncvt' | 'offer' | 'video') => void;
  openAuth: (tab?: AuthTab, mode?: AuthMode) => void;
  openLegal: (tab?: LegalTab) => void;
  openDpdp: () => void;
  openCalculator: () => void;
  openReport: (company?: string) => void;
  openCreateProfile: () => void;
  openNcvtSearch: () => void;
  openNotifications: () => void;
  requestPostJob: () => void;
  inspectCertificate: (candidate: CandidateProfile) => void;
  openVideoDemo: (candidate: CandidateProfile) => void;
  openIssueOffer: (candidate: CandidateProfile) => void;
  /** Where to go after a login that started from a protected page (`/login?next=...`). */
  setNextPath: (path: string | undefined) => void;

  // Changes. Each one asks the server, then replaces the snapshot with its answer.
  applyJob: (job: JobListing) => Promise<void>;
  updateWorker: (worker: CandidateProfile) => Promise<void>;
  createProfile: (profile: CandidateProfile) => Promise<boolean>;
  toggleSaveJob: (jobId: string) => Promise<void>;
  createJob: (job: JobListing) => Promise<boolean>;
  updateJob: (job: JobListing) => Promise<void>;
  updateEmployerProfile: (employer: EmployerFactoryProfile) => Promise<void>;
  updateApplicationStatus: (id: string, status: JobApplication['status'], employerPrivateNotes?: string) => Promise<void>;
  toggleShortlist: (candidateId: string) => Promise<void>;
  unlockCandidateContact: (candidateId: string) => Promise<void>;
  purchaseCredits: (packId: 'PACK_10' | 'PACK_25' | 'PACK_100') => Promise<void>;
  issueOffer: (offer: OfferLetter) => Promise<boolean>;
  updateOfferStatus: (offerId: string, status: OfferLetter['status'], declineReason?: string, workerConfirmedJoining?: boolean) => Promise<void>;
  registerDrive: (driveId: string) => Promise<void>;
  submitCheckIn: (checkIn: RetentionCheckIn) => Promise<void>;
  updateConsent: (workerId: string, consent: Parameters<typeof updateDpdpConsentApi>[1]) => Promise<void>;
  updateNominee: (workerId: string, nominee: Parameters<typeof updateDpdpNomineeApi>[1]) => Promise<void>;
  submitGrievance: (ticket: Parameters<typeof submitDpdpGrievanceApi>[0]) => Promise<string | undefined>;
  downloadMyData: typeof downloadMyDataApi;
  eraseWorkerData: (workerId: string) => Promise<void>;
  loginSuccess: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>.');
  return value;
}

interface AppProviderProps {
  children: ReactNode;
  /** The public snapshot the server rendered for this request (never anyone's private data). Without it the provider asks `/api/bootstrap` first. */
  initialSnapshot?: BootstrapPayload;
  /** Who the server says is signed in. A signed-in person's own data is then fetched before the app counts as ready. */
  initialSession?: AuthSession | null;
  initialLanguage?: Language;
}

export function AppProvider({ children, initialSnapshot, initialSession, initialLanguage = 'en' }: AppProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentRole = roleForPath(pathname);
  const workerTab = workerTabForPath(pathname);

  const [currentLang, setCurrentLang] = useState<Language>(initialLanguage);
  // A visitor is ready at once (the server rendered everything they may see). A signed-in person waits for their own data.
  const needsFetch = !initialSnapshot || Boolean(initialSession);
  const [booting, setBooting] = useState(needsFetch);
  const [toast, setToast] = useState('');
  const [modals, setModals] = useState<ModalState>(CLOSED);
  const nextPath = useRef<string | undefined>(undefined);

  // Everything below is exactly what the server says this person may see.
  const [authSession, setAuthSession] = useState<AuthSession | null>(initialSession ?? initialSnapshot?.session ?? null);
  const [jobs, setJobs] = useState<JobListing[]>(initialSnapshot?.jobs ?? []);
  const [candidates, setCandidates] = useState<CandidateProfile[]>(initialSnapshot?.candidates ?? []);
  const [offers, setOffers] = useState<OfferLetter[]>(initialSnapshot?.offers ?? []);
  const [applications, setApplications] = useState<JobApplication[]>(initialSnapshot?.applications ?? []);
  const [employerProfile, setEmployerProfile] = useState<EmployerFactoryProfile>(initialSnapshot?.employerProfile ?? EMPTY_EMPLOYER);
  const [shortlistedIds, setShortlistedIds] = useState<string[]>(initialSnapshot?.shortlistedIds ?? []);
  const [notifications, setNotifications] = useState<NotificationEvent[]>(initialSnapshot?.notifications ?? []);
  // Notifications the person has opened the list for in this visit. The server's own `read` flag
  // still counts: a notification is unread only if neither says it was read.
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [creditLedger, setCreditLedger] = useState<CreditLedgerEntry[]>(initialSnapshot?.creditLedger ?? []);
  const [hiringDrives, setHiringDrives] = useState<HiringDrive[]>(initialSnapshot?.hiringDrives ?? []);
  const [retentionCheckIns, setRetentionCheckIns] = useState<RetentionCheckIn[]>(initialSnapshot?.retentionCheckIns ?? []);
  const [grievances, setGrievances] = useState<DpdpGrievanceTicket[]>(initialSnapshot?.dpdpGrievances ?? []);
  const [auditLogs, setAuditLogs] = useState<DpdpAuditLog[]>(initialSnapshot?.dpdpAuditLogs ?? []);
  const [stats, setStats] = useState(initialSnapshot?.stats ?? { workers: 0, factories: 0, jobs: 0 });
  const t = useMemo(() => makeT(currentLang), [currentLang]);

  const applySnapshot = useCallback((data: BootstrapPayload) => {
    setAuthSession(data.session ?? null);
    setJobs(data.jobs);
    setCandidates(data.candidates);
    setOffers(data.offers);
    setApplications(data.applications);
    setEmployerProfile(data.employerProfile ?? EMPTY_EMPLOYER);
    setShortlistedIds(data.shortlistedIds);
    setNotifications(data.notifications ?? []);
    setCreditLedger(data.creditLedger ?? []);
    setHiringDrives(data.hiringDrives ?? []);
    setRetentionCheckIns(data.retentionCheckIns ?? []);
    setGrievances(data.dpdpGrievances ?? []);
    setAuditLogs(data.dpdpAuditLogs ?? []);
    if (data.stats) setStats(data.stats);
  }, []);

  const syncFromBackend = useCallback(async () => {
    const data = await fetchBootstrap();
    if (data) applySnapshot(data);
    return data;
  }, [applySnapshot]);

  // A visitor's page was rendered with everything they may see, so they only poll. Anyone signed in (or any page the
  // server could not seed) asks `/api/bootstrap` first; the session lives in an httpOnly cookie.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the seed is only read once, on mount
  useEffect(() => {
    if (needsFetch) syncFromBackend().finally(() => setBooting(false));
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') syncFromBackend();
    }, 30000);
    return () => clearInterval(interval);
  }, [syncFromBackend]);

  // Marks the page as ready once React is attached and we know who is signed in, so browser tests
  // never click a server-rendered button before the app is interactive.
  useEffect(() => {
    if (!booting) document.documentElement.dataset.hydrated = 'true';
  }, [booting]);

  // Screen readers and browser translation need the page language.
  useEffect(() => {
    document.documentElement.lang = currentLang;
  }, [currentLang]);

  // Stop reading a job aloud once the person moves to another page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the effect must re-run when the address changes
  useEffect(() => {
    stopJobAudio();
  }, [pathname]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 6000);
  }, []);
  const clearToast = useCallback(() => setToast(''), []);

  // Server says our session is gone (expired, revoked elsewhere): drop to the public site.
  useEffect(() => {
    const onUnauthorized = () => {
      setAuthSession(null);
      if (window.location.pathname !== '/') router.replace('/');
      syncFromBackend();
    };
    const onError = (e: Event) => showToast(String((e as CustomEvent).detail || 'Something went wrong.'));
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener(ERROR_EVENT, onError);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener(ERROR_EVENT, onError);
    };
  }, [router, showToast, syncFromBackend]);

  const activeWorker = authSession?.role === 'worker' ? candidates.find((c) => c.id === authSession.workerId) : undefined;

  // Never show a private page to someone who is not signed in as that kind of user (for example after signing out in another tab).
  useEffect(() => {
    if (booting) return;
    const need = roleNeededForPath(pathname);
    if (need && authSession?.role !== need) router.replace('/');
  }, [booting, pathname, authSession, router]);

  // ---- navigation ----
  const goTo = useCallback(
    (path: string) => {
      if (pathname === path) router.refresh();
      else router.push(path);
    },
    [pathname, router]
  );

  const navigate = (role: UserRole) => {
    if (role === 'employer' && authSession?.role !== 'employer') {
      router.push('/employers');
      return;
    }
    const path = APP_ROLE_PATHS[role];
    if (path && pathname !== path) router.push(path);
    syncFromBackend();
  };

  const openWorkerTab = (tab: WorkerTab) => {
    const path = pathForWorkerTab(tab);
    if (pathname === path) return;
    // Moving between the tabs of /me needs no server work, so change the address in place (Next keeps usePathname in step).
    if (roleForPath(pathname) === 'worker-profile') window.history.pushState(null, '', path);
    else router.push(path);
  };

  const setLanguage = (language: Language) => {
    setCurrentLang(language);
    // biome-ignore lint/suspicious/noDocumentCookie: a plain cookie is what the server reads to render the next page in this language
    document.cookie = `hj_language=${language}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
  };

  // ---- dialogs ----
  const open = <K extends keyof ModalState>(name: K, value: ModalState[K]) => setModals((m) => ({ ...m, [name]: value }));
  const closeModal: AppContextValue['closeModal'] = (name) => {
    setModals((m) => {
      const current = m[name];
      return { ...m, [name]: typeof current === 'boolean' ? false : { ...current, open: false } };
    });
  };
  const closeCandidateModal: AppContextValue['closeCandidateModal'] = (name) =>
    setModals((m) => ({ ...m, [name === 'ncvt' ? 'ncvtCandidate' : name === 'offer' ? 'offerCandidate' : 'videoCandidate']: null }));

  const openAuth = (tab: AuthTab = 'worker', mode: AuthMode = 'login') => open('auth', { open: true, tab, mode });
  const openLegal = (tab: LegalTab = 'privacy') => open('legal', { open: true, tab });
  const openReport = (company = '') => open('report', { open: true, company });
  const openNotifications = () => {
    open('notifications', true);
    // One entry point for the header bell and the phone Alerts tab, so both mark things as seen.
    setReadNotificationIds((prev) => new Set([...prev, ...notifications.map((n) => n.id)]));
  };
  const unreadNotificationsCount = notifications.filter((n) => isUnread(n) && !readNotificationIds.has(n.id)).length;

  // Only a signed-in factory can post a job. Everyone else is sent to the right door first,
  // instead of filling in a form that the server would refuse at the end.
  const pendingPostJob = useRef(false);
  const requestPostJob = () => {
    // Still asking the server who is signed in: remember the click rather than showing a login box to a signed-in factory.
    if (booting) {
      pendingPostJob.current = true;
      return;
    }
    if (authSession?.role === 'employer') open('postJob', true);
    else if (authSession?.role === 'worker') showToast(t('postJobFactoryOnly'));
    else openAuth('employer', 'login');
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once when booting ends
  useEffect(() => {
    if (!booting && pendingPostJob.current) {
      pendingPostJob.current = false;
      requestPostJob();
    }
  }, [booting]);

  // ---- changes ----
  const run = async (call: Promise<BootstrapPayload | null>) => {
    const res = await call;
    if (res) applySnapshot(res);
    return res;
  };

  const issueOffer = async (newOffer: OfferLetter): Promise<boolean> => {
    // An offer attaches to the worker's application to one of this factory's jobs.
    const app =
      applications.find(
        (a) =>
          a.candidateId === newOffer.candidateId &&
          (!newOffer.jobId || a.jobId === newOffer.jobId) &&
          ['Applied', 'Shortlisted', 'Interview', 'Declined'].includes(a.status)
      ) || null;
    if (!app) {
      showToast('This worker has not applied to one of your jobs yet. Invite them first, then send the offer once they apply.');
      return false;
    }
    return !!(await run(createOfferApi({ ...newOffer, applicationId: app.id })));
  };

  const eraseWorkerData = async (workerId: string) => {
    const ok = await eraseDpdpDataApi(workerId);
    if (ok) {
      closeModal('dpdp');
      setAuthSession(null);
      if (window.location.pathname !== '/') router.replace('/');
      await syncFromBackend();
    }
  };

  // The server has set the session cookie; ask who we are and route by role.
  const loginSuccess = async () => {
    const data = await syncFromBackend();
    const role = data?.session?.role;
    if (nextPath.current) {
      const next = new URL(nextPath.current, window.location.origin);
      if (next.origin === window.location.origin) {
        window.location.assign(`${next.pathname}${next.search}${next.hash}`);
        return;
      }
    }
    if (role === 'worker') goTo(APP_ROLE_PATHS.worker as string);
    else if (role === 'employer') goTo(APP_ROLE_PATHS['employer-profile'] as string);
  };

  const logout = async () => {
    await logoutApi();
    setAuthSession(null);
    if (window.location.pathname !== '/') router.replace('/');
    stopJobAudio();
    await syncFromBackend();
    router.refresh();
  };

  const value: AppContextValue = {
    booting, t, currentLang, setLanguage,
    authSession, jobs, candidates, offers, applications, employerProfile, shortlistedIds, notifications, creditLedger,
    hiringDrives, retentionCheckIns, grievances, auditLogs, stats, activeWorker, unreadNotificationsCount,
    currentRole, workerTab, navigate, openWorkerTab,
    toast, showToast, clearToast, modals, closeModal, closeCandidateModal,
    openAuth, openLegal,
    openDpdp: () => open('dpdp', true),
    openCalculator: () => open('calculator', true),
    openReport,
    openCreateProfile: () => open('createProfile', true),
    openNcvtSearch: () => open('ncvtSearch', true),
    openNotifications,
    requestPostJob,
    inspectCertificate: (c) => open('ncvtCandidate', c),
    openVideoDemo: (c) => open('videoCandidate', c),
    openIssueOffer: (c) => open('offerCandidate', c),
    setNextPath: (path) => {
      nextPath.current = path;
    },

    applyJob: async (job) => {
      if (!activeWorker) return openAuth('worker', 'login');
      if (applications.some((a) => a.jobId === job.id)) return;
      await run(createApplicationApi(job.id));
    },
    updateWorker: async (worker) => void (await run(updateCandidateApi(worker))),
    createProfile: async (profile) => {
      if (!activeWorker) return false;
      const ok = !!(await run(createCandidateApi({ ...profile, id: activeWorker.id })));
      if (ok) navigate('worker');
      return ok;
    },
    toggleSaveJob: async (jobId) => {
      if (!activeWorker) return;
      await run(updateCandidateApi({ ...activeWorker, savedJobIds: toggleId([...savedJobIdSet(activeWorker)], jobId) }));
    },
    createJob: async (job) => !!(await run(createJobApi(job))),
    updateJob: async (job) => void (await run(updateJobApi(job))),
    updateEmployerProfile: async (employer) => void (await run(updateEmployerApi(employer))),
    updateApplicationStatus: async (id, status, employerPrivateNotes) =>
      void (await run(updateApplicationStatusApi(id, status, { employerPrivateNotes }))),
    toggleShortlist: async (candidateId) => void (await run(toggleShortlistApi(candidateId))),
    unlockCandidateContact: async (candidateId) => void (await run(unlockCandidateContactApi(candidateId))),
    purchaseCredits: async (packId) => void (await run(purchaseCreditPackApi(packId, employerProfile))),
    issueOffer,
    updateOfferStatus: async (offerId, status, declineReason, workerConfirmedJoining) =>
      void (await run(updateOfferStatusApi(offerId, status, declineReason, workerConfirmedJoining))),
    registerDrive: async (driveId) => void (await run(registerHiringDriveApi(driveId))),
    submitCheckIn: async (checkIn) => void (await run(submitRetentionCheckInApi(checkIn))),
    updateConsent: async (workerId, consent) => void (await run(updateDpdpConsentApi(workerId, consent))),
    updateNominee: async (workerId, nominee) => void (await run(updateDpdpNomineeApi(workerId, nominee))),
    submitGrievance: async (ticket) => {
      const created = await submitDpdpGrievanceApi(ticket);
      await syncFromBackend();
      return created?.id;
    },
    downloadMyData: downloadMyDataApi,
    eraseWorkerData,
    loginSuccess,
    logout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
