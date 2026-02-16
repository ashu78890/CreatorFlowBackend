import express from "express"
import { getSettings, updateSettings } from "../controllers/settingsController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

router.use(protect)
router.route("/").get(getSettings).put(updateSettings)

export default router