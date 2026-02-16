import { Request, Response } from "express"
import Deal from "../models/Deal.js"

export const getCalendarEvents = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const { month, year } = req.query

    const targetYear = year ? Number(year) : new Date().getFullYear()
    const targetMonth = month ? Number(month) - 1 : new Date().getMonth()
    const start = new Date(targetYear, targetMonth, 1)
    const end = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999)

    const deals = await Deal.find({
      user: userId,
      "deliverables.dueDate": { $gte: start, $lte: end }
    })

    const events = deals.flatMap((deal) =>
      (deal.deliverables || [])
        .filter((d) => d.dueDate && d.dueDate >= start && d.dueDate <= end)
        .map((d) => ({
          id: `${deal._id}-${d.type}-${d.dueDate?.toISOString()}`,
          brand: deal.brandName,
          type: d.type,
          date: d.dueDate,
          platform: d.platform || deal.platform
        }))
    )

    return res.json({ success: true, data: events })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load calendar" })
  }
}