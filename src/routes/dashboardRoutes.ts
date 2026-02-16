import express from "express"
import { getDashboardOverview } from "../controllers/dashboardController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

router.use(protect)
router.get("/", getDashboardOverview)

export default router