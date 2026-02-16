import express from "express"
import { getDashboardOverview } from "../controllers/dashboardController.js"
import { protect } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(protect)
router.get("/", getDashboardOverview)

export default router