import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDocumentFeedback, getSignedUrl } from '@/lib/supabase/queries'
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
    const isHtml = data.document.file_type === 'html'
    const pdfUrl = isHtml || !data.document.storage_path
      ? null
      : await getSignedUrl(supabase, data.document.storage_path)
    return (
      <main>
        <FeedbackView
          document={data.document}
          reviews={data.reviews}
          pdfUrl={pdfUrl}
        />
      </main>
    )
  } catch {
    notFound()
  }
}
