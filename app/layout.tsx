//Root layout
import { Lato } from 'next/font/google'
import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-lato',
})

export const metadata: Metadata = {
  title: 'OLI Annotation Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lato.variable}>
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
