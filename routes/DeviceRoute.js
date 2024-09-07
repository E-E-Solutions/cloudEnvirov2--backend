const express = require("express"); // Import the express module

const { AddDeviceController, ValidateDeviceController } = require("../controllers/DeviceController");

// Import controller functions for handling authentication routes

const router = express.Router(); // Create a new express router instance

// Define a POST route for the login path
router.patch("/addDevice", AddDeviceController);
router.post("/validateDevice", ValidateDeviceController);

// Define a POST route for the register path
// This route uses the authenticateUser middleware to ensure the user is authenticated
// Then it uses the authorizePermissions middleware to ensure the user has the "@dm!n" role
// Finally, it uses the registerController to handle user registration requests

// Export the router to be used in other parts of the application
module.exports = router;
