const express = require("express");
const { GetLatestData ,GetDeviceStatusAndLocation, GetDataPointsPerYear, GetLastAvgDataByDays, GetLastDataByDuration} = require("../controllers/DataController");

const router = express.Router();

// Get latest data
router.get("/", GetLatestData);
router.get("/getDeviceStatusAndLocation",GetDeviceStatusAndLocation);
router.get("/getDataAvailability",GetDataPointsPerYear);
router.get("/getLastAvgDataByDays",GetLastAvgDataByDays);
router.get("/getLastDataByDuration",GetLastDataByDuration);

module.exports = router;
