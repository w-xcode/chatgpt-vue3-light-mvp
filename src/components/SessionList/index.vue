<script lang="ts" setup>
import { useSessionStore } from '@/store/session'

const sessionStore = useSessionStore()

const editingId = ref<string | null>(null)
const editingTitle = ref('')

watch(() => sessionStore.activeSessionId, () => {
  editingId.value = null
  editingTitle.value = ''
})

const handleEdit = (id: string) => {
  const session = sessionStore.sessions.find(s => s.id === id)
  if (!session) return
  editingId.value = id
  editingTitle.value = session.title
}

const handleRename = () => {
  if (editingId.value && editingTitle.value.trim()) {
    sessionStore.renameSession(editingId.value, editingTitle.value.trim())
  }
  editingId.value = null
  editingTitle.value = ''
}

const handleRemove = (id: string) => {
  sessionStore.deleteSession(id)
}
</script>

<template>
  <div flex="~ col" gap="4px">
    <SideBarItem
      v-for="session in sessionStore.sessions"
      :key="session.id"
      :active="session.id === sessionStore.activeSessionId"
      @click="sessionStore.setActiveSession(session.id)"
      @edit="handleEdit(session.id)"
      @remove="handleRemove(session.id)"
    >
      <template v-if="editingId === session.id">
        <n-input
          v-model:value="editingTitle"
          size="tiny"
          autofocus
          @blur="handleRename"
          @keyup.enter="handleRename"
        />
      </template>
      <template v-else>
        {{ session.title }}
      </template>
    </SideBarItem>
  </div>
</template>
