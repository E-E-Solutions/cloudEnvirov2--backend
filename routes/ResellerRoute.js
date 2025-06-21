const express = require("express");
const requireRole = require('../middleware/roleguard');
const { addResellerUserController, fetchAllResellerDevices, fetchAllResellerUsers, updateResellerUserDeviceInfoController,updateResellerUserFirmInfoController, removeResellerUserController, removeDeviceFromResellerUser, fetchAllVendorIdsController } = require("../controllers/ResellerController");
const router = express.Router();

router.post("/addResellerUser",requireRole('reseller'), addResellerUserController); 
router.get("/fetchResellerDevices",requireRole('reseller'), fetchAllResellerDevices);  
router.get("/fetchResellerUsers",requireRole('reseller'), fetchAllResellerUsers);  
router.patch("/updateResellerUserFirmInfo", updateResellerUserFirmInfoController);  
router.patch("/updateResellerUserDevice", requireRole('reseller'),updateResellerUserDeviceInfoController);    
router.delete("/removeResellerUser",requireRole('reseller'), removeResellerUserController); 
router.delete("/removeResellerUserDevices",requireRole('reseller'), removeDeviceFromResellerUser); 

module.exports = router;