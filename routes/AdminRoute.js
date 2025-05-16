const express = require("express");
const requireRole = require('../middleware/roleguard')
const router = express.Router();
const {
    removeUserController,
    findAllUsersController,
    searchUserController,
    updateUserInfoController,
    updateUserDeviceInfoController,
    AddParametersByAdminController,
    UpdateRole,
    removeDeviceFromUser,
    fetchAllDeviceDetails,
    addUser,
  } = require("../controllers/AdminController");
  
router.delete("/deleteUser",requireRole('admin'), removeUserController )
router.get("/fetchAllUsers",requireRole('admin'), findAllUsersController)
router.get("/searchUser", requireRole('admin'),searchUserController)
router.patch("/updateUser",requireRole('admin'), updateUserInfoController)
router.patch("/updateDevice", requireRole('admin'),updateUserDeviceInfoController);    
router.post("/addNewParameter",requireRole('admin'), AddParametersByAdminController); 
router.patch("/updateRole",requireRole('admin'), UpdateRole);  
router.delete("/removeDeviceId",requireRole('admin'), removeDeviceFromUser); 
router.get("/fetchDevices",requireRole('admin'), fetchAllDeviceDetails);    
router.post("/addNewUser",requireRole('admin'), addUser);  

module.exports = router;