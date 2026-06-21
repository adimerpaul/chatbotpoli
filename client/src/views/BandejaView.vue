<template>
  <div class="bandeja">
    <!-- Backdrop para cerrar CasoPanel en tablet -->
    <div v-if="store.showCasoPanel" class="caso-backdrop" @click="store.showCasoPanel=false"></div>

    <!-- Lista de conversaciones -->
    <div class="p-list" :class="{ 'mob-active': store.mobileView === 'list' }">
      <ConvList />
    </div>

    <!-- Chat -->
    <div class="p-chat" :class="{ 'mob-active': store.mobileView === 'chat' }">
      <ChatPanel v-if="store.selected" />
      <div v-else class="empty-state">Selecciona una conversación de la bandeja</div>
    </div>

    <!-- Panel de caso -->
    <div class="p-caso" :class="{ 'mob-active': store.mobileView === 'caso', 'caso-open': store.showCasoPanel }">
      <CasoPanel v-if="store.selected" />
    </div>
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
.bandeja { height: 100%; display: flex; position: relative; overflow: hidden; }

/* Desktop: los wrappers son flex-items directos */
.p-list { display: flex; flex: 0 0 384px; min-height: 0; }
.p-chat { display: flex; flex: 1; min-width: 0; min-height: 0; }
.p-caso { display: flex; flex: 0 0 366px; min-height: 0; }

.empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #9aa6b6; font-size: 14px; background: #f7f9fc; }

/* ── Tablet (768–1150px) ─────────────────────────────── */
@media (min-width: 768px) and (max-width: 1150px) {
  .p-list { flex: 0 0 280px; }
  .p-chat { flex: 1; }
  .p-caso {
    position: fixed;
    right: 0; top: 62px; bottom: 0;
    width: 340px;
    flex: none;
    z-index: 500;
    transform: translateX(100%);
    transition: transform .3s ease;
    background: #fff;
    box-shadow: -4px 0 24px rgba(0,0,0,.14);
    overflow: auto;
  }
  .p-caso.caso-open { transform: translateX(0); }
  .caso-backdrop {
    position: fixed; inset: 0; z-index: 499;
    background: rgba(0,0,0,.3);
  }
}

/* ── Móvil (< 768px) ─────────────────────────────────── */
@media (max-width: 767px) {
  .p-list, .p-chat, .p-caso {
    position: absolute; inset: 0;
    flex: none;
    display: none;
  }
  .p-list.mob-active, .p-chat.mob-active, .p-caso.mob-active { display: flex; }
  .caso-backdrop { display: none; }
}
</style>
