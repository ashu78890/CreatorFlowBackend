import { Request, Response } from "express"
import bcrypt from "bcrypt"
import User from "../models/User.js"
import { generateToken } from "../utils/generateToken.js"

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, firstName, lastName } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" })
    }

    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ success: false, message: "User exists" })

    const hashed = await bcrypt.hash(password, 10)

    const user = await User.create({
      name,
      firstName,
      lastName,
      email,
      password: hashed
    })

    const safeUser = user.toObject()
    delete (safeUser as { password?: string }).password

    return res.json({
      success: true,
      token: generateToken(user._id.toString()),
      user: safeUser
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Registration failed" })
  }
}

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" })
    }

    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ success: false, message: "User not found" })

    const match = await bcrypt.compare(password, user.password || "")
    if (!match) return res.status(401).json({ success: false, message: "Wrong password" })

    const safeUser = user.toObject()
    delete (safeUser as { password?: string }).password

    return res.json({
      success: true,
      token: generateToken(user._id.toString()),
      user: safeUser
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: "Login failed" })
  }
}
