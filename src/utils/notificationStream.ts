import { Response } from "express"

const clients = new Map<string, Set<Response>>()

export const addNotificationClient = (userId: string, res: Response) => {
  const existing = clients.get(userId) || new Set<Response>()
  existing.add(res)
  clients.set(userId, existing)
}

export const removeNotificationClient = (userId: string, res: Response) => {
  const existing = clients.get(userId)
  if (!existing) return
  existing.delete(res)
  if (existing.size === 0) {
    clients.delete(userId)
  }
}

export const emitNotification = (userId: string, payload: unknown) => {
  const userClients = clients.get(userId)
  if (!userClients || userClients.size === 0) return
  const data = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`
  userClients.forEach((client) => client.write(data))
}

export const emitPing = (userId: string) => {
  const userClients = clients.get(userId)
  if (!userClients || userClients.size === 0) return
  const data = "event: ping\ndata: {}\n\n"
  userClients.forEach((client) => client.write(data))
}
