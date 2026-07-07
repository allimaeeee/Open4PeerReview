//Root layout
import { Lato, Newsreader } from 'next/font/google'
import { AIChatWidget } from '@/features/ai-chat/AIChatWidget'
import type { Metadata } from 'next'
import './globals.css'
import { Suspense } from 'react'
import Navbar from '@/components/layout/Navbar'
import { ReviewSaveStatusProvider } from '@/lib/review-save-context'

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-lato',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-newsreader',
})

export const metadata: Metadata = {
  title: 'OLI Annotation Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lato.variable} ${newsreader.variable}`}>
      <body className="bg-surface h-screen overflow-hidden flex flex-col" suppressHydrationWarning>
        <ReviewSaveStatusProvider>
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          {children}
          <Suspense fallback={null}>
            <AIChatWidget />
          </Suspense>
        </ReviewSaveStatusProvider>
      </body>
    </html>
  )
}
