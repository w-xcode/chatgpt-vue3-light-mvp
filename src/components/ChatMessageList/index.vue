<script lang="ts" setup>
import type { ChatMessage } from '@/types/chat'

interface Props {
  messages: ChatMessage[]
}

const props = defineProps<Props>()

const scrollRef = ref<HTMLElement>()

const scrollToBottom = () => {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  })
}

watch(
  () => props.messages?.length,
  () => scrollToBottom()
)

// Also scroll when streaming content grows
watch(
  () => {
    const msgs = props.messages
    if (!msgs?.length) return ''
    const last = msgs[msgs.length - 1]
    return last?.status === 'streaming' ? last.content : ''
  },
  () => scrollToBottom()
)

defineExpose({ scrollToBottom })
</script>

<template>
  <div
    ref="scrollRef"
    flex="1"
    overflow-y-auto
    min-h-0
    p="20px"
  >
    <div v-if="!messages?.length" flex="~ col" justify-center items-center h-full c="#aaa">
      <div text-48 mb-12px>💬</div>
      <div text-16>开始新的对话吧</div>
    </div>
    <ChatMessage
      v-for="msg in messages"
      :key="msg.id"
      :message="msg"
    />
  </div>
</template>
