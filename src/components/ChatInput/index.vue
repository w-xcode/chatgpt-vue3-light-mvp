<script lang="tsx" setup>
import { type InputInst } from 'naive-ui'
import { UAParser } from 'ua-parser-js'

interface Props {
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false
})

const emit = defineEmits<{
  send: [text: string]
  stop: []
}>()

const inputText = ref('')
const refInput = ref<InputInst | null>()

const parser = new UAParser()
const isMacos = computed(() => {
  const os = parser.getOS()
  if (!os) return false
  return (os.name ?? '').toLocaleLowerCase().includes('macos')
})

const placeholder = computed(() => {
  if (props.loading) return '输入任意问题...'
  return `输入任意问题, 按 ${isMacos.value ? 'Command' : 'Ctrl'} + Enter 键快捷开始...`
})

const handleSend = () => {
  if (props.loading) {
    emit('stop')
    return
  }
  const text = inputText.value.trim()
  if (!text) {
    refInput.value?.focus()
    return
  }
  emit('send', text)
  inputText.value = ''
}

const focus = () => {
  nextTick(() => refInput.value?.focus())
}

defineExpose({ focus })

const PromptTag = defineComponent({
  props: {
    text: { type: String, default: '' }
  },
  setup(p) {
    const handleClick = () => {
      inputText.value = p.text
      nextTick(() => refInput.value?.focus())
    }
    return { handleClick }
  },
  render() {
    return (
      <div
        b="~ solid transparent"
        hover="shadow-[--shadow] b-primary bg-#e8e8e8"
        class={[
          'px-10 py-2 rounded-7 text-12',
          'max-w-230 transition-all-300 select-none cursor-pointer',
          'c-#525252 bg-#ededed'
        ]}
        style={{ '--shadow': '3px 3px 3px -1px rgba(0,0,0,0.1)' }}
        onClick={this.handleClick}
      >
        <n-ellipsis
          tooltip={{ contentClass: 'wrapper-tooltip-scroller', keepAliveOnHover: true }}
        >
          {{ tooltip: () => this.text, default: () => this.text }}
        </n-ellipsis>
      </div>
    )
  }
})

const promptTextList = ref([
  '打个招呼吧，并告诉我你的名字',
  '使用中文，回答以下两个问题，分段表示\n1、你是什么模型？\n2、请分别使用 Vue3 和 React 编写一个 Button 组件'
])

const keys = useMagicKeys()
const enterCommand = keys['Meta+Enter']
const enterCtrl = keys['Ctrl+Enter']
const activeElement = useActiveElement()
const notUsingInput = computed(() => activeElement.value?.tagName !== 'TEXTAREA')

watch(
  () => enterCommand.value,
  () => {
    if (!isMacos.value || notUsingInput.value) return
    if (!enterCommand.value) handleSend()
  }
)

watch(
  () => enterCtrl.value,
  () => {
    if (isMacos.value || notUsingInput.value) return
    if (!enterCtrl.value) handleSend()
  }
)
</script>

<template>
  <div
    flex="~ col items-center"
    flex-basis="10%"
    p="14px"
    py="0"
  >
    <div w-full flex="~ justify-start" class="px-1em pb-10">
      <n-space>
        <PromptTag
          v-for="(textItem, idx) in promptTextList"
          :key="idx"
          :text="textItem"
        />
      </n-space>
    </div>
    <div relative flex="1" w-full px-1em>
      <n-input
        ref="refInput"
        v-model:value="inputText"
        type="textarea"
        autofocus
        h-full
        class="textarea-resize-none text-15"
        :style="{
          '--n-border-radius': '20px',
          '--n-padding-left': '20px',
          '--n-padding-right': '20px',
          '--n-padding-vertical': '10px',
        }"
        :placeholder="placeholder"
        :disabled="disabled"
      />
      <n-float-button
        position="absolute"
        :right="40"
        bottom="50%"
        :type="loading ? 'primary' : 'default'"
        color
        :class="[loading && 'opacity-90', 'translate-y-50%']"
        @click.stop="handleSend()"
      >
        <div v-if="loading" c-#fff text-14>...</div>
        <div v-else class="transform-rotate-z--90 text-22 c-#303133/70">↑</div>
      </n-float-button>
    </div>
  </div>
</template>
