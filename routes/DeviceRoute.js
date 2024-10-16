const express = require("express"); // Import the express module

const {
  AddDeviceController,
  ValidateDeviceController,
  UpdateAliasController,
  GetDeviceInfoController,
  DeleteDeviceController,
  GetUserDevicesInfoController,
  UpdateLocationController,
} = require("../controllers/DeviceController");

// Import controller functions for handling authentication routes

const router = express.Router(); // Create a new express router instance

// Define a POST route for the login path
router.get("/", GetDeviceInfoController);
router.patch("/addDevice", AddDeviceController);
router.patch("/updateAlias", UpdateAliasController);
router.patch("/updateLocation", UpdateLocationController);
router.post("/validateDevice", ValidateDeviceController);
router.delete("/", DeleteDeviceController);
router.get("/getUserDevices", GetUserDevicesInfoController);


// Define a POST route for the register path
// This route uses the authenticateUser middleware to ensure the user is authenticated
// Then it uses the authorizePermissions middleware to ensure the user has the "@dm!n" role
// Finally, it uses the registerController to handle user registration requests

// Export the router to be used in other parts of the application
module.exports = router;
