import express from "express"
import { deleteAccount, getSettings, updateSettings } from "../controllers/settingsController"
import { protect } from "../middleware/authMiddleware"

const router = express.Router()

router.use(protect)
router.route("/").get(getSettings).put(updateSettings).delete(deleteAccount)

export default router