import { Card } from '@/components/ui/Card'

export function ActivityFeedPlaceholder() {
  return (
    <Card>
      <div className="p-4">
        <h3 className="font-heading text-title-sm text-text-primary mb-2">Recent Activity</h3>
        <p className="text-body-sm text-text-muted">Activity feed coming soon.</p>
      </div>
    </Card>
  )
}
