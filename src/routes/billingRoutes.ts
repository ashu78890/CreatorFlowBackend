import express from "express"
import { protect } from "../middleware/authMiddleware"
import {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus
} from "../controllers/billingController"

const router = express.Router()

router.use(protect)

router.post("/checkout", createCheckoutSession)
router.post("/portal", createPortalSession)
router.get("/status", getBillingStatus)

export default router