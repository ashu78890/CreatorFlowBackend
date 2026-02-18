import { Request, Response } from "express"
import Deal from "../models/Deal"
import Payment from "../models/Payment"

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const rawQuery = String(req.query.q || "").trim()
    if (!rawQuery || rawQuery.length < 2) {
      return res.json({ success: true, data: { deals: [], payments: [] } })
    }

    const regex = new RegExp(rawQuery, "i")

    const deals = await Deal.find({
      user: userId,
      $or: [
        { brandName: regex },
        { brandHandle: regex },
        { dealName: regex }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(5)

    const payments = await Payment.find({ user: userId })
      .populate("deal", "brandName dealName")
      .sort({ createdAt: -1 })
      .limit(20)

    const matchedPayments = payments.filter((payment) => {
      const deal = payment.deal as { brandName?: string; dealName?: string } | string
      if (typeof deal === "string") return false
      return !!(deal?.brandName?.match(regex) || deal?.dealName?.match(regex))
    }).slice(0, 5)

    return res.json({
      success: true,
      data: {
        deals: deals.map((deal) => ({
          _id: deal._id,
          brandName: deal.brandName,
          dealName: deal.dealName,
          brandHandle: deal.brandHandle,
          amount: deal.amount,
          paymentStatus: deal.paymentStatus
        })),
        payments: matchedPayments.map((payment) => ({
          _id: payment._id,
          amount: payment.amount,
          received: payment.received,
          status: payment.status,
          deal: payment.deal
        }))
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Search failed" })
  }
}
