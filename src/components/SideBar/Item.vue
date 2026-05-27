<script lang="ts" setup>
interface Props {
  active?: boolean
}
withDefaults(
  defineProps<Props>(),
  {
    active: false
  }
)


const emit = defineEmits([
  'click',
  'edit',
  'remove'
])
</script>

<template>
  <div
    flex="~ justify-between"
    py="10px"
    px="14px"
    rounded-8px
    cursor-pointer
    class="group font-bold transition-colors-260 b b-solid"
    :class="[
      active
        ? 'c-primary b-primary'
        : 'hover:b-info/50 c-#303133 b-transparent'
    ]"
    @click="emit('click')"
  >
    <div
      flex="1"
      text-nowrap
      text-ellipsis
      overflow-x-hidden
      pr-6px
    >
      <slot></slot>
    </div>
    <div
      class="transition-colors-200 text-16 rounded-4px cursor-pointer"
      px="4"
      :class="[
        active
          ? 'c-#666 hover:c-primary hover:bg-primary/10'
          : 'c-#aaa hover:c-primary hover:bg-primary/10'
      ]"
      flex="~ justify-center items-center"
      @click.stop="emit('edit')"
    >
      <span text-12>edit</span>
    </div>
    <n-popconfirm
      @positive-click="emit('remove')"
    >
      <template #trigger>
        <div
          class="transition-colors-200 text-16 rounded-4px cursor-pointer"
          px="4"
          :class="[
            active
              ? 'c-#666 hover:c-error hover:bg-error/10'
              : 'c-#aaa hover:c-error hover:bg-error/10'
          ]"
          flex="~ justify-center items-center"
          @click.stop
        >
          <span text-12>del</span>
        </div>
      </template>
      确认删除？
    </n-popconfirm>
  </div>
</template>

<style lang="scss" scoped>

</style>
