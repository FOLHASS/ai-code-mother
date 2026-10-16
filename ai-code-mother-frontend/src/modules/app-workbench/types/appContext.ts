import type { Ref } from 'vue'

import type { ChatMessage } from '@/modules/ai-chat/types/chatMessage.ts'
import type {
  AppContext,
  AppPermissions,
  AppSummary,
  AppId,
} from '@/modules/app-management/types/index.ts'

export type { AppContext, AppId, AppPermissions, AppSummary }

/** Minimal chat port consumed by the workbench composition layer. */
export type ChatSessionPort = {
  messages: Ref<ChatMessage[]>
  status: Ref<'idle' | 'loading-history' | 'streaming' | 'error'>
  send: (content: string) => Promise<void>
  loadOlder: () => Promise<void>
  abort: () => void
}

/** Minimal preview port consumed by the workbench composition layer. */
export type PreviewPort = {
  url: Ref<string>
  error: Ref<string>
  refresh: (cacheBust?: boolean) => Promise<void>
  attachIframe: (iframe: HTMLIFrameElement | null) => void
}

/** Reactive context passed to feature views; it does not own either feature's internals. */
export type AppWorkbenchContext = {
  appId: Ref<AppId>
  app: Ref<AppSummary | null>
  permissions: Ref<AppPermissions>
  chat?: ChatSessionPort
  preview?: PreviewPort
}
