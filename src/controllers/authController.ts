import { Request, Response } from "express"
import bcrypt from "bcrypt"
import User from "../models/User.js"
import { generateToken } from "../utils/generateToken.js"

export const registerUser = async (req: Request, res: Response) => {
  const { name, email, password } = req.body

  const existing = await User.findOne({ email })
  if (existing) return res.status(400).json({ message: "User exists" })

  const hashed = await bcrypt.hash(password, 10)

  const user = await User.create({
    name,
    email,
    password: hashed
  })

  res.json({
    token: generateToken(user._id.toString()),
    user
  })
}

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body

  const user = await User.findOne({ email })
  if (!user) return res.status(404).json({ message: "User not found" })

  const match = await bcrypt.compare(password, user.password!)
  if (!match) return res.status(401).json({ message: "Wrong password" })

  res.json({
    token: generateToken(user._id.toString()),
    user
  })
}
