import { Request, Response } from "express"
import jwt from "jsonwebtoken"
import User from "../models/User"
import Notification from "../models/Notification"
import { addNotificationClient, removeNotificationClient, emitPing } from "../utils/notificationStream"
import { cleanupOldNotifications } from "../utils/notifications"

const getUserFromToken = async (token?: string) => {
  if (!token) return null
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
  return User.findById(decoded.id).select("_id")
}

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    await cleanupOldNotifications()

    const limit = req.query.limit ? Number(req.query.limit) : 20
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)

    const unreadCount = await Notification.countDocuments({ user: userId, readAt: null })

    return res.json({ success: true, data: { notifications, unreadCount } })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load notifications" })
  }
}

export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { $set: { readAt: new Date() } },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" })
    }

    return res.json({ success: true, data: notification })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update notification" })
  }
}

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    await Notification.updateMany(
      { user: userId, readAt: null },
      { $set: { readAt: new Date() } }
    )

    return res.json({ success: true })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update notifications" })
  }
}

export const streamNotifications = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined
    const token = (req.query.token as string | undefined) || headerToken

    const user = await getUserFromToken(token)
    if (!user) return res.status(401).end()

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    const userId = user._id.toString()
    addNotificationClient(userId, res)
    const keepAlive = setInterval(() => emitPing(userId), 25000)

    req.on("close", () => {
      clearInterval(keepAlive)
      removeNotificationClient(userId, res)
    })
  } catch (error) {
    return res.status(401).end()
  }
}
