import mongoose from "mongoose"

export interface IRating extends mongoose.Document {
  user?: mongoose.Types.ObjectId
  value: number
  createdAt: Date
}

const ratingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    value: { type: Number, required: true, min: 1, max: 5 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

ratingSchema.index({ createdAt: -1 })

export default mongoose.model<IRating>("Rating", ratingSchema)
