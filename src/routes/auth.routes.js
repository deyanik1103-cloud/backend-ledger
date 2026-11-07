const express = require("express")
const authController = require("../controllers/auth.controller")


const router = express.Router()

/* POST /api/auth/register  (sends a 6-digit code by email) */
router.post("/register", authController.userRegisterController)

/* POST /api/auth/verify-email  (body: email, code) */
router.post("/verify-email", authController.verifyEmailController)

/* POST /api/auth/resend-code  (body: email) */
router.post("/resend-code", authController.resendCodeController)

/* POST /api/auth/login */
router.post("/login", authController.userLoginController)

/* POST /api/auth/logout */
router.post("/logout", authController.userLogoutController)



module.exports = router
