'use client';

import { AuthModal } from '../components/AuthModal';
import { LegalModal } from '../components/LegalModal';
import { DpdpComplianceModal } from '../components/DpdpComplianceModal';
import { NcvtCertificateModal } from '../components/NcvtCertificateModal';
import { DigitalOfferModal } from '../components/DigitalOfferModal';
import { PracticalVideoModal } from '../components/PracticalVideoModal';
import { TakeHomeCalculatorModal } from '../components/TakeHomeCalculatorModal';
import { WhistleblowerModal } from '../components/WhistleblowerModal';
import { SmartTradeProfileModal } from '../components/SmartTradeProfileModal';
import { PostJobModal } from '../components/PostJobModal';
import { NcvtSearchModal } from '../components/NcvtSearchModal';
import { useApp } from './AppProvider';

/** Every dialog the site can open. Pages ask for one with `useApp().openX()`; the state lives in the provider. */
export function AppModals() {
  const app = useApp();
  const { modals, activeWorker, currentLang } = app;
  return (
    <>
      <AuthModal
        isOpen={modals.auth.open}
        initialTab={modals.auth.tab}
        initialMode={modals.auth.mode}
        onClose={() => app.closeModal('auth')}
        onLoginSuccess={app.loginSuccess}
        onOpenLegalModal={app.openLegal}
        lang={currentLang}
      />

      {activeWorker && (
        <DpdpComplianceModal
          isOpen={modals.dpdp}
          onClose={() => app.closeModal('dpdp')}
          lang={currentLang}
          activeWorker={activeWorker}
          applications={app.applications}
          offers={app.offers}
          grievances={app.grievances}
          auditLogs={app.auditLogs}
          onUpdateConsent={app.updateConsent}
          onUpdateNominee={app.updateNominee}
          onEraseWorkerData={app.eraseWorkerData}
          onSubmitGrievance={app.submitGrievance}
          onDownloadData={app.downloadMyData}
        />
      )}

      <LegalModal
        isOpen={modals.legal.open}
        initialTab={modals.legal.tab}
        onClose={() => app.closeModal('legal')}
        authSession={app.authSession}
        activeWorker={activeWorker}
        employerProfile={app.employerProfile}
        onDeleteWorkerAccount={() => {
          if (activeWorker) app.eraseWorkerData(activeWorker.id);
        }}
      />

      {modals.ncvtCandidate && (
        <NcvtCertificateModal
          candidateName={modals.ncvtCandidate.name}
          certificate={modals.ncvtCandidate.ncvtCertificate}
          isOpen
          onClose={() => app.closeCandidateModal('ncvt')}
        />
      )}

      {modals.offerCandidate && (
        <DigitalOfferModal
          candidate={modals.offerCandidate}
          isOpen
          onClose={() => app.closeCandidateModal('offer')}
          onIssueOffer={app.issueOffer}
          employer={app.employerProfile}
        />
      )}

      {modals.videoCandidate && <PracticalVideoModal candidate={modals.videoCandidate} isOpen onClose={() => app.closeCandidateModal('video')} />}

      <TakeHomeCalculatorModal isOpen={modals.calculator} onClose={() => app.closeModal('calculator')} lang={currentLang} />

      <WhistleblowerModal isOpen={modals.report.open} onClose={() => app.closeModal('report')} lang={currentLang} prefilledCompany={modals.report.company} />

      <SmartTradeProfileModal isOpen={modals.createProfile} onClose={() => app.closeModal('createProfile')} lang={currentLang} onProfileCreated={app.createProfile} />

      <PostJobModal isOpen={modals.postJob} onClose={() => app.closeModal('postJob')} onJobCreated={app.createJob} employer={app.employerProfile} />

      <NcvtSearchModal
        isOpen={modals.ncvtSearch}
        onClose={() => app.closeModal('ncvtSearch')}
        candidates={app.candidates}
        onSelectCandidate={(c) => {
          app.closeModal('ncvtSearch');
          app.inspectCertificate(c);
        }}
      />
    </>
  );
}
