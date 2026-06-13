<template>
  <div class="wa-view">
    <div class="wa-content">
      <div class="status-bar" :class="wa.status">
        <span class="sdot"></span>
        <div>
          <div class="stitle">{{ statusTitle }}</div>
          <div v-if="wa.status==='ready'&&wa.phone" class="ssub">Número vinculado: <b>+{{ wa.phone }}</b></div>
        </div>
      </div>

      <div v-if="wa.status==='qr'" class="qr-area">
        <div class="qr-box">
          <img v-if="wa.qrDataUrl" :src="wa.qrDataUrl" class="qr-img" />
          <div v-else class="qr-ph">Cargando QR...</div>
          <div class="qr-hint">El QR expira cada 60 segundos</div>
        </div>
        <div class="qr-steps">
          <div v-for="(s,i) in steps" :key="i" class="step"><div class="step-n">{{ i+1 }}</div><div class="step-t" v-html="s"></div></div>
          <div class="qr-note">Una vez vinculado, el canal quedará activo y los mensajes aparecerán en la bandeja automáticamente.</div>
        </div>
      </div>

      <div v-if="wa.status==='ready'" class="ready-area">
        <div class="r-title">Canal activo</div>
        <div class="info-grid">
          <div v-for="c in infoCards" :key="c.label" class="icard">
            <div class="icard-lbl">{{ c.label }}</div>
            <div class="icard-val" :style="{color:c.color}">{{ c.value }}</div>
          </div>
        </div>
        <div class="r-note">Para desvincular: WhatsApp → Dispositivos vinculados → eliminar. Reinicia el servidor para escanear un QR nuevo.</div>
      </div>

      <div v-if="wa.status==='connecting'" class="conn-area">
        <div class="conn-txt">El servidor está iniciando la conexión con WhatsApp. El código QR aparecerá aquí en unos segundos...</div>
        <div class="prog-bar"><div class="prog-fill"></div></div>
      </div>

      <!-- Toggle bot IA -->
      <div class="bot-toggle-card">
        <div class="bot-toggle-info">
          <div class="bot-toggle-title">Asistente IA automático</div>
          <div class="bot-toggle-desc">
            {{ wa.botEnabled
              ? 'El bot responde automáticamente a los ciudadanos mientras el caso no tenga agente asignado.'
              : 'El bot está pausado. Los mensajes entran pero ninguno recibe respuesta automática.' }}
          </div>
        </div>
        <button class="toggle-btn" :class="{on: wa.botEnabled}" @click="toggleBot">
          <span class="toggle-track">
            <span class="toggle-knob"></span>
          </span>
          <span class="toggle-lbl">{{ wa.botEnabled ? 'Activo' : 'Inactivo' }}</span>
        </button>
      </div>

      <div class="actions">
        <div class="act-row">
          <button class="btn-sec" @click="waReset">Borrar sesión y pedir nuevo QR</button>
          <span class="act-hint">Úsalo si el QR no carga o la sesión quedó corrupta</span>
        </div>
        <div class="act-row">
          <button class="btn-del" @click="dbTruncate">Limpiar base de datos</button>
          <span class="act-hint">Borra todas las conversaciones y mensajes. No reversible.</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted } from 'vue'
import { useWhatsappStore } from '@/stores/whatsapp'
import { useConversationsStore } from '@/stores/conversations'
const wa = useWhatsappStore()
const convs = useConversationsStore()
const statusTitle = computed(()=>({ready:'WhatsApp conectado correctamente',qr:'Código QR listo — escanéalo ahora',connecting:'Iniciando conexión con WhatsApp...'}[wa.status]??''))
const steps = ['Abre WhatsApp en tu celular','Toca el menú ⋮ (tres puntos) o Configuración','Selecciona <b>Dispositivos vinculados</b>','Toca <b>Vincular un dispositivo</b> y escanea el código']
const infoCards = computed(()=>[
  {label:'ESTADO',value:'Recibiendo mensajes',color:'#1f8a5b'},
  {label:'CANAL',value:'WhatsApp Business',color:'#2f6fed'},
  {label:'ASISTENTE IA',value: wa.botEnabled ? 'Claude — activo' : 'Claude — pausado', color: wa.botEnabled ? '#9b7fe0' : '#9aa6b6'},
  {label:'RESPUESTA AUTO',value: wa.botEnabled ? 'Activada' : 'Desactivada', color: wa.botEnabled ? '#1f8a5b' : '#c0392b'}
])

onMounted(async () => {
  const r = await fetch('/api/bot/status').then(r=>r.json())
  wa.setBotEnabled(r.enabled)
})

