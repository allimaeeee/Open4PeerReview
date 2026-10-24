// NOTE: this route serves author, reviewer, and coordinator views despite living under /author — candidate for relocation to a role-agnostic path if time allows before handoff.
import { redirect, notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getDocumentFeedback, getSignedUrl } from '@/lib/supabase/queries'
import { ConsoleRevisionView } from './ConsoleRevisionView'
import { ReportFeedbackView } from './ReportFeedbackView'

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { documentId } = await params
  const { view } = await searchParams

  try {
    const data = await getDocumentFeedback(supabase, documentId)
    const isHtml = data.document.file_type === 'html'
    const pdfUrl = isHtml || !data.document.storage_path
      ? null
      : await getSignedUrl(supabase, data.document.storage_path)

    // view=report forces the static read-only view even for an author.
    // view=console (or absent) falls back to: isAuthor → Console, else → Report.
    const renderConsole = view !== 'report' && data.isAuthor

    return (
      <main className="flex-1 min-h-0 flex flex-col">
        <Suspense fallback={null}>
          {renderConsole ? (
            <ConsoleRevisionView
              document={data.document}
              reviews={data.reviews}
              allRubrics={data.allRubrics}
              pdfUrl={pdfUrl}
              isAuthor={data.isAuthor}
              initialResponses={data.feedbackResponses}
              initialRevisionNotes={data.revisionNotes}
              initialFeedbackComments={data.feedbackComments}
            />
          ) : (
            <ReportFeedbackView
              document={data.document}
              reviews={data.reviews}
              allRubrics={data.allRubrics}
              pdfUrl={pdfUrl}
            />
          )}
        </Suspense>
      </main>
    )
  } catch {
    notFound()
  }
}
