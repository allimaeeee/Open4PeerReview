export type AIChatEventType =
  | 'panel_toggle'
  | 'selection_popup_shown'
  | 'context_added'
  | 'context_removed'
  | 'shortcut_clicked'
  | 'picker_used'
  | 'message_sent'
  | 'response_received'

export type ContextSource = 'selection_popup' | 'picker' | 'no_context'

export interface AIChatEventData {
  panel_toggle:          { action: 'open' | 'close' }
  selection_popup_shown: { text_length: number }
  context_added:         { text_length: number; snippet_count_after: number }
  context_removed:       { remaining_count: number }
  shortcut_clicked:      { shortcut_id: string; has_context: boolean }
  picker_used:           { shortcut_id: string; criterion_id: string }
  message_sent:          { has_context: boolean; context_count: number }
  response_received:     { response_time_ms: number; trigger: 'shortcut' | 'freeform'; context_source: ContextSource }
}
