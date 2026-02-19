import { Request, Response } from "express"
import User from "../models/User"
import { SYSTEM_PLATFORMS } from "../constants/platforms"

const normalizePlatformName = (value: string) => value.trim().replace(/\s+/g, " ")

export const getPlatforms = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const user = await User.findById(userId).select("customPlatforms")
    if (!user) return res.status(404).json({ success: false, message: "User not found" })

    const userPlatforms = (user.customPlatforms || []).map((name) => ({
      id: name,
      label: name
    }))

    const all = [...SYSTEM_PLATFORMS, ...userPlatforms]

    return res.json({
      success: true,
      data: {
        system: SYSTEM_PLATFORMS,
        user: userPlatforms,
        all
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load platforms" })
  }
}

export const addCustomPlatform = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: "Not authorized" })

    const rawName = typeof req.body?.name === "string" ? req.body.name : ""
    const name = normalizePlatformName(rawName)

    if (!name) {
      return res.status(400).json({ success: false, message: "Platform name is required" })
    }

    if (name.length > 40) {
      return res.status(400).json({ success: false, message: "Platform name is too long" })
    }

    const lower = name.toLowerCase()
    const systemMatch = SYSTEM_PLATFORMS.some((platform) =>
      platform.id.toLowerCase() === lower || platform.label.toLowerCase() === lower
    )

    if (systemMatch) {
      return res.status(400).json({ success: false, message: "Platform already exists" })
    }

    const user = await User.findById(userId).select("customPlatforms")
    if (!user) return res.status(404).json({ success: false, message: "User not found" })

    const existing = user.customPlatforms || []
    const alreadyExists = existing.some((platform) => platform.toLowerCase() === lower)
    if (alreadyExists) {
      return res.status(400).json({ success: false, message: "Platform already exists" })
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { customPlatforms: name } },
      { new: true }
    ).select("customPlatforms")

    return res.json({
      success: true,
      data: {
        platform: { id: name, label: name },
        user: (updated?.customPlatforms || []).map((value) => ({ id: value, label: value }))
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add platform" })
  }
}
