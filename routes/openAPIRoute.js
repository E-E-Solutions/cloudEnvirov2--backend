const express = require("express")
const router = express.Router();

const { GetAllDevicesLatestData } = require("../controllers/DataController");
const { fetchAllVendorIdsController } = require("../controllers/ResellerController");

router.get("/getLatestData", GetAllDevicesLatestData);
router.get("/fetchVendorIds", fetchAllVendorIdsController);  


module.exports = router;