import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: String,
    avatar: String,

    platforms: [String],
    dealTypes: [String],
    monthlyVolume: String,

    currency: {
      type: String,
      default: "INR"
    },

    pricingPlan: {
      type: String,
      default: "free"
    }
  },
  { timestamps: true }
)

export default mongoose.model("User", userSchema)
