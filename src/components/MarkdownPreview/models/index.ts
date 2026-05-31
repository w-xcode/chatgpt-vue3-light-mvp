import type { ApiMessage } from '@/types/chat'

/**
 * 转义处理响应值为 data: 的 json 字符串
 */
export const createParser = () => {
  let keepAliveShown = false

  const resetKeepAliveParser = () => {
    keepAliveShown = false
  }

  const parseJsonLikeData = (content: string) => {

    // 若是终止信号，则直接结束
    if (content === '[DONE]') {
      // 重置 keepAlive 标志
      keepAliveShown = false
      return {
        done: true
      }
    }

    if (content.startsWith('data: ')) {
      keepAliveShown = false
      const dataString = content.substring(6).trim()
      if (dataString === '[DONE]') {
        return {
          done: true
        }
      }
      try {
        return JSON.parse(dataString)
      } catch (error) {
        console.error('JSON 解析错误：', error)
      }
    }

    // 尝试直接解析 JSON 字符串
    try {
      const trimmedContent = content.trim()

      if (trimmedContent === ': keep-alive') {
        // 如果还没有显示过 keep-alive 提示，则显示
        if (!keepAliveShown) {
          keepAliveShown = true
          return {
            isWaitQueuing: true
          }
        } else {
          return null
        }
      }

      if (!trimmedContent) {
        return null // 空内容，直接忽略
      }

      if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
        return JSON.parse(trimmedContent) // 是 JSON 对象，直接解析
      }
      if (trimmedContent.startsWith('[') && trimmedContent.endsWith(']')) {
        return JSON.parse(trimmedContent) // 是 JSON 数组，直接解析
      }
    } catch (error) {
      console.error('尝试直接解析 JSON 失败：', error)
    }

    return null
  }
  return {
    resetKeepAliveParser,
    parseJsonLikeData
  }
}

export const createStreamThinkTransformer = () => {
  let isThinking = false

  const resetThinkTransformer = () => {
    isThinking = false
  }

  const transformStreamThinkData = (content) => {
    const stream = parseJsonLikeData(content)

    if (stream && stream.done) {
      return {
        done: true
      }
    }

    // DeepSeek 存在限速问题，这里做一个简单处理
    // https://api-docs.deepseek.com/zh-cn/quick_start/rate_limit
    if (stream && stream.isWaitQueuing) {
      return {
        isWaitQueuing: stream.isWaitQueuing
      }
    }

    if (!stream || !stream.choices || stream.choices.length === 0) {
      return {
        content: ''
      }
    }

    const delta = stream.choices[0].delta
    const contentText = delta.content || ''
    const reasoningText = delta.reasoning_content || ''

    let transformedContent = ''

    // 开始处理推理过程
    if (delta.content === null && delta.reasoning_content !== null) {
      if (!isThinking) {
        transformedContent += '<think>'
        isThinking = true
      }
      transformedContent += reasoningText
    }
    // 当 content 出现时，说明推理结束
    else if (delta.content !== null && delta.reasoning_content === null) {
      if (isThinking) {
        transformedContent += '</think>\n\n'
        isThinking = false
      }
      transformedContent += contentText
    }
    // 当为普通模型，即不包含推理字段时，直接追加 content
    else if (delta.content !== null && delta.reasoning_content === undefined) {
      isThinking = false
      transformedContent += contentText
    }

    return {
      content: transformedContent
    }
  }

  return {
    resetThinkTransformer,
    transformStreamThinkData
  }
}

const { resetKeepAliveParser, parseJsonLikeData } = createParser()
const { resetThinkTransformer, transformStreamThinkData } = createStreamThinkTransformer()


/**
 * 处理大模型调用暂停、异常或结束后触发的操作
 */
export const triggerModelTermination = () => {
  resetKeepAliveParser()
  resetThinkTransformer()
}

type ContentResult = {
  content: any
} | {
  done: boolean
} | {
  isWaitQueuing: boolean
}

export type TransformFunction = (readValue: Uint8Array | string, textDecoder: TextDecoder) => ContentResult

interface TypesModelLLM {
  // 模型昵称
  label: string
  // 模型标识符
  modelName: string
  // Stream 结果转换器
  transformStreamValue: TransformFunction
  // 每个大模型调用的 API 请求
  chatFetch: (messages: ApiMessage[]) => Promise<Response>
}


/** ---------------- 大模型映射列表 & Response Transform 用于处理不同类型流的值转换器 ---------------- */

/**
 * 项目默认使用模型，按需修改此字段即可
 */
export const defaultModelName = 'deepseek-v3'

export const modelMappingList: TypesModelLLM[] = [
  {
    label: '🐋 DeepSeek-V3',
    modelName: 'deepseek-v3',
    transformStreamValue(readValue) {
      const stream = transformStreamThinkData(readValue)
      if (stream.done) {
        return {
          done: true
        }
      }
      if (stream.isWaitQueuing) {
        return {
          isWaitQueuing: stream.isWaitQueuing
        }
      }
      return {
        content: stream.content
      }
    },
    // Event Stream 调用大模型接口 DeepSeek 深度求索 (Fetch 调用)
    chatFetch(messages: ApiMessage[]) {
      const url = new URL(`${ location.origin }/deepseek/chat/completions`)

      const req = new Request(url, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'model': 'deepseek-chat',
          stream: true,
          messages
        })
      })
      return fetch(req)
    }
  },
  {
    label: '🐋 DeepSeek-R1 (推理模型)',
    modelName: 'deepseek-deep',
    transformStreamValue(readValue) {
      const stream = transformStreamThinkData(readValue)
      if (stream.done) {
        return {
          done: true
        }
      }
      if (stream.isWaitQueuing) {
        return {
          isWaitQueuing: stream.isWaitQueuing
        }
      }
      return {
        content: stream.content
      }
    },
    // Event Stream 调用大模型接口 DeepSeek 深度求索 (Fetch 调用)
    chatFetch(messages: ApiMessage[]) {
      const url = new URL(`${ location.origin }/deepseek/chat/completions`)

      const req = new Request(url, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'model': 'deepseek-reasoner',
          stream: true,
          messages
        })
      })
      return fetch(req)
    }
  }
]
