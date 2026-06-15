<template>
  <section class="chat-panel">
    <div class="chat-header">
      <div class="av" :style="avStyle(sel.tipo)">{{ sel.initials }}</div>
      <div class="hinfo">
        <div class="htitle-row">
          <span class="hname">{{ sel.name }}</span>
          <span class="badge" :style="bs(tipoCol(sel.tipo))">{{ sel.tipo }}</span>
        </div>
        <div class="hmeta">{{ sel.id }} · {{ sel.channel }}<span v-if="sel.phone"> · +{{ sel.phone }}</span></div>
      </div>
      <div class="hright">
        <div class="responder-toggle">
          <span class="toggle-lbl" :class="{active: isBotActive}">Bot IA</span>
          <button class="toggle-track" :class="{human: !isBotActive}" @click="toggleResponder" :title="isBotActive?'Cambiar a persona':'Cambiar a Bot IA'">
            <span class="toggle-thumb"></span>
          </button>
          <span class="toggle-lbl" :class="{active: !isBotActive}">Persona</span>
        </div>
        <div class="toggle-sub">
          <span v-if="isBotActive">Responde el asistente IA</span>
          <span v-else>Responde <strong>{{ operatorName }}</strong></span>
        </div>
      </div>
    </div>

    <div ref="threadEl" class="thread">
      <div v-for="(m,i) in sel.messages" :key="i">
        <div v-if="m.from==='sistema'" class="sys-msg"><span>{{ m.text }}</span></div>
        <div v-else class="msg-row" :class="m.from==='agente'?'right':'left'">
          <div class="msg-inner">
            <span v-if="m.from==='bot'||m.from==='agente'" class="sender" :class="m.from">
              {{ m.from==='agente'?(sel.agente==='Sin asignar'?'Operador':sel.agente):'Asistente IA · Bot' }}
            </span>
            <div class="bubble" :class="m.from">
              <template v-if="m.type==='image'&&m.mediaUrl">
                <a :href="m.mediaUrl" target="_blank"><img :src="m.mediaUrl" class="mimg" @error="e=>e.target.style.display='none'" /></a>
                <div v-if="m.text" class="mcaption">{{ m.text }}</div>
              </template>
              <template v-else-if="m.type==='video'&&m.mediaUrl">
                <video :src="m.mediaUrl" controls class="mvid"></video>
                <div v-if="m.text" class="mcaption">{{ m.text }}</div>
              </template>
              <template v-else-if="m.type==='audio'&&m.mediaUrl">
                <div class="mlabel">{{ m.text||'Audio' }}</div>
                <audio :src="m.mediaUrl" controls class="maudio"></audio>
              </template>
              <a v-else-if="m.type==='document'&&m.mediaUrl" :href="m.mediaUrl" target="_blank" download class="mdoc">
                <span>📄</span><span>{{ m.text||'Archivo' }}</span>
              </a>
              <a v-else-if="m.type==='location'&&m.lat!==undefined" :href="`https://maps.google.com/?q=${m.lat},${m.lng}`" target="_blank" class="mloc">
                <span style="font-size:26px">📍</span>
                <div><div class="loc-title">Ubicación compartida</div><div class="loc-coords">{{ m.lat.toFixed(5) }}, {{ m.lng.toFixed(5) }}</div><div class="loc-link">Ver en Google Maps ↗</div></div>
              </a>
              <span v-else style="white-space:pre-wrap">{{ m.text||'' }}</span>
            </div>
            <span class="mtime">{{ m.time }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="composer">
      <div class="comp-inner">
        <input v-model="text" placeholder="Escribe una respuesta al ciudadano…" class="comp-inp" @keydown.enter.prevent="send" />
        <button class="btn-send" @click="send">Enviar</button>
      </div>
      <div class="comp-hint">El asistente IA seguirá clasificando la conversación automáticamente.</div>
    </div>
  </section>
</template>
<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import { useAuthStore } from '@/stores/auth'
const store = useConversationsStore()
const auth  = useAuthStore()
const sel = computed(() => store.selected)
const isBotActive = computed(() => sel.value?.agente === 'Sin asignar')
const operatorName = computed(() => auth.user?.nombre || auth.user?.username || 'Operador')
const text = ref('')
const threadEl = ref(null)
watch(() => sel.value?.messages?.length, async () => { await nextTick(); if(threadEl.value) threadEl.value.scrollTop=threadEl.value.scrollHeight }, { immediate:true })
async function send() {
  const t=text.value.trim(); if(!t||!sel.value) return
  text.value=''
  const u = await fetch(`/api/conversations/${sel.value.id}/send`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})}).then(r=>r.json())
  store.upsert(u)
}
async function toggleResponder() {
  if (!sel.value) return
  const agente = isBotActive.value ? operatorName.value : 'Sin asignar'
  const u = await fetch(`/api/conversations/${sel.value.id}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({agente})}).then(r=>r.json())
  store.upsert(u)
}
const tipoCol = t => ({Emergencia:['#c0392b','#fbe9e7'],Denuncia:['#b9751a','#fbf1e0'],Consulta:['#2f6fed','#e7f0ff']})[t]||['#5a6b82','#eef1f6']
const avStyle = t => { const [fg,bg]=tipoCol(t); return {width:'38px',height:'38px',borderRadius:'11px',background:bg,color:fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'600',fontSize:'14px',flexShrink:'0'} }
const bs = ([fg,bg]) => ({display:'inline-flex',padding:'3px 10px',borderRadius:'999px',fontSize:'11px',fontWeight:'600',color:fg,background:bg})
</script>
<style scoped>
.chat-panel{flex:1;min-width:0;display:flex;flex-direction:column;background:#f7f9fc;min-height:0}
.chat-header{padding:13px 20px;background:#fff;border-bottom:1px solid #e0e5ee;display:flex;align-items:center;gap:13px;flex-shrink:0}
.av{flex-shrink:0}.hinfo{flex:1;min-width:0}
.htitle-row{display:flex;align-items:center;gap:9px}
.hname{font-weight:700;font-size:15px;color:#15233a}
.hmeta{font-size:12px;color:#7a8699;margin-top:2px;font-family:'IBM Plex Mono',monospace}
.hright{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.responder-toggle{display:flex;align-items:center;gap:8px}
.toggle-lbl{font-size:12px;color:#9aa6b6;font-weight:500;transition:color .2s}
.toggle-lbl.active{color:#15233a;font-weight:700}
.toggle-track{position:relative;width:40px;height:22px;border-radius:999px;border:none;cursor:pointer;padding:0;transition:background .25s;background:#9aa6b6;flex-shrink:0}
.toggle-track.human{background:#2f6fed}
.toggle-thumb{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .25s;display:block;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.toggle-track.human .toggle-thumb{transform:translateX(18px)}
.toggle-sub{font-size:11px;color:#7a8699}
.toggle-sub strong{color:#15233a;font-weight:600}
.thread{flex:1;overflow:auto;min-height:0;padding:20px 22px;display:flex;flex-direction:column;gap:4px}
.sys-msg{display:flex;justify-content:center;margin:8px 0}.sys-msg span{font-size:11px;color:#7a8699;background:#e8edf4;padding:5px 14px;border-radius:999px;font-weight:500}
.msg-row{display:flex}.msg-row.right{justify-content:flex-end}.msg-row.left{justify-content:flex-start}
.msg-inner{max-width:76%;display:flex;flex-direction:column;gap:3px}
.msg-row.right .msg-inner{align-items:flex-end}
.sender{font-size:11px;font-weight:600}.sender.bot{color:#5b6fa8}.sender.agente{color:#2f6fed}
.bubble{padding:10px 14px;font-size:13.5px;line-height:1.5;border-radius:14px}
.bubble.ciudadano{background:#fff;color:#1a2433;border:1px solid #e6ebf2;border-radius:14px 14px 14px 4px}
.bubble.bot{background:#eef3ff;color:#1a3057;border:1px solid #dbe6ff;border-radius:14px 14px 14px 4px}
.bubble.agente{background:#13315c;color:#fff;border-radius:14px 14px 4px 14px}
.mtime{font-size:10px;color:#9aa6b6}
.mimg{max-width:220px;max-height:260px;border-radius:10px;display:block;cursor:zoom-in}
.mvid{max-width:220px;border-radius:10px;display:block}
.maudio{width:200px;height:36px}
.mlabel{font-size:12px;margin-bottom:6px;opacity:.75}
.mcaption{margin-top:6px;font-size:13px}
.mdoc{display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit}
.mdoc span:last-child{font-size:13px;text-decoration:underline}
.mloc{display:flex;align-items:center;gap:9px;text-decoration:none;color:inherit}
.loc-title{font-size:13px;font-weight:600}.loc-coords{font-size:11px;opacity:.7;margin-top:2px}.loc-link{font-size:11px;color:#2f6fed;margin-top:2px}
.composer{padding:13px 18px;background:#fff;border-top:1px solid #e0e5ee;flex-shrink:0}
.comp-inner{display:flex;align-items:flex-end;gap:10px;background:#f1f4f9;border:1px solid #e3e8f0;border-radius:13px;padding:8px 10px 8px 15px}
.comp-inp{flex:1;border:none;background:transparent;outline:none;font-size:13.5px;color:#1a2433;padding:6px 0}
.btn-send{border:none;background:#2f6fed;color:#fff;font-weight:600;font-size:13px;padding:9px 18px;border-radius:9px;cursor:pointer;flex-shrink:0}
.comp-hint{font-size:11px;color:#9aa6b6;margin-top:7px;padding-left:4px}
</style>
