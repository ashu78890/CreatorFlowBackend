import mongoose from "mongoose"

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deal: { type: mongoose.Schema.Types.ObjectId, ref: "Deal", required: true },
    amount: { type: Number, required: true },
    received: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "partially_paid", "paid"],
      default: "pending"
    },
    dueDate: { type: Date },
    paidAt: { type: Date },
    notes: { type: String }
  },
  { timestamps: true }
)

export default mongoose.model("Payment", paymentSchema)