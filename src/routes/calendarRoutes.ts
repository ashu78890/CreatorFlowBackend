import express from "express"
import { getCalendarEvents } from "../controllers/calendarController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

router.use(protect)
router.get("/", getCalendarEvents)

export default router