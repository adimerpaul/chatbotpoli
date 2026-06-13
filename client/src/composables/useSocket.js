import { io } from 'socket.io-client'
import { useConversationsStore } from '@/stores/conversations'
import { useWhatsappStore } from '@/stores/whatsapp'

let socket = null

export function useSocket() {
  if (socket) return socket
  socket = io()
  const convs = useConversationsStore()
  const wa   = useWhatsappStore()
  socket.on('conversation:updated',     conv  => convs.upsert(conv))
  socket.on('conversation:deleted',     ({id})=> convs.remove(id))
  socket.on('conversations:demo-cleared',({ids})=>convs.removeMany(ids))
  socket.on('store:cleared',            ()    => convs.clear())
  socket.on('whatsapp:qr',    ({qrDataUrl})=> wa.setQR(qrDataUrl))
  socket.on('whatsapp:ready', ({phone})    => wa.setReady(phone))
  socket.on('whatsapp:logout',()           => wa.setConnecting())
  socket.on('bot:status',    ({enabled})  => wa.setBotEnabled(enabled))
  return socket
}
