import mongoose from "mongoose"

const deliverableSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending"
    },
    dueDate: { type: Date, required: true },
    platform: { type: String, default: "instagram" },
    completedAt: { type: Date, default: null }
  },
  { _id: false }
)

const dealSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    brandName: { type: String, required: true },
    brandHandle: { type: String },
    platform: {
      type: String,
      default: "instagram"
    },
    dealName: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active"
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "partially_paid", "paid"],
      default: "pending"
    },
    amount: { type: Number, required: true },
    amountReceived: { type: Number, default: 0 },
    dueDate: { type: Date },
    createdDate: { type: Date, default: Date.now },
    notes: { type: String },
    deliverables: [deliverableSchema]
  },
  { timestamps: true }
)

export default mongoose.model("Deal", dealSchema)