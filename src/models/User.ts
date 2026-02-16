import mongoose from "mongoose"

export interface IUser extends mongoose.Document {
  name?: string
  firstName?: string
  lastName?: string
  email: string
  password?: string
  avatar?: string
  phone?: string
  platforms?: string[]
  dealTypes?: string[]
  monthlyVolume?: string
  currency?: string
  pricingPlan?: string
  notifications?: {
    deadlineReminders: boolean
    paymentAlerts: boolean
    weeklyDigest: boolean
    marketingEmails: boolean
  }
  reminders?: {
    daysBefore: number
    reminderTime: string
  }
}

const userSchema = new mongoose.Schema(
  {
    name: String,
    firstName: String,
    lastName: String,
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: String,
    avatar: String,
    phone: String,

    platforms: [String],
    dealTypes: [String],
    monthlyVolume: String,

    currency: {
      type: String,
      default: "USD"
    },

    pricingPlan: {
      type: String,
      default: "free"
    },

    notifications: {
      deadlineReminders: { type: Boolean, default: true },
      paymentAlerts: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
      marketingEmails: { type: Boolean, default: false }
    },

    reminders: {
      daysBefore: { type: Number, default: 2 },
      reminderTime: { type: String, default: "09:00" }
    }
  },
  { timestamps: true }
)

export default mongoose.model<IUser>("User", userSchema)
