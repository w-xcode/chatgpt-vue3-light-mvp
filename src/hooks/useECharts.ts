import * as echarts from 'echarts'
import type { Ref } from 'vue'

export function useECharts(containerRef: Ref<HTMLElement | undefined>) {
  let chart: echarts.ECharts | null = null

  const init = () => {
    if (containerRef.value && !chart) {
      chart = echarts.init(containerRef.value)
    }
  }

  const setOption = (option: echarts.EChartsOption) => {
    if (!chart) init()
    chart?.setOption(option, true)
  }

  const handleResize = () => {
    chart?.resize()
  }

  onMounted(() => {
    init()
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    chart?.dispose()
    chart = null
  })

  return { setOption, chart: () => chart }
}
