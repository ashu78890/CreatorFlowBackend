import express from "express"
import { getCalendarEvents } from "../controllers/calendarController"
import { protect } from "../middleware/authMiddleware"
import { requirePro } from "../middleware/requirePro"

const router = express.Router()

router.use(protect)
router.get("/", requirePro, getCalendarEvents)

export default router