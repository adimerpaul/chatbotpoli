import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWhatsappStore = defineStore('whatsapp', () => {
  const status = ref('connecting')
  const qrDataUrl = ref(null)
  const phone = ref('')
  const botEnabled = ref(true)

  function setReady(p) { status.value='ready'; qrDataUrl.value=null; phone.value=p||'' }
  function setQR(url)   { status.value='qr'; qrDataUrl.value=url }
  function setConnecting(){ status.value='connecting'; qrDataUrl.value=null }
  function setBotEnabled(val) { botEnabled.value = !!val }

  return { status, qrDataUrl, phone, botEnabled, setReady, setQR, setConnecting, setBotEnabled }
})
