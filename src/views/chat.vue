<script lang="ts" setup>
import { modelMappingList, triggerModelTermination } from '@/components/MarkdownPreview/models'
import type { SelectBaseOption } from 'naive-ui/es/select/src/interface'
import { useSessionStore } from '@/store/session'
import { useMessageStore } from '@/store/message'

const router = useRouter()
const businessStore = useBusinessStore()
const sessionStore = useSessionStore()
const messageStore = useMessageStore()
const emotionStore = useEmotionStore()

const modelListSelections = computed(() => {
  return modelMappingList.map<SelectBaseOption>((modelItem) => ({
    label: modelItem.label,
    value: modelItem.modelName,
    disabled: false
  }))
})

const refMessageList = ref<any>()
const refChatInput = ref<any>()

const loading = ref(true)
setTimeout(() => {
  loading.value = false
}, 700)

onMounted(() => {
  sessionStore.loadFromStorage()
  messageStore.loadFromStorage()
  emotionStore.loadFromStorage()
  messageStore.recoverIncompleteMessages()
  nextTick(() => refChatInput.value?.focus())
})

const handleCreateSession = () => {
  if (messageStore.isStreaming) {
    messageStore.abortActiveStream()
    triggerModelTermination()
  }
  sessionStore.createSession()
  nextTick(() => refChatInput.value?.focus())
}

watch(
  () => sessionStore.activeSessionId,
  () => {
    if (messageStore.isStreaming) {
      messageStore.abortActiveStream()
      triggerModelTermination()
    }
    nextTick(() => {
      refMessageList.value?.scrollToBottom()
      refChatInput.value?.focus()
    })
  }
)

const handleSend = async (text: string) => {
  // Ensure active session
  if (!sessionStore.activeSessionId) {
    sessionStore.createSession()
  }
  const sessionId = sessionStore.activeSessionId!

  // Add user message
  messageStore.addUserMessage(sessionId, text)
  sessionStore.updateSessionTimestamp(sessionId)

  // Generate title from first message
  if (messageStore.currentMessages.length === 1) {
    sessionStore.generateTitle(sessionId, text)
  }

  // Scroll to bottom
  nextTick(() => refMessageList.value?.scrollToBottom())

  // Add placeholder assistant message
  const assistantMsg = messageStore.addAssistantMessage(sessionId)

  // Build messages array for API
  const { error, reader } = await businessStore.createAssistantWriterStylized({
    messages: messageStore.apiMessages
  })

  if (error || !reader) {
    messageStore.failMessage(assistantMsg.id)
    triggerModelTermination()
    window.$ModalMessage.error('请求失败，请重试')
    return
  }

  messageStore.setActiveReader(reader)

  // Read stream
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const content = businessStore.currentModelItem?.transformStreamValue?.(value, new TextDecoder())
      if (!content) continue
      if ('done' in content && content.done) break

      const text = 'content' in content ? content.content : ''
      if (text) {
        messageStore.appendToMessage(assistantMsg.id, text)
      }
    }
    messageStore.completeMessage(assistantMsg.id)
    sessionStore.updateSessionTimestamp(sessionId)

    // Fire-and-forget emotion analysis
    const completedMsg = messageStore.currentMessages.find(m => m.id === assistantMsg.id)
    if (completedMsg) {
      emotionStore.analyzeEmotion(completedMsg, sessionId).catch(() => {})
    }
  } catch {
    messageStore.failMessage(assistantMsg.id)
  } finally {
    messageStore.clearActiveReader()
    triggerModelTermination()
    nextTick(() => refMessageList.value?.scrollToBottom())
  }
}

const handleStop = () => {
  messageStore.abortActiveStream()
  triggerModelTermination()
}
</script>

<template>
  <LayoutCenterPanel :loading="loading">
    <template #sidebar-header>
      <SessionHeader @create="handleCreateSession" />
    </template>
    <template #sidebar>
      <SessionList />
    </template>
    <template #sidebar-action>
      <n-button quaternary block @click="router.push('/dashboard')">
        <template #icon>
          <span>📊</span>
        </template>
        情绪看板
      </n-button>
    </template>
    <div flex="~ col" h-full>
      <div flex="~ justify-between items-center">
        <NavigationNavBar>
          <template #right>
            <div flex="~ justify-center items-center wrap" class="text-16 line-height-16">
              <span class="lt-xs:hidden">当前模型：</span>
              <div flex="~ justify-center items-center">
                <n-select
                  v-model:value="businessStore.systemModelName"
                  class="w-280 lt-xs:w-260 pr-10 font-italic font-bold"
                  placeholder="请选择模型"
                  :disabled="messageStore.isStreaming"
                  :options="modelListSelections"
                />
              </div>
            </div>
          </template>
        </NavigationNavBar>
      </div>
      <ChatMessageList
        ref="refMessageList"
        :messages="messageStore.currentMessages"
      />
      <ChatInput
        ref="refChatInput"
        :loading="messageStore.isStreaming"
        :disabled="false"
        @send="handleSend"
        @stop="handleStop"
      />
    </div>
  </LayoutCenterPanel>
</template>
