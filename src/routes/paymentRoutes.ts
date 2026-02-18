import express from "express"
import {
  createPayment,
  getPayments,
  getPaymentById,
  exportPayments,
  updatePayment,
  deletePayment
} from "../controllers/paymentController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

router.use(protect)

router.get("/export", exportPayments)
router.route("/").get(getPayments).post(createPayment)
router.route("/:id").get(getPaymentById).put(updatePayment).delete(deletePayment)

export default router