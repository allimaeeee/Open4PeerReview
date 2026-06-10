import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDocumentFeedback } from '@/lib/supabase/queries'
import { FeedbackView } from './FeedbackView'

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { documentId } = await params

  try {
    const data = await getDocumentFeedback(supabase, documentId)
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <FeedbackView document={data.document} reviews={data.reviews} />
      </main>
    )
  } catch {
    notFound()
  }
}
