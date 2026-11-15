import { post, useAction, useApi } from '../../lib/api'
import { Button, Card, Empty, Page, Query } from '../../components/ui'

export default function Notifications() {
  const q = useApi('/admin/notifications/failed')
  const retry = useAction((id) => post(`/admin/notifications/${id}/retry`), { success: 'Queued again.' })
  return (
    <Page title="Failed notifications" subtitle="SMS and emails that failed all 5 tries. Fix the cause (for example the SMS provider's credentials), then retry.">
      <Card>
        <Query query={q}>
          {({ jobs }) => jobs.length === 0 ? <Empty>Nothing has failed. Every SMS and email went out.</Empty> : (
            <ul className="divide-y divide-gray-100">
              {jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{j.name} <span className="font-normal text-gray-500">to {j.to}</span></p>
                    <p className="text-red-700">{j.error}</p>
                    <p className="text-xs text-gray-500">{j.attempts} tries · last {new Date(j.failedAt).toLocaleString('en-IN')}</p>
                  </div>
                  <Button variant="secondary" loading={retry.isPending && retry.variables === j.id} onClick={() => retry.mutate(j.id)}>Retry</Button>
                </li>
              ))}
            </ul>
          )}
        </Query>
      </Card>
    </Page>
  )
}
