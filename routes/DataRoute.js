const express = require("express");
const { GetLatestData ,GetDeviceStatusAndLocation,GetSelectedDeviceStatusAndLocation, GetDataPointsPerYear, GetLastAvgDataByDays, GetLastDataByDuration, GetLastAvgDataByCustomDuration} = require("../controllers/DataController");

const router = express.Router();

// Get latest data
router.get("/", GetLatestData);
router.get("/getDeviceStatusAndLocation",GetDeviceStatusAndLocation);
router.get("/getSelectedDeviceStatusAndLocation",GetSelectedDeviceStatusAndLocation);
router.get("/getDataAvailability",GetDataPointsPerYear);
router.get("/getLastAvgDataByDays",GetLastAvgDataByDays);
router.get("/getLastDataByDuration",GetLastDataByDuration);
router.post("/getLastAvgDataByCustomDuration",GetLastAvgDataByCustomDuration);

module.exports = router;
