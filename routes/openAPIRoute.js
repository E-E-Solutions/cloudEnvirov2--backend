const express = require("express")
const router = express.Router();

const { GetAllDevicesLatestData } = require("../controllers/DataController");

router.get("/getLatestData", GetAllDevicesLatestData);

module.exports = router;