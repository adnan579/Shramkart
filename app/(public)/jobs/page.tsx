import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkerFeedScreen } from '../../../src/screens/Screens';
import { pageAuth } from '../../../server/next/page-data';
import { publicBootstrap, publicJobList } from '../../../server/services/publicJobs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Manufacturing Jobs | Shramkart',
  description: 'Browse verified manufacturing jobs with clear take-home pay and location details.',
};

interface JobsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const inr = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const query = await searchParams;
  const mode = typeof query.mode === 'string' ? query.mode : 'jobs';
  const hub = typeof query.hub === 'string' ? query.hub.trim() : '';
  let jobs: Awaited<ReturnType<typeof publicJobList>> = [];
  let drives: NonNullable<Awaited<ReturnType<typeof publicBootstrap>>['hiringDrives']> = [];
  let unavailable = false;

  try {
    // A signed-in worker gets the full feed (the shared layout already holds their snapshot); everyone else gets the public list.
    if (mode === 'jobs' && (await pageAuth())?.role === 'worker') return <WorkerFeedScreen />;
    if (mode === 'drives') {
      const data = await publicBootstrap();
      drives = (data.hiringDrives ?? []).filter((drive) => !hub || `${drive.industrialHub} ${drive.venue}`.toLowerCase().includes(hub.toLowerCase()));
    } else {
      jobs = await publicJobList(hub || undefined, mode === 'iti');
    }
  } catch (error) {
    unavailable = true;
    console.error('[public-jobs]', error instanceof Error ? error.message : error);
  }

  return (
    <div className="min-h-full bg-[var(--sk-canvas)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-6 max-w-3xl">
          <p className="eyebrow">Verified opportunities</p>
          <h1 className="mt-2 text-3xl font-extrabold text-[var(--sk-ink)]">Manufacturing jobs</h1>
          <p className="mt-2 text-body text-[var(--sk-body)]">Open roles with clear take-home pay and location details.</p>
        </header>
        <form method="get" className="mb-8 flex flex-wrap items-end gap-3 border-y border-[var(--sk-border)] py-4">
          <label className="field-label min-w-48 flex-1">Industrial hub or state
            <input className="field mt-1" name="hub" defaultValue={hub} placeholder="e.g. Pune" />
          </label>
          <label className="field-label min-w-44">Listing type
            <select className="field mt-1" name="mode" defaultValue={mode === 'drives' ? 'drives' : 'jobs'}>
              <option value="jobs">All jobs</option>
              <option value="iti">ITI / certificate roles</option>
              <option value="drives">Hiring drives</option>
            </select>
          </label>
          <button className="btn btn-worker" type="submit">Search</button>
        </form>

        {unavailable ? (
          <p role="status" className="border-l-4 border-amber-500 bg-white p-4 text-body text-[var(--sk-body)]">Job listings are temporarily unavailable. Please try again shortly.</p>
        ) : mode === 'drives' ? (
          drives.length ? (
            <ul className="divide-y divide-[var(--sk-border)] border-y border-[var(--sk-border)]">
              {drives.map((drive) => (
                <li key={drive.id} className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--sk-ink)]">{drive.title}</h2>
                    <p className="mt-1 text-body text-[var(--sk-body)]">{drive.companyName} · {drive.industrialHub} · {drive.date}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--sk-muted)]">{drive.seatsAvailable ?? drive.targetOpenings} openings</p>
                </li>
              ))}
            </ul>
          ) : <p className="py-8 text-body text-[var(--sk-muted)]">No hiring drives match this location.</p>
        ) : jobs.length ? (
          <ul className="divide-y divide-[var(--sk-border)] border-y border-[var(--sk-border)]">
            {jobs.map((job) => (
              <li key={job.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-[var(--sk-ink)]"><Link href={`/jobs/${encodeURIComponent(job.id)}`} className="hover:underline">{job.title}</Link></h2>
                  <p className="mt-1 text-body text-[var(--sk-body)]">{job.companyName} · {job.industrialHub}, {job.state}</p>
                  <p className="mt-1 text-sm text-[var(--sk-muted)]">{job.vacanciesLeft} openings · {job.postedAt}</p>
                </div>
                <p className="font-bold tabular-nums text-[var(--sk-green-text)]">{inr(job.takeHomeSalary)} / month</p>
              </li>
            ))}
          </ul>
        ) : <p className="py-8 text-body text-[var(--sk-muted)]">No verified jobs match this location.</p>}
      </div>
    </div>
  );
}