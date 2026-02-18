import express from "express"
import {
  createDeal,
  getDeals,
  getDealById,
  getDealReminders,
  updateDeal,
  deleteDeal
} from "../controllers/dealController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

router.use(protect)

router.route("/").get(getDeals).post(createDeal)
router.get("/:id/reminders", getDealReminders)
router.route("/:id").get(getDealById).put(updateDeal).delete(deleteDeal)

export default router