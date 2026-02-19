import Notification, { type NotificationType } from "../models/Notification"
import User from "../models/User"
import { emitNotification } from "./notificationStream"

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export const cleanupOldNotifications = async () => {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS)
  await Notification.deleteMany({ createdAt: { $lt: cutoff } })
}

export const createNotification = async (params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  dedupeKey?: string
  metadata?: Record<string, unknown>
}) => {
  const { userId, dedupeKey } = params
  const user = await User.findById(userId).select("notifications")
  if (!user) return null

  const prefKey =
    params.type === "deadline_reminder"
      ? "deadlineReminders"
      : params.type === "payment_received" || params.type === "billing_event"
        ? "paymentAlerts"
        : null

  if (prefKey && user.notifications && user.notifications[prefKey] === false) {
    return null
  }
  if (dedupeKey) {
    const existing = await Notification.findOne({ user: userId, dedupeKey })
    if (existing) return existing
  }

  const notification = await Notification.create({
    user: userId,
    type: params.type,
    title: params.title,
    message: params.message,
    dedupeKey: params.dedupeKey,
    metadata: params.metadata
  })

  emitNotification(userId, {
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    metadata: notification.metadata
  })

  return notification
}
