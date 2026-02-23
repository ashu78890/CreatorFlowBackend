import { Request, Response } from "express"
import Deal from "../models/Deal"
import Payment from "../models/Payment"
import Rating from "../models/Rating"

const formatPlatformName = (platform?: string) => {
  if (!platform) return null
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

const buildRoleLabel = (user: any) => {
  const primary = user?.platforms?.[0] || user?.customPlatforms?.[0]
  const platformName = formatPlatformName(primary)
  return platformName ? `${platformName} Creator` : "Creator"
}

export const getMyRating = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const rating = await Rating.findOne({ user: userId }).select("value comment role createdAt")

    return res.json({ success: true, data: rating })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load rating" })
  }
}

export const getRatingEligibility = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const existing = await Rating.findOne({ user: userId }).select("_id")
    if (existing) {
      return res.json({
        success: true,
        data: { eligible: false, hasRated: true, reasons: [] as string[] }
      })
    }

    const [completedDeals, paidPayments] = await Promise.all([
      Deal.countDocuments({ user: userId, status: "completed" }),
      Payment.countDocuments({ user: userId, status: "paid" })
    ])

    const reasons: string[] = []
    if (completedDeals > 0) reasons.push("completed_campaign")
    if (paidPayments > 0) reasons.push("payout")

    return res.json({
      success: true,
      data: {
        eligible: reasons.length > 0,
        hasRated: false,
        reasons
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to check eligibility" })
  }
}

export const createRating = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const value = Number(req.body?.value)
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" })
    }

    const existing = await Rating.findOne({ user: userId }).select("_id")
    if (existing) {
      return res.status(409).json({ success: false, message: "Rating already submitted" })
    }

    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : ""
    if (comment.length > 300) {
      return res.status(400).json({ success: false, message: "Comment is too long" })
    }

    const displayName = req.user?.firstName || req.user?.name || "Creator"
    const role = buildRoleLabel(req.user)

    const rating = await Rating.create({
      user: userId,
      value,
      comment: comment || undefined,
      displayName,
      role
    })

    return res.status(201).json({ success: true, data: { id: rating._id, value: rating.value } })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to submit rating" })
  }
}
