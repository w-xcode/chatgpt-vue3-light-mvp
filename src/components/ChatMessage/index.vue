<script lang="ts" setup>
import { renderMarkdownText } from '@/components/MarkdownPreview/plugins/markdown'
import type { ChatMessage } from '@/types/chat'

interface Props {
  message: ChatMessage
}

const props = defineProps<Props>()
const emit = defineEmits<{ retry: [message: ChatMessage] }>()

const emotionStore = useEmotionStore()

const isUser = computed(() => props.message.role === 'user')
const isFailed = computed(() => props.message.status === 'failed')

const report = computed(() => emotionStore.getReportByMessage(props.message.id))

const renderedHtml = computed(() => {
  return renderMarkdownText(props.message.content)
})

const riskTagType = (risk: string) => {
  if (risk === 'high') return 'error'
  if (risk === 'medium') return 'warning'
  return 'success'
}
</script>

<template>
  <div
    flex="~ col"
    :class="[
      isUser ? 'items-end' : 'items-start'
    ]"
    mb-16px
  >
    <div
      text-12
      mb-4px
      :class="isUser ? 'c-#999' : 'c-primary/70'"
    >
      {{ isUser ? 'You' : 'AI' }}
    </div>
    <div
      v-if="isUser"
      class="max-w-70% px-14px py-10px rounded-12px bg-primary c-white text-15 leading-relaxed whitespace-pre-wrap"
    >
      {{ message.content }}
    </div>
    <div
      v-else
      class="max-w-85%"
    >
      <div class="px-14px py-10px rounded-12px bg-#f5f5f5 c-#333 text-15 leading-relaxed">
        <div v-if="isFailed">
          <div class="markdown-body" v-html="renderedHtml"></div>
          <div flex="~ justify-end" mt-4px>
            <n-button text type="error" size="tiny" @click="emit('retry', message)">重新生成</n-button>
          </div>
        </div>
        <div
          v-else
          class="markdown-body"
          v-html="renderedHtml"
        ></div>
      </div>
      <div v-if="report" flex="~ wrap" gap="4px" mt-6px>
        <n-tag
          v-for="label in report.emotionLabels"
          :key="label"
          size="small"
          :type="riskTagType(report.riskLevel)"
        >
          {{ label }}
        </n-tag>
        <n-tag size="small" :bordered="false" type="info">
          情绪分: {{ report.score }}
        </n-tag>
      </div>
    </div>
  </div>
</template>
