'use client'

import { useAIChat } from './AIChatContext'
import { useAIChatLogger } from './logging/AIChatLoggerContext'

// Floating panel toggle — replaces the old edge-mounted "AI" tab entirely.
// Rendered as a sibling of AIChatPanel (not inside it) so it can be
// fixed-positioned independently of the panel's own transform/translate.
// Visual states (idle/hover/thinking-rotate) live in ai-chat.css.
//
// Panel open = no orb (the panel's own header X closes it); panel closed =
// orb visible. No repositioning to the panel's corner — it just hides.
export function AIOrbButton() {
  const { state, togglePanel } = useAIChat()
  const log = useAIChatLogger()

  if (state.isOpen) return null

  function handleClick() {
    log('panel_toggle', { action: 'open' })
    togglePanel()
  }

  return (
    <div className="ai-orb-wrapper">
      <button
        onClick={handleClick}
        aria-label="Open AI assistant"
        className={['ai-orb', state.isLoading ? 'ai-orb--thinking' : ''].join(' ').trim()}
      />
      <span className="ai-orb-tooltip">AI Assistant</span>
    </div>
  )
}
