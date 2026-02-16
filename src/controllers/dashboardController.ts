import { Request, Response } from "express"
import Deal from "../models/Deal"
import Payment from "../models/Payment"

const daysLeft = (date?: Date | string | null) => {
  if (!date) return null
  const target = new Date(date)
  return Math.ceil((target.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const [activeDeals, pendingPayments, totalEarnings, recentDeals] = await Promise.all([
      Deal.countDocuments({ user: userId, status: "active" }),
      Deal.countDocuments({ user: userId, paymentStatus: { $in: ["pending", "partially_paid"] } }),
      Payment.aggregate([
        { $match: { user: userId } },
        { $group: { _id: null, total: { $sum: "$received" } } }
      ]),
      Deal.find({ user: userId }).sort({ createdAt: -1 }).limit(5)
    ])

    const upcomingDeals = await Deal.find({
      user: userId,
      "deliverables.status": "pending"
    }).limit(20)

    const upcomingDeadlines = upcomingDeals.flatMap((deal) =>
      (deal.deliverables || [])
        .filter((d) => d.status === "pending")
        .map((d) => ({
          id: `${deal._id}-${d.type}-${d.dueDate?.toISOString()}`,
          brand: deal.brandName,
          deliverable: d.type,
          dueDate: d.dueDate,
          daysLeft: daysLeft(d.dueDate),
          platform: d.platform || deal.platform
        }))
    )

    const earningsTotal = totalEarnings[0]?.total || 0

    return res.json({
      success: true,
      data: {
        stats: {
          activeDeals,
          upcomingDeadlines: upcomingDeadlines.length,
          pendingPayments,
          totalEarnings: earningsTotal
        },
        upcomingDeadlines,
        recentDeals
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load dashboard" })
  }
}