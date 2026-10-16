/**
 * Normalized stream events consumed by the chat domain.
 *
 * The backend currently uses two different shapes for tool events: request
 * messages use `toolId/toolName/toolArguments`, while completed messages use
 * `id/name/arguments/result`. The transport adapter normalizes both shapes to
 * this type so components never need to know the wire protocol.
 */
export type ChatStreamMessage =
  | { type: 'ai_response'; content: string }
  | { type: 'thinking'; content: string }
  | {
      type: 'tool_request'
      toolId?: string
      toolName?: string
      toolArguments?: string
      content?: string
    }
  | {
      type: 'tool_executed'
      toolId?: string
      toolName?: string
      toolArguments?: string
      result?: string
      /** A display-ready result supplied by older stream producers. */
      content?: string
    }
