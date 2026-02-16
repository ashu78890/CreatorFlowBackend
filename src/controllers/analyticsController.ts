import { Request, Response } from "express"
import Deal from "../models/Deal.js"
import Payment from "../models/Payment.js"

const monthLabel = (date: Date) =>
  date.toLocaleString("en-US", { month: "short" })

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)

    const [deals, payments] = await Promise.all([
      Deal.find({ user: userId, createdAt: { $gte: sixMonthsAgo } }),
      Payment.find({ user: userId, createdAt: { $gte: sixMonthsAgo } })
    ])

    const monthlyDealsMap = new Map<string, number>()
    const earningsMap = new Map<string, number>()

    deals.forEach((deal) => {
      const label = monthLabel(deal.createdAt)
      monthlyDealsMap.set(label, (monthlyDealsMap.get(label) || 0) + 1)
    })

    payments.forEach((payment) => {
      const label = monthLabel(payment.createdAt)
      earningsMap.set(label, (earningsMap.get(label) || 0) + (payment.received || 0))
    })

    const months: string[] = []
    for (let i = 0; i < 6; i += 1) {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      months.push(monthLabel(d))
    }

    const monthlyDeals = months.map((m) => ({ month: m, deals: monthlyDealsMap.get(m) || 0 }))
    const earningsData = months.map((m) => ({ month: m, earned: earningsMap.get(m) || 0 }))

    const paymentStatusAgg = await Deal.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: "$paymentStatus",
          value: { $sum: "$amount" }
        }
      }
    ])

    const paymentStatus = paymentStatusAgg.map((entry) => ({
      name:
        entry._id === "partially_paid"
          ? "Partial"
          : entry._id === "paid"
            ? "Paid"
            : "Pending",
      value: entry.value
    }))

    const platformAgg = await Deal.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$platform", deals: { $sum: 1 } } }
    ])

    const platformBreakdown = platformAgg.map((p) => ({
      platform: p._id || "Other",
      deals: p.deals
    }))

    const totalDeals = await Deal.countDocuments({ user: userId })
    const totalEarnings = await Payment.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$received" } } }
    ])

    const avgDealValueAgg = await Deal.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, avg: { $avg: "$amount" } } }
    ])

    return res.json({
      success: true,
      data: {
        overviewStats: {
          totalDeals,
          totalEarnings: totalEarnings[0]?.total || 0,
          avgDealValue: Math.round(avgDealValueAgg[0]?.avg || 0)
        },
        monthlyDeals,
        earningsData,
        paymentStatus,
        platformBreakdown
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load analytics" })
  }
}