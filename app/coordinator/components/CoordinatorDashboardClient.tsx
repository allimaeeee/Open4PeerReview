'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/patterns/DashboardShell'
import { DashboardSidebar } from '@/components/patterns/DashboardSidebar'
import { ActivityFeedPlaceholder } from '@/components/patterns/ActivityFeedPlaceholder'
import { TabBar } from '@/components/ui/TabBar'
import { StatCard } from '@/components/ui/StatCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { NeedAssignmentCard } from './NeedAssignmentCard'
import { CoordinatorReviewCard } from './CoordinatorReviewCard'
import type { RubricReview } from './CoordinatorReviewCard'

type ActiveTab = 'need-assignment' | 'under-review' | 'need-approval' | 'approved'
type SidebarItem = 'review-management' | 'members'

// ── Shared shape types (exported for server component) ────────────────────────

export interface AssignmentDocShape {
  id: string
  title: string
  file_type: string | null
  created_at: string
  submission_scope: string[]
  author: { display_name: string | null; email: string } | null
  document_rubrics: { rubric: { id: string; title: string } | null }[]
  preAssigned: { id: string; display_name: string | null; email: string }[]
}

export interface ReviewDocShape {
  id: string
  title: string
  platform: string
  authors: string
  discipline: string
  ccLicense: string
  submittedAt: string
  rubrics: RubricReview[]
  publicReview: boolean
}

interface OrgReviewer {
  id: string
  display_name: string | null
  email: string
}

interface Stats {
  needAssignment: number
  underReview: number
  needApproval: number
  approved: number
}

interface CoordinatorDashboardClientProps {
  institution: string | null
  stats: Stats
  orgReviewers: OrgReviewer[]
  needAssignment: AssignmentDocShape[]
  underReview: ReviewDocShape[]
  needApproval: ReviewDocShape[]
  approved: ReviewDocShape[]
  membersTable?: ReactNode
}

function TabCount({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-label-sm font-label font-semibold bg-[var(--color-surface-container-high)] text-text-secondary">
      {count}
    </span>
  )
}

export function CoordinatorDashboardClient({
  institution,
  stats,
  orgReviewers,
  needAssignment,
  underReview,
  needApproval,
  approved,
  membersTable,
}: CoordinatorDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('need-assignment')
  const [activeSidebarItem, setActiveSidebarItem] = useState<SidebarItem>('review-management')

  const sidebar = (
    <DashboardSidebar
      title="Coordinator Workspace"
      activeItem={activeSidebarItem}
      items={[
        { id: 'review-management', label: 'Review Management' },
        { id: 'members', label: 'Members' },
      ]}
      onNavigate={id => setActiveSidebarItem(id as SidebarItem)}
    />
  )

  const rightPanel = (
    <div className="p-4">
      <ActivityFeedPlaceholder />
    </div>
  )

  return (
    <DashboardShell sidebar={sidebar} rightPanel={rightPanel}>
      <div className="px-8 py-8">

        {/* Review Management page */}
        {activeSidebarItem === 'review-management' && (
          <>
            {/* Page header */}
            <div className="mb-6">
              <p className="text-label-sm font-label font-semibold uppercase tracking-widest text-secondary mb-2">
                Coordinator Workspace
              </p>
              <h1 className="text-heading-lg font-semibold font-heading text-text-primary">
                Review Management
              </h1>
              <p className="text-body-md text-text-secondary mt-1">
                {institution ? `Managing OER for ${institution}` : 'No organization set — add one in your profile settings.'}
              </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <StatCard value={stats.needAssignment} label={`${stats.needAssignment === 1 ? 'Needs' : 'Need'} Assignment`} />
              <StatCard value={stats.underReview} label="Under Review" />
              <StatCard value={stats.needApproval} label={`${stats.needApproval === 1 ? 'Needs' : 'Need'} Approval`} />
              <StatCard value={stats.approved} label="Approved" />
            </div>

            {/* Tab bar */}
            <TabBar
              tabs={[
                {
                  id: 'need-assignment',
                  label: 'Need Assignment',
                  badge: <TabCount count={needAssignment.length} />,
                },
                {
                  id: 'under-review',
                  label: 'Under Review',
                  badge: <TabCount count={underReview.length} />,
                },
                {
                  id: 'need-approval',
                  label: 'Need Approval',
                  badge: <TabCount count={needApproval.length} />,
                },
                {
                  id: 'approved',
                  label: 'Approved',
                  badge: <TabCount count={approved.length} />,
                },
              ]}
              activeId={activeTab}
              onChange={id => setActiveTab(id as ActiveTab)}
              className="mb-6"
            />

            {/* Tab content */}
            {activeTab === 'need-assignment' && (
              needAssignment.length === 0 ? (
                <EmptyState message="No documents waiting on reviewer assignment." />
              ) : (
                <div className="space-y-3">
                  {needAssignment.map(doc => (
                    <NeedAssignmentCard
                      key={doc.id}
                      doc={doc}
                      orgReviewers={orgReviewers}
                      preAssigned={doc.preAssigned}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'under-review' && (
              underReview.length === 0 ? (
                <EmptyState message="No documents currently under review." />
              ) : (
                <div className="space-y-3">
                  {underReview.map(doc => (
                    <CoordinatorReviewCard key={doc.id} {...doc} />
                  ))}
                </div>
              )
            )}

            {activeTab === 'need-approval' && (
              needApproval.length === 0 ? (
                <EmptyState message="No reviews waiting on your approval." />
              ) : (
                <div className="space-y-3">
                  {needApproval.map(doc => (
                    <CoordinatorReviewCard key={doc.id} {...doc} />
                  ))}
                </div>
              )
            )}

            {activeTab === 'approved' && (
              approved.length === 0 ? (
                <EmptyState message="No approved reviews yet." />
              ) : (
                <div className="space-y-3">
                  {approved.map(doc => (
                    <CoordinatorReviewCard key={doc.id} {...doc} />
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* Members page */}
        {activeSidebarItem === 'members' && (
          <>
            <div className="mb-6">
              <p className="text-label-sm font-label font-semibold uppercase tracking-widest text-secondary mb-2">
                Coordinator Workspace
              </p>
              <h1 className="text-heading-lg font-semibold font-heading text-text-primary">
                Members
              </h1>
              <p className="text-body-md text-text-secondary mt-1">
                View everyone in your organization and their reviewer expertise.
              </p>
            </div>
            {membersTable}
          </>
        )}

      </div>
    </DashboardShell>
  )
}
