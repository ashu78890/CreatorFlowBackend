import { Request, Response } from "express"
import Deal from "../models/Deal"
import Payment from "../models/Payment"

const withDaysLeft = (date?: Date | string | null) => {
  if (!date) return null
  const target = new Date(date)
  const diff = target.getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export const createDeal = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const deal = await Deal.create({
      ...req.body,
      user: userId
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