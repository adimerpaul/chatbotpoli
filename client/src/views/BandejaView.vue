<template>
  <div class="bandeja">
    <ConvList />
    <template v-if="store.selected">
      <ChatPanel />
      <CasoPanel />
    </template>
    <div v-else class="empty-state">Selecciona una conversación de la bandeja</div>
  </div>
</template>
<script setup>
import { useConversationsStore } from '@/stores/conversations'
import ConvList from '@/components/ConvList.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import CasoPanel from '@/components/CasoPanel.vue'
const store = useConversationsStore()
</script>
<style scoped>
.bandeja{height:100%;display:flex}
.empty-state{flex:1;display:flex;align-items:center;justify-content:center;color:#9aa6b6;font-size:14px;background:#f7f9fc}
</style>
