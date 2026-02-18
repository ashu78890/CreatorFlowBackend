import { Request, Response } from "express"
import Deal from "../models/Deal"
import Payment from "../models/Payment"
import { createNotification } from "../utils/notifications"

const daysLeft = (date?: Date | string | null) => {
  if (!date) return null
  const target = new Date(date)
  return Math.ceil((target.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

const ensureDeadlineNotifications = async (userId: string, reminderDays: number) => {
  if (!reminderDays && reminderDays !== 0) return

  const upcomingDeals = await Deal.find({
    user: userId,
    "deliverables.status": "pending"
  }).limit(50)

  for (const deal of upcomingDeals) {
    for (const deliverable of deal.deliverables || []) {
      if (!deliverable.dueDate || deliverable.status !== "pending") continue
      const remaining = daysLeft(deliverable.dueDate)
      if (remaining !== reminderDays) continue

      const dedupeKey = `deadline:${deal._id}:${deliverable.type}:${deliverable.dueDate.toISOString()}`
      await createNotification({
        userId,
        type: "deadline_reminder",
        title: "Deadline approaching",
        message: `${deal.brandName} ${deliverable.type} due in ${remaining} days`,
        dedupeKey,
        metadata: {
          dealId: deal._id.toString(),
          dueDate: deliverable.dueDate.toISOString()
        }
      })
    }
  }
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

    const reminderDays = req.user?.reminders?.daysBefore ?? 2
    await ensureDeadlineNotifications(userId.toString(), reminderDays)

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