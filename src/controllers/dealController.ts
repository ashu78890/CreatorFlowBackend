import { Request, Response } from "express"
import Deal from "../models/Deal"
import Payment from "../models/Payment"
import { createNotification } from "../utils/notifications"

const withDaysLeft = (date?: Date | string | null) => {
  if (!date) return null
  const target = new Date(date)
  const diff = target.getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const dayDiff = (date: Date) => {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export const getDealReminders = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const deal = await Deal.findOne({ _id: req.params.id, user: userId })
    if (!deal) return res.status(404).json({ success: false, message: "Deal not found" })

    const reminderDays = req.user?.reminders?.daysBefore ?? 2
    const reminders: Array<{
      id: string
      type: "deliverable" | "payment"
      message: string
      dueDate: string
      status: "upcoming" | "overdue"
      daysLeft: number
    }> = []

    for (const deliverable of deal.deliverables || []) {
      if (!deliverable.dueDate || deliverable.status !== "pending") continue
      const diff = dayDiff(deliverable.dueDate)
      if (diff > reminderDays) continue

      const status = diff < 0 ? "overdue" : "upcoming"
      const daysLeft = diff
      const message = diff < 0
        ? `${deliverable.type} overdue by ${Math.abs(diff)} days`
        : diff === 0
          ? `${deliverable.type} due today`
          : `${deliverable.type} due in ${diff} days`

      reminders.push({
        id: `deliverable-${deal._id}-${deliverable.type}-${deliverable.dueDate.toISOString()}`,
        type: "deliverable",
        message,
        dueDate: deliverable.dueDate.toISOString(),
        status,
        daysLeft
      })
    }

    const payments = await Payment.find({
      deal: deal._id,
      user: userId,
      status: { $in: ["pending", "partially_paid"] }
    })

    for (const payment of payments) {
      if (!payment.dueDate) continue
      const diff = dayDiff(payment.dueDate)
      if (diff > reminderDays) continue

      const remaining = Math.max((payment.amount || 0) - (payment.received || 0), 0)
      const status = diff < 0 ? "overdue" : "upcoming"
      const daysLeft = diff
      const message = diff < 0
        ? `Payment overdue by ${Math.abs(diff)} days${remaining ? ` ($${remaining.toLocaleString()} remaining)` : ""}`
        : diff === 0
          ? `Payment due today${remaining ? ` ($${remaining.toLocaleString()} remaining)` : ""}`
          : `Payment due in ${diff} days${remaining ? ` ($${remaining.toLocaleString()} remaining)` : ""}`

      reminders.push({
        id: `payment-${payment._id}`,
        type: "payment",
        message,
        dueDate: payment.dueDate.toISOString(),
        status,
        daysLeft
      })
    }

    reminders.sort((a, b) => a.daysLeft - b.daysLeft)

    return res.json({ success: true, data: reminders })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load reminders" })
  }
}

export const createDeal = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    if (req.user?.pricingPlan !== "pro") {
      const dealCount = await Deal.countDocuments({ user: userId })
      if (dealCount >= 3) {
        return res.status(403).json({
          success: false,
          message: "Free plan limit reached. Upgrade to Pro for unlimited deals."
        })
      }
    }

    const deal = await Deal.create({
      ...req.body,
      user: userId
    })

    await createNotification({
      userId: userId.toString(),
      type: "deal_created",
      title: "New deal added",
      message: `${deal.brandName} - ${deal.dealName}`,
      metadata: { dealId: deal._id.toString() }
    })

    return res.status(201).json({ success: true, data: deal })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create deal" })
  }
}

export const getDeals = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const { search, platform, paymentStatus, status } = req.query

    const query: Record<string, unknown> = { user: userId }
    if (platform && platform !== "all") query.platform = platform
    if (paymentStatus && paymentStatus !== "all") query.paymentStatus = paymentStatus
    if (status && status !== "all") query.status = status

    if (search) {
      query.$or = [
        { brandName: { $regex: search, $options: "i" } },
        { brandHandle: { $regex: search, $options: "i" } },
        { dealName: { $regex: search, $options: "i" } }
      ]
    }

    const deals = await Deal.find(query).sort({ createdAt: -1 })

    const mapped = deals.map((deal) => {
      const obj = deal.toObject()
      return {
        ...obj,
        daysLeft: withDaysLeft(obj.dueDate)
      }
    })

    return res.json({ success: true, data: mapped })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch deals" })
  }
}

export const getDealById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const deal = await Deal.findOne({ _id: req.params.id, user: userId })
    if (!deal) return res.status(404).json({ success: false, message: "Deal not found" })

    const payments = await Payment.find({ deal: deal._id, user: userId }).sort({ createdAt: -1 })

    return res.json({
      success: true,
      data: {
        ...deal.toObject(),
        daysLeft: withDaysLeft(deal.dueDate),
        payments
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch deal" })
  }
}

export const updateDeal = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const deal = await Deal.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { $set: req.body },
      { new: true }
    )

    if (!deal) return res.status(404).json({ success: false, message: "Deal not found" })

    return res.json({ success: true, data: deal })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update deal" })
  }
}

export const deleteDeal = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const deal = await Deal.findOneAndDelete({ _id: req.params.id, user: userId })
    if (!deal) return res.status(404).json({ success: false, message: "Deal not found" })

    await Payment.deleteMany({ deal: deal._id, user: userId })

    return res.json({ success: true, message: "Deal deleted" })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete deal" })
  }
}