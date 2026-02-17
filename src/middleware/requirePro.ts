import { Request, Response, NextFunction } from "express"

export const requirePro = (req: Request, res: Response, next: NextFunction) => {
  const plan = req.user?.pricingPlan || "free"
  if (plan !== "pro") {
    return res.status(403).json({
      success: false,
      message: "Upgrade to Pro to access this feature"
    })
  }

  return next()
}