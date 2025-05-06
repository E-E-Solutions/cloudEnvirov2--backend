const express = require("express"); // Import the express module

// Import middleware functions for authentication and authorization
const { authenticateUser, authorizePermissions } = require("../middleware/authentication");

// Import controller functions for handling authentication routes
const {
  loginController,
  registerController,
  changePasswordController,
  sendOtpController,
  userExistsController,
  forgetPasswordController,
  updateFirmInfoController,
  googleLoginController,
  registerWithGoogleController,
  verifyOtpController
} = require("../controllers/AuthController");
const { ValidateDeviceController } = require("../controllers/DeviceController");

const router = express.Router(); // Create a new express router instance

// Define a POST route for the login path
router.post("/login", loginController);
router.get("/googleLogin", googleLoginController);
router.post("/googleRegister", registerWithGoogleController);
router.get("/userExists", userExistsController);
router.post("/register", registerController);
router.post("/validateDevice", ValidateDeviceController);
router.get("/sendOtp", sendOtpController);
router.patch("/forgetPassword", forgetPasswordController);

router.patch("/changePassword",  authenticateUser, changePasswordController);
router.patch("/updateFirmInfo",  authenticateUser, updateFirmInfoController);
router.post("/verifyOtp", verifyOtpController);

// Define a POST route for the register path
// This route uses the authenticateUser middleware to ensure the user is authenticated
// Then it uses the authorizePermissions middleware to ensure the user has the "@dm!n" role
// Finally, it uses the registerController to handle user registration requests

router.post("/register", authenticateUser, authorizePermissions("@dm!n"), registerController);

// Export the router to be used in other parts of the application
module.exports = router;
