/* eslint-disable */
import request, { API_BASE_URL } from '@/request'

/**
 * 读取代码生成 SSE。后端返回 ServerSentEvent<String>，使用原生 fetch
 * 保留流式响应能力；如果服务端返回普通 JSON，也兼容读取最终结果。
 */
export async function* streamChatToGenCode(params: API.chatToGenCodeParams) {
  const query = new URLSearchParams({
    appId: String(params.appId),
    message: params.message,
  })
  const response = await fetch(`${API_BASE_URL}/app/chat/gen/code?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'text/event-stream, application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      window.location.href = `/user/login?redirect=${encodeURIComponent(window.location.href)}`
    }
    throw new Error(`代码生成请求失败（${response.status}）`)
  }

  if (!response.body) {
    return
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
    const body = (await response.json()) as { code?: number; data?: string; message?: string }
    if (body.code !== undefined && body.code !== 0) {
      throw new Error(body.message || '代码生成失败')
    }
    if (body.data) {
      yield body.data
    }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const parseEvent = (event: string) => {
    const eventType = event
      .split(/\r?\n/)
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim()

    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n')

    if (eventType === 'done' || data === '[DONE]') {
      return { type: 'done' as const, content: '' }
    }
    if (eventType === 'error') {
      try {
        const payload = JSON.parse(data) as { message?: unknown }
        return {
          type: 'error' as const,
          content: typeof payload.message === 'string' ? payload.message : '代码生成失败',
        }
      } catch {
        return { type: 'error' as const, content: data || '代码生成失败' }
      }
    }
    if (!data) {
      return null
    }

    try {
      const parsed: unknown = JSON.parse(data)
      if (typeof parsed === 'string') return { type: 'chunk' as const, content: parsed }
      if (parsed && typeof parsed === 'object') {
        const payload = parsed as { d?: unknown; data?: unknown; message?: unknown }
        if (typeof payload.d === 'string') return { type: 'chunk' as const, content: payload.d }
        if (typeof payload.data === 'string') return { type: 'chunk' as const, content: payload.data }
        if (typeof payload.message === 'string') return { type: 'error' as const, content: payload.message }
      }
      return { type: 'chunk' as const, content: data }
    } catch {
      return { type: 'chunk' as const, content: data }
    }
  }

  // 按 SSE 标准逐行消费，避免依赖网络 chunk 的边界。
  while (true) {
    const { done, value } = await reader.read()
    console.debug('[SSE read]', { done, bytes: value?.byteLength ?? 0, at: new Date().toISOString() })
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

    const lines = buffer.split(/\r\n|\n|\r/)
    buffer = lines.pop() || ''
    let eventLines: string[] = []
    for (const line of lines) {
      if (line === '') {
        const parsed = parseEvent(eventLines.join('\n'))
        eventLines = []
        console.debug('[SSE event]', { parsed, at: new Date().toISOString() })
        if (parsed?.type === 'error') throw new Error(parsed.content)
        if (parsed?.type === 'done') return
        if (parsed?.type === 'chunk') yield parsed.content
      } else if (!line.startsWith(':')) {
        eventLines.push(line)
      }
    }

    if (done) {
      if (buffer) eventLines.push(buffer)
      const parsed = parseEvent(eventLines.join('\n'))
      if (parsed?.type === 'error') {
        throw new Error(parsed.content)
      }
      if (parsed?.type === 'chunk') {
        yield parsed.content
      }
      break
    }
  }
}

/** 此处后端没有提供注释 POST /app/add */
export async function addApp(body: API.AppAddRequest, options?: { [key: string]: any }) {
  return request<API.BaseResponseLong>('/app/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 POST /app/admin/delete */
export async function adminDeleteApp(body: API.DeleteRequest, options?: { [key: string]: any }) {
  return request<API.BaseResponseBoolean>('/app/admin/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 GET /app/admin/get/vo */
export async function adminGetAppVoById(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.adminGetAppVOByIdParams,
  options?: { [key: string]: any }
) {
  return request<API.BaseResponseAppVO>('/app/admin/get/vo', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 POST /app/admin/list/page/vo */
export async function adminListAppVoByPage(
  body: API.AppQueryRequest,
  options?: { [key: string]: any }
) {
  return request<API.BaseResponsePageAppVO>('/app/admin/list/page/vo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 POST /app/admin/update */
export async function adminUpdateApp(
  body: API.AppAdminUpdateRequest,
  options?: { [key: string]: any }
) {
  return request<API.BaseResponseBoolean>('/app/admin/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 GET /app/chat/gen/code */
export async function chatToGenCode(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.chatToGenCodeParams,
  options?: { [key: string]: any }
) {
  return request<API.ServerSentEventString[]>('/app/chat/gen/code', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 POST /app/delete */
export async function deleteApp(body: API.DeleteRequest, options?: { [key: string]: any }) {
  return request<API.BaseResponseBoolean>('/app/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 POST /app/deploy */
export async function deploy(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deployParams,
  options?: { [key: string]: any }
) {
  return request<API.BaseResponseString>('/app/deploy', {
    method: 'POST',
    params: {
      ...params,
    },
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 GET /app/get/vo */
export async function getAppVoById(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getAppVOByIdParams,
  options?: { [key: string]: any }
) {
  return request<API.BaseResponseAppVO>('/app/get/vo', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 POST /app/good/list/page/vo */
export async function listGoodAppVoByPage(
  body: API.AppQueryRequest,
  options?: { [key: string]: any }
) {
  return request<API.BaseResponsePageAppVO>('/app/good/list/page/vo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 POST /app/my/list/page/vo */
export async function listMyAppVoByPage(
  body: API.AppQueryRequest,
  options?: { [key: string]: any }
) {
  return request<API.BaseResponsePageAppVO>('/app/my/list/page/vo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 POST /app/update */
export async function updateApp(body: API.AppUpdateRequest, options?: { [key: string]: any }) {
  return request<API.BaseResponseBoolean>('/app/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  })
}
