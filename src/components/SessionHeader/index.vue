<script lang="ts" setup>
const emit = defineEmits<{
  create: []
}>()
</script>

<template>
  <div flex="~ justify-between items-center" px="20px" py="14px">
    <span text-16 font-bold c-#333>会话列表</span>
    <n-button
      type="primary"
      size="small"
      @click="emit('create')"
    >
      <template #icon>
        <span>+</span>
      </template>
      新建会话
    </n-button>
  </div>
</template>
