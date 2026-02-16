import express from "express"
import {
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
  deletePayment
} from "../controllers/paymentController.js"
import { protect } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(protect)

router.route("/").get(getPayments).post(createPayment)
router.route("/:id").get(getPaymentById).put(updatePayment).delete(deletePayment)

export default router