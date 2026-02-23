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

export const createRating = async (req: Request, res: Response) => {
  try {
    const value = Number(req.body?.value)
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" })
    }

    const rating = await Rating.create({ value })

    return res.status(201).json({ success: true, data: { id: rating._id, value: rating.value } })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to submit rating" })
  }
}
