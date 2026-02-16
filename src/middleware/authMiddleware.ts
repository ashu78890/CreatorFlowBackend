import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import User from "../models/User.js"

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Not authorized" })
    }

    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
    const user = await User.findById(decoded.id).select("-password")

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" })
  }
}