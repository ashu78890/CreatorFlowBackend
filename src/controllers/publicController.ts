import { Request, Response } from "express"
import Deal from "../models/Deal"
import Payment from "../models/Payment"
import User from "../models/User"
import Rating from "../models/Rating"

export const getPublicStats = async (_req: Request, res: Response) => {
  try {
    const [completedDeals, totalEarningsAgg, totalCreators, ratingAgg] = await Promise.all([
      Deal.countDocuments({ status: "completed" }),
      Payment.aggregate([
        { $group: { _id: null, total: { $sum: "$received" } } }
      ]),
      User.countDocuments(),
      Rating.aggregate([
        { $match: { user: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: "$value" }, count: { $sum: 1 } } }
      ])
    ])

    const deliverableAgg = await Deal.aggregate([
      { $unwind: "$deliverables" },
      {
        $match: {
          "deliverables.status": "completed",
          "deliverables.dueDate": { $ne: null },
          "deliverables.completedAt": { $ne: null }
        }
      },
      {
        $project: {
          onTime: { $lte: ["$deliverables.completedAt", "$deliverables.dueDate"] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          onTime: { $sum: { $cond: ["$onTime", 1, 0] } }
        }
      }
    ])

    const totalEarnings = totalEarningsAgg[0]?.total || 0
    const ratingAvg = ratingAgg[0]?.avg || null
    const ratingCount = ratingAgg[0]?.count || 0
    const deliverableStats = deliverableAgg[0] || { total: 0, onTime: 0 }
    const onTimeRate = deliverableStats.total
      ? Math.round((deliverableStats.onTime / deliverableStats.total) * 100)
      : null

    return res.json({
      success: true,
      data: {
        totalCompletedDeals: completedDeals,
        totalEarnings,
        totalCreators,
        onTimeDeliveryRate: onTimeRate,
        averageRating: ratingAvg ? Math.round(ratingAvg * 10) / 10 : null,
        ratingCount
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load public stats" })
  }
}

export const getPublicTestimonials = async (_req: Request, res: Response) => {
  try {
    const testimonials = await Rating.find({
      user: { $ne: null },
      comment: { $nin: [null, ""] }
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("_id comment displayName role value createdAt")

    return res.json({ success: true, data: testimonials })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load testimonials" })
  }
}
