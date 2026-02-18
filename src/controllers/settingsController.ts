import { Request, Response } from "express"
import User from "../models/User"
import Deal from "../models/Deal"
import Payment from "../models/Payment"
import Notification from "../models/Notification"

export const getSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const user = await User.findById(userId).select("-password")
    if (!user) return res.status(404).json({ success: false, message: "User not found" })

    return res.json({ success: true, data: user })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load settings" })
  }
}

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const allowedUpdates = [
      "name",
      "firstName",
      "lastName",
      "email",
      "avatar",
      "phone",
      "currency",
      "pricingPlan",
      "notifications",
      "reminders",
      "platforms",
      "dealTypes",
      "monthlyVolume"
    ]

    const updates: Record<string, unknown> = {}
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })

    const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select(
      "-password"
    )

    if (!user) return res.status(404).json({ success: false, message: "User not found" })

    return res.json({ success: true, data: user })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update settings" })
  }
}

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    await Promise.all([
      Deal.deleteMany({ user: userId }),
      Payment.deleteMany({ user: userId }),
      Notification.deleteMany({ user: userId })
    ])

    await User.findByIdAndDelete(userId)

    return res.json({ success: true })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete account" })
  }
}