async function toggleBot() {
  const r = await fetch('/api/bot/toggle', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ enabled: !wa.botEnabled }) }).then(r=>r.json())
  wa.setBotEnabled(r.enabled)
}
async function waReset() { await fetch('/api/wa/reset',{method:'POST'}); wa.setConnecting() }
async function dbTruncate() {
  if(!confirm('¿Eliminar TODAS las conversaciones? No reversible.')) return
  const r=await fetch('/api/db/truncate',{method:'POST'}).then(r=>r.json())
  if(r.ok) convs.clear(); else alert('Error: '+(r.error||'desconocido'))
}
</script>
<style scoped>
.wa-view{height:100%;overflow:auto;padding:32px 36px}
.wa-content{max-width:780px;display:flex;flex-direction:column;gap:24px}
.status-bar{display:flex;align-items:center;gap:10px;border-radius:11px;padding:14px 18px}
.status-bar.ready{background:#eaf6ef;border:1px solid #b7e4cc}
.status-bar.qr{background:#fbf1e0;border:1px solid #f5d9a0}
.status-bar.connecting{background:#f1f4f9;border:1px solid #e0e5ee}
.sdot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.ready .sdot{background:#1f8a5b;animation:livedot 1.8s infinite}
.qr .sdot{background:#d6a23a;animation:livedot 1s infinite}
.connecting .sdot{background:#9aa6b6}
.stitle{font-size:13.5px;font-weight:700}
.ready .stitle{color:#1f8a5b}.qr .stitle{color:#b9751a}.connecting .stitle{color:#5a6b82}
.ssub{font-size:12px;color:#3a7a5a;margin-top:2px}
.qr-area{display:flex;gap:40px;align-items:flex-start}
.qr-box{flex-shrink:0;padding:14px;background:#fff;border:1px solid #e3e8f0;border-radius:16px;box-shadow:0 2px 12px rgba(16,30,54,.08)}
.qr-img{width:240px;height:240px;border-radius:12px;display:block}
.qr-ph{width:240px;height:240px;border-radius:12px;background:#f1f4f9;display:flex;align-items:center;justify-content:center;font-size:13px;color:#9aa6b6}
.qr-hint{margin-top:10px;font-size:11px;color:#9aa6b6;text-align:center}
.qr-steps{display:flex;flex-direction:column;gap:16px;padding-top:6px}
.step{display:flex;gap:14px;align-items:flex-start}
.step-n{width:28px;height:28px;border-radius:50%;background:#2f6fed;color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-t{font-size:13.5px;color:#33405a;line-height:1.6;padding-top:4px}
.qr-note{background:#f5f8ff;border:1px solid #dde8ff;border-radius:10px;padding:13px;font-size:12.5px;color:#33405a;line-height:1.6}
.ready-area{background:#f5fef8;border:1px solid #b7e4cc;border-radius:14px;padding:22px;display:flex;flex-direction:column;gap:14px}
.r-title{font-size:14px;font-weight:700;color:#15233a}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.icard{background:#fff;border:1px solid #e6ebf2;border-radius:10px;padding:14px}
.icard-lbl{font-size:11.5px;color:#7a8699;font-weight:600;letter-spacing:.3px;margin-bottom:5px}
.icard-val{font-size:13.5px;font-weight:700}
.r-note{font-size:12.5px;color:#5a6b82;line-height:1.6}
.conn-area{display:flex;flex-direction:column;gap:16px}
.conn-txt{font-size:13.5px;color:#5a6b82;line-height:1.7}
.prog-bar{height:4px;background:#e3e8f0;border-radius:99px;overflow:hidden}
.prog-fill{height:100%;width:60%;background:linear-gradient(90deg,#2f6fed,#5b8def);border-radius:99px;animation:progress 1.5s ease-in-out infinite alternate}

/* Bot toggle */
.bot-toggle-card{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#fff;border:1px solid #e3e8f0;border-radius:14px;padding:20px 22px}
.bot-toggle-info{flex:1}
.bot-toggle-title{font-size:14px;font-weight:700;color:#15233a;margin-bottom:5px}
.bot-toggle-desc{font-size:12.5px;color:#5a6b82;line-height:1.6}
.toggle-btn{display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;flex-shrink:0;padding:0}
.toggle-track{width:48px;height:26px;border-radius:99px;background:#dde3ed;display:flex;align-items:center;padding:3px;transition:background .2s}
.toggle-btn.on .toggle-track{background:#1f8a5b}
.toggle-knob{width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:transform .2s}
.toggle-btn.on .toggle-knob{transform:translateX(22px)}
.toggle-lbl{font-size:13px;font-weight:600;color:#5a6b82;min-width:52px}
.toggle-btn.on .toggle-lbl{color:#1f8a5b}

.actions{display:flex;flex-direction:column;gap:12px}
.act-row{display:flex;align-items:center;gap:12px}
.btn-sec{border:1px solid #e3e8f0;background:#fff;color:#5a6b82;font-size:13px;font-weight:600;padding:10px 18px;border-radius:9px;cursor:pointer;white-space:nowrap}
.btn-del{border:1px solid #f5c2c2;background:#fff5f5;color:#c0392b;font-size:13px;font-weight:600;padding:10px 18px;border-radius:9px;cursor:pointer;white-space:nowrap}
.act-hint{font-size:12px;color:#9aa6b6}
@keyframes livedot{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes progress{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
</style>
