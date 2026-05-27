<script lang="ts" setup>
import type { EmotionReport } from '@/types/chat'

interface Props {
  report: EmotionReport
}

const props = defineProps<Props>()

const riskColor = computed(() => {
  if (props.report.riskLevel === 'high') return '#e74c3c'
  if (props.report.riskLevel === 'medium') return '#f39c12'
  return '#27ae60'
})

const riskLabel = computed(() => {
  if (props.report.riskLevel === 'high') return '需干预'
  if (props.report.riskLevel === 'medium') return '需关注'
  return '正常'
})

const scorePercent = computed(() => Math.round(props.report.score * 10))
</script>

<template>
  <n-card size="small" :bordered="true">
    <div flex="~ col" gap="12px">
      <div flex="~ justify-between items-center">
        <span text-14 font-bold c-#333>情绪分析报告</span>
        <n-tag :color="{ color: riskColor + '20', textColor: riskColor, borderColor: riskColor }" size="small">
          {{ riskLabel }}
        </n-tag>
      </div>

      <div>
        <div text-12 c-#999 mb-4px>情绪评分</div>
        <n-progress
          type="line"
          :percentage="scorePercent"
          :color="riskColor"
          :show-indicator="true"
          style="max-width: 200px"
        >
          <span text-12 font-bold>{{ report.score }} / 10</span>
        </n-progress>
      </div>

      <div v-if="report.emotionLabels.length">
        <div text-12 c-#999 mb-4px>情绪标签</div>
        <div flex="~ wrap" gap="4px">
          <n-tag v-for="label in report.emotionLabels" :key="label" size="small" :bordered="false" type="info">
            {{ label }}
          </n-tag>
        </div>
      </div>

      <div v-if="report.keywords.length">
        <div text-12 c-#999 mb-4px>关键词</div>
        <div flex="~ wrap" gap="4px">
          <n-tag v-for="kw in report.keywords" :key="kw" size="small" :bordered="false">
            {{ kw }}
          </n-tag>
        </div>
      </div>

      <div v-if="report.suggestions.length">
        <div text-12 c-#999 mb-4px>建议</div>
        <n-list size="small" :show-divider="false">
          <n-list-item v-for="(s, i) in report.suggestions" :key="i">
            <div text-13 c-#555>{{ i + 1 }}. {{ s }}</div>
          </n-list-item>
        </n-list>
      </div>
    </div>
  </n-card>
</template>
