import express from "express"
import { getAnalytics } from "../controllers/analyticsController"
import { protect } from "../middleware/authMiddleware"
import { requirePro } from "../middleware/requirePro"

const router = express.Router()

router.use(protect)
router.get("/", requirePro, getAnalytics)

export default router