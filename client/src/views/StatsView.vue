<template>
  <div class="stats-view">
    <div class="kpi-grid">
      <div class="kpi" v-for="k in kpis" :key="k.label">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-val">{{ k.value }}</div>
        <div class="kpi-sub" :style="{color:k.color}">{{ k.sub }}</div>
      </div>
    </div>
    <div class="charts-row">
      <div class="card">
        <div class="ctitle">Distribución por tipo</div>
        <div class="donut-area">
          <div class="donut" :style="{background:`conic-gradient(#b9751a 0 ${pDen}%,#2f6fed ${pDen}% ${pDen+pCon}%,#c0392b ${pDen+pCon}% 100%)`}">
            <div class="donut-hole"><span class="dtotal">{{ total }}</span><span class="dtlbl">total</span></div>
          </div>
          <div class="leg">
            <div v-for="l in legend" :key="l.label" class="leg-item">
              <span class="leg-dot" :style="{background:l.color}"></span>
              <span class="leg-lbl">{{ l.label }}</span>
              <span class="leg-val">{{ l.pct }}%</span>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="ctitle">Casos por zona</div>
        <div class="bars-wrap">
          <div v-for="z in zonaData" :key="z.name" class="bcol">
            <span class="bnum">{{ z.count }}</span>
            <div class="bar" :style="{height:barH(z.count)+'px'}"></div>
            <span class="blbl">{{ z.name }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="ctitle">Delitos más reportados</div>
      <div class="del-list">
        <div v-for="d in delitoData" :key="d.label" class="del-row">
          <span class="del-lbl">{{ d.label }}</span>
          <div class="del-bar-wrap"><div class="del-bar" :style="{width:(d.count/delitoMax*100)+'%'}"></div></div>
          <span class="del-val">{{ d.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
const store = useConversationsStore()
const total = computed(()=>store.convs.length)
const cerrados = computed(()=>store.convs.filter(c=>c.estado==='Cerrado').length)
const emergencias = computed(()=>store.convs.filter(c=>c.tipo==='Emergencia'&&c.estado!=='Cerrado').length)
const tasaRes = computed(()=>total.value>0?Math.round(cerrados.value/total.value*100):0)
const kpis = computed(()=>[
  {label:'Casos totales',value:String(total.value),sub:'Canal ciudadano activo',color:'#1f8a5b'},
  {label:'Emergencias activas',value:String(emergencias.value),sub:'Requieren atención',color:'#c0392b'},
  {label:'Tiempo prom. respuesta',value:'3m 12s',sub:'▼ −14% esta semana',color:'#1f8a5b'},
  {label:'Tasa de resolución',value:tasaRes.value+'%',sub:'Meta 85%',color:'#b9751a'}
])
const tc = computed(()=>{ const c={Emergencia:0,Denuncia:0,Consulta:0}; store.convs.forEach(v=>{c[v.tipo]=(c[v.tipo]||0)+1}); return c })
const t1 = computed(()=>total.value||1)
const pDen = computed(()=>Math.round(tc.value.Denuncia/t1.value*100))
const pCon = computed(()=>Math.round(tc.value.Consulta/t1.value*100))
const legend = computed(()=>[
  {label:'Denuncias',pct:pDen.value,color:'#b9751a'},
  {label:'Consultas',pct:pCon.value,color:'#2f6fed'},
  {label:'Emergencias',pct:Math.round(tc.value.Emergencia/t1.value*100),color:'#c0392b'}
])
const zonaData = computed(()=>{ const m={}; store.convs.forEach(c=>{m[c.zona]=(m[c.zona]||0)+1}); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,count])=>({name,count})) })
const zonaMax = computed(()=>Math.max(...zonaData.value.map(z=>z.count),1))
const barH = n => Math.round(n/zonaMax.value*140)+8
const delitoData = computed(()=>{ const m={}; store.convs.forEach(c=>{m[c.delito]=(m[c.delito]||0)+1}); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([label,count])=>({label,count})) })
const delitoMax = computed(()=>Math.max(...delitoData.value.map(d=>d.count),1))
</script>
<style scoped>
.stats-view{height:100%;overflow:auto;padding:24px 28px;display:flex;flex-direction:column;gap:16px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.kpi{background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:18px;box-shadow:0 1px 2px rgba(16,30,54,.04)}
.kpi-label{font-size:12.5px;color:#7a8699;font-weight:500}.kpi-val{font-size:30px;font-weight:700;color:#15233a;margin:8px 0 4px;letter-spacing:-.5px}.kpi-sub{font-size:12px;font-weight:600}
.charts-row{display:grid;grid-template-columns:1.1fr 1.4fr;gap:16px}
.card{background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:20px}
.ctitle{font-size:14px;font-weight:700;color:#15233a;margin-bottom:18px}
.donut-area{display:flex;align-items:center;gap:26px}
.donut{width:148px;height:148px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.donut-hole{width:96px;height:96px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}
.dtotal{font-size:24px;font-weight:700;color:#15233a}.dtlbl{font-size:11px;color:#7a8699}
.leg{display:flex;flex-direction:column;gap:13px;flex:1}
.leg-item{display:flex;align-items:center;gap:10px}
.leg-dot{width:11px;height:11px;border-radius:3px;flex-shrink:0}
.leg-lbl{font-size:13px;color:#33405a;flex:1}.leg-val{font-size:13px;font-weight:700;color:#15233a}
.bars-wrap{display:flex;align-items:flex-end;gap:18px;height:160px;padding:0 6px}
.bcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:9px;height:100%;justify-content:flex-end}
.bnum{font-size:12px;font-weight:700;color:#15233a}
.bar{width:100%;max-width:46px;background:linear-gradient(180deg,#5b8def,#2f6fed);border-radius:7px 7px 3px 3px}
.blbl{font-size:11.5px;color:#7a8699;text-align:center}
.del-list{display:flex;flex-direction:column;gap:14px}
.del-row{display:flex;align-items:center;gap:14px}
.del-lbl{width:200px;font-size:13px;color:#33405a;flex-shrink:0}
.del-bar-wrap{flex:1;height:9px;background:#eef1f6;border-radius:999px;overflow:hidden}
.del-bar{height:100%;background:linear-gradient(90deg,#2f6fed,#5b8def);border-radius:999px}
.del-val{width:34px;text-align:right;font-size:13px;font-weight:700;color:#15233a}
</style>
