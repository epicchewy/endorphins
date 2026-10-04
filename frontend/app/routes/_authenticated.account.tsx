import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Download } from 'lucide-react'
import { useAccount } from '~/hooks/use-account'
import { useAccountExport } from '~/hooks/use-account-export'
import { PageHeading } from '~/components/ui/page-heading'
import { Button } from '~/components/ui/button'
import { Feedback, LoadingState } from '~/components/ui/feedback'

export const Route = createFileRoute('/_authenticated/account')({
  component: Account,
})

function Account() {
  const account = useAccount()
  const download = useAccountExport()
  return (
    <div className="mx-auto max-w-[800px]">
      <Link
        to="/workouts"
        className="mb-6 inline-flex min-h-11 items-center gap-2.5 text-[13px] font-semibold underline-offset-4 hover:underline print:hidden"
      >
        <ArrowLeft size={16} aria-hidden="true" /> My workouts
      </Link>
      <PageHeading title="Your account." description="Your plans. Your data. In your hands." />
      {account.isPending && <LoadingState>Loading your account details…</LoadingState>}
      {account.isError && (
        <Feedback retry={() => void account.refetch()} retryLabel="Retry account">
          {account.error.message}
        </Feedback>
      )}
      {account.data && (
        <>
          <section
            className="border-t border-line py-8 max-[600px]:py-6"
            aria-labelledby="account-details-title"
          >
            <h2
              id="account-details-title"
              className="text-[clamp(22px,3vw,28px)] tracking-[-0.025em]"
            >
              A place for your progress.
            </h2>
            <p className="mt-3 max-w-[64ch] text-base leading-[1.8] text-muted">
              Every workout you generate is saved to this account.
            </p>
            <dl className="mt-8 grid grid-cols-[1fr_1.4fr] gap-6 max-[600px]:grid-cols-1">
              <div>
                <dt className="mb-2 text-xs text-muted">Member since</dt>
                <dd className="text-sm leading-[1.7] wrap-anywhere">
                  <time dateTime={account.data.createdAt}>
                    {new Date(account.data.createdAt).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="mb-2 text-xs text-muted">Account reference</dt>
                <dd className="text-sm leading-[1.7] wrap-anywhere">{account.data.id}</dd>
              </div>
            </dl>
          </section>
          <section
            className="border-t border-line py-8 max-[600px]:py-6"
            aria-labelledby="account-data-title"
          >
            <h2 id="account-data-title" className="text-[clamp(22px,3vw,28px)] tracking-[-0.025em]">
              Take your plans with you.
            </h2>
            <p className="mt-3 max-w-[64ch] text-base leading-[1.8] text-muted">
              Download your account details and every saved workout as a JSON file. It includes the
              original exercises, sets, and time estimates.
            </p>
            <Button
              className="mt-6 max-[600px]:w-full"
              variant="primary"
              pending={download.isPending}
              onClick={() => download.mutate(account.data.id)}
            >
              {!download.isPending && <Download size={18} aria-hidden="true" />}
              {download.isPending ? 'Preparing your download…' : 'Download my data'}
            </Button>
            {download.isError && (
              <Feedback retry={() => download.mutate(account.data.id)} retryLabel="Retry download">
                {download.error.message}
              </Feedback>
            )}
            {download.isSuccess && download.data && (
              <Feedback tone="info">
                Your download is ready. Check your browser’s downloads.
              </Feedback>
            )}
          </section>
          <section
            className="border-t border-line py-8 max-[600px]:py-6"
            aria-labelledby="account-signin-title"
          >
            <h2
              id="account-signin-title"
              className="text-[clamp(22px,3vw,28px)] tracking-[-0.025em]"
            >
              Sign-in & privacy.
            </h2>
            <p className="mt-3 max-w-[64ch] text-base leading-[1.8] text-muted">
              Use the profile menu at the top of the page to manage your sign-in details. When an
              account deletion is confirmed, its saved workouts are removed.
            </p>
          </section>
        </>
      )}
    </div>
  )
}
