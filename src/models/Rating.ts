import mongoose from "mongoose"

export interface IRating extends mongoose.Document {
  user?: mongoose.Types.ObjectId
  value: number
  comment?: string
  displayName?: string
  role?: string
  createdAt: Date
}

const ratingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    value: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 300 },
    displayName: { type: String, trim: true },
    role: { type: String, trim: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

ratingSchema.index({ user: 1 }, { unique: true, sparse: true })
ratingSchema.index({ createdAt: -1 })

export default mongoose.model<IRating>("Rating", ratingSchema)
