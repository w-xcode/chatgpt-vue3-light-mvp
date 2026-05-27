<script lang="ts" setup>
import { useEmotionStore } from '@/store/emotion'
import { useSessionStore } from '@/store/session'
import { useMessageStore } from '@/store/message'

const router = useRouter()
const emotionStore = useEmotionStore()
const sessionStore = useSessionStore()
const messageStore = useMessageStore()

onMounted(() => {
  sessionStore.loadFromStorage()
  messageStore.loadFromStorage()
  emotionStore.loadFromStorage()
})

const allReports = computed(() => emotionStore.allReports)
const hasData = computed(() => allReports.value.length > 0)

// Trend chart
const trendRef = ref<HTMLElement>()
const { setOption: setTrendOption } = useECharts(trendRef)

watch(allReports, (reports) => {
  if (!reports.length) return
  const sorted = [...reports].sort((a, b) => a.timestamp - b.timestamp)
  setTrendOption({
    title: { text: '情绪趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: sorted.map(r => new Date(r.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })),
      axisLabel: { rotate: 30, fontSize: 11 },
    },
    yAxis: { type: 'value', min: 0, max: 10, name: '情绪分' },
    series: [{
      type: 'line',
      data: sorted.map(r => r.score),
      smooth: true,
      areaStyle: { opacity: 0.15 },
      itemStyle: { color: '#6366f1' },
    }],
    grid: { left: 50, right: 20, bottom: 60, top: 40 },
  })
}, { immediate: true })

// Pie chart
const pieRef = ref<HTMLElement>()
const { setOption: setPieOption } = useECharts(pieRef)

watch(allReports, (reports) => {
  if (!reports.length) return
  const labelCount: Record<string, number> = {}
  for (const r of reports) {
    for (const label of r.emotionLabels) {
      labelCount[label] = (labelCount[label] || 0) + 1
    }
  }
  const data = Object.entries(labelCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  setPieOption({
    title: { text: '情绪分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}次 ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      data,
      label: { show: true, formatter: '{b}\n{d}%' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
    }],
  })
}, { immediate: true })

// Keywords bar chart
const keywordRef = ref<HTMLElement>()
const { setOption: setKeywordOption } = useECharts(keywordRef)

watch(allReports, (reports) => {
  if (!reports.length) return
  const kwCount: Record<string, number> = {}
  for (const r of reports) {
    for (const kw of r.keywords) {
      kwCount[kw] = (kwCount[kw] || 0) + 1
    }
  }
  const sorted = Object.entries(kwCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  setKeywordOption({
    title: { text: '关键词排行', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: sorted.map(([k]) => k).reverse(),
      axisLabel: { fontSize: 12 },
    },
    series: [{
      type: 'bar',
      data: sorted.map(([, v]) => v).reverse(),
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [
            { offset: 0, color: '#6366f1' },
            { offset: 1, color: '#a78bfa' },
          ],
        },
        borderRadius: [0, 4, 4, 0],
      },
    }],
    grid: { left: 80, right: 30, bottom: 20, top: 40 },
  })
}, { immediate: true })

const loading = ref(true)
setTimeout(() => { loading.value = false }, 500)
</script>

<template>
  <LayoutCenterPanel :loading="loading">
    <template #sidebar-header>
      <div flex="~ justify-between items-center" px="20px" py="14px">
        <span text-16 font-bold c-#333>情绪看板</span>
      </div>
    </template>
    <template #sidebar>
      <SessionList />
    </template>
    <template #sidebar-action>
      <n-button quaternary block @click="router.push('/chat')">
        <template #icon>
          <span>💬</span>
        </template>
        返回对话
      </n-button>
    </template>
    <div flex="~ col" h-full overflow-y-auto p="20px" gap="20px">
      <div v-if="!hasData" flex="~ col" justify-center items-center h-full c="#aaa">
        <div text-48 mb-12px>📊</div>
        <div text-16>暂无情绪数据</div>
        <div text-13 mt-4px>开始对话后，系统会自动分析情绪</div>
      </div>
      <template v-else>
        <div ref="trendRef" style="height: 300px; width: 100%"></div>
        <div flex="~ row" gap="20px" style="min-height: 300px">
          <div ref="pieRef" flex-1 style="height: 300px"></div>
          <div ref="keywordRef" flex-1 style="height: 300px"></div>
        </div>
        <EmotionReport
          v-if="allReports.length"
          :report="allReports[allReports.length - 1]"
        />
      </template>
    </div>
  </LayoutCenterPanel>
</template>
