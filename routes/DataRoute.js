const express = require("express");
const { GetLatestData ,GetDeviceStatusAndLocation} = require("../controllers/DataController");

const router = express.Router();

// Get latest data
router.get("/", GetLatestData);
router.get("/getDeviceStatusAndLocation",GetDeviceStatusAndLocation);

module.exports = router;
