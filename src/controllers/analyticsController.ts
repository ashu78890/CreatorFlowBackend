import { Request, Response } from "express"
import Deal from "../models/Deal"
import Payment from "../models/Payment"
import User from "../models/User"

const monthLabel = (date: Date) =>
  date.toLocaleString("en-US", { month: "short" })

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value)

const buildTrend = (current: number, previous: number) => {
  if (previous === 0) {
    if (current === 0) {
      return { change: "0%", positive: true }
    }
    return { change: "New", positive: true }
  }
  const diff = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(diff)
  return {
    change: `${rounded >= 0 ? "+" : ""}${rounded}%`,
    positive: rounded >= 0
  }
}

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)

    const [user, deals, payments] = await Promise.all([
      User.findById(userId).select("currency"),
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

    const lastDeals = monthlyDeals[monthlyDeals.length - 1]?.deals || 0
    const prevDeals = monthlyDeals[monthlyDeals.length - 2]?.deals || 0
    const lastEarned = earningsData[earningsData.length - 1]?.earned || 0
    const prevEarned = earningsData[earningsData.length - 2]?.earned || 0

    const earningsTrend = buildTrend(lastEarned, prevEarned)
    const pendingAmount = paymentStatus
      .filter((status) => status.name !== "Paid")
      .reduce((sum, status) => sum + (status.value || 0), 0)

    const topPlatform = platformBreakdown.reduce(
      (best, current) => (current.deals > best.deals ? current : best),
      { platform: "", deals: 0 }
    )

    const currency = (user?.currency || "USD").toUpperCase()
    const topBrand = deals.reduce(
      (acc, deal) => {
        const name = deal.brandName || "Unknown"
        const nextTotal = (acc.totals.get(name) || 0) + (deal.amount || 0)
        acc.totals.set(name, nextTotal)
        if (nextTotal > acc.best.total) {
          acc.best = { name, total: nextTotal }
        }
        return acc
      },
      { totals: new Map<string, number>(), best: { name: "", total: 0 } }
    ).best

    const biggestDeal = deals.reduce(
      (best, deal) => {
        const amount = deal.amount || 0
        if (amount > best.amount) {
          return { name: deal.brandName || "Unknown", amount }
        }
        return best
      },
      { name: "", amount: 0 }
    )

    const bestEarningsMonth = earningsData.reduce(
      (best, entry) => (entry.earned > best.earned ? entry : best),
      { month: "", earned: 0 }
    )

    const busiestMonth = monthlyDeals.reduce(
      (best, entry) => (entry.deals > best.deals ? entry : best),
      { month: "", deals: 0 }
    )

    const highlights = (() => {
      if (totalDeals === 0) {
        return [
          {
            id: 1,
            text: "No highlights yet. Add deals and payments to unlock analytics.",
            type: "info"
          }
        ]
      }

      const items: Array<{ id: number; text: string; type: "warning" | "success" | "info" }> = []
      let nextId = 1
      if (topPlatform.platform) {
        items.push({
          id: nextId += 1,
          text: `Most of your deals are on ${topPlatform.platform}.`,
          type: "info"
        })
      }

      if (pendingAmount > 0) {
        items.push({
          id: nextId += 1,
          text: `You have ${formatCurrency(pendingAmount, currency)} pending across deals.`,
          type: "warning"
        })
      } else {
        items.push({
          id: nextId += 1,
          text: "Great job — no pending deal amounts right now.",
          type: "success"
        })
      }

      const earningsDirection = earningsTrend.positive ? "up" : "down"
      items.push({
        id: nextId += 1,
        text: `Earnings are ${earningsDirection} ${earningsTrend.change} vs last month.`,
        type: earningsTrend.positive ? "success" : "warning"
      })

      if (topBrand.name) {
        items.push({
          id: nextId += 1,
          text: `${topBrand.name} is your top client at ${formatCurrency(topBrand.total, currency)}.`,
          type: "info"
        })
      }

      if (biggestDeal.amount > 0) {
        items.push({
          id: nextId += 1,
          text: `Your biggest deal is ${formatCurrency(biggestDeal.amount, currency)} (${biggestDeal.name}).`,
          type: "info"
        })
      }

      if (bestEarningsMonth.month) {
        items.push({
          id: nextId += 1,
          text: `${bestEarningsMonth.month} is your best earnings month (${formatCurrency(bestEarningsMonth.earned, currency)}).`,
          type: "success"
        })
      }

      if (busiestMonth.month) {
        items.push({
          id: nextId += 1,
          text: `${busiestMonth.month} was your busiest month with ${busiestMonth.deals} deals.`,
          type: "info"
        })
      }

      return items.slice(0, 6)
    })()

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
        platformBreakdown,
        highlights
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load analytics" })
  }
}