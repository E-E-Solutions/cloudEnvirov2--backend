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
    UpdateParametersByAdminController,
    fetchAllParameterDetails,
  } = require("../controllers/AdminController");
  
router.delete("/deleteUser",requireRole(['admin', 'superadmin']), removeUserController )
router.get("/fetchAllUsers",requireRole(['admin', 'superadmin']), findAllUsersController)
router.get("/searchUser", requireRole(['admin', 'superadmin']),searchUserController)
router.patch("/updateUser",requireRole(['admin', 'superadmin']), updateUserInfoController)
router.patch("/updateDevice", requireRole(['admin', 'superadmin']),updateUserDeviceInfoController);    
router.post("/addNewParameter",requireRole(['admin', 'superadmin']), AddParametersByAdminController); 
router.patch("/updateRole",requireRole(['admin', 'superadmin']), UpdateRole);  
router.delete("/removeDeviceId",requireRole(['admin', 'superadmin']), removeDeviceFromUser); 
router.get("/fetchDevices",requireRole(['admin', 'superadmin']), fetchAllDeviceDetails);    
router.post("/addNewUser",requireRole(['admin', 'superadmin']), addUser);  
router.get("/fetchAllParameters",requireRole(['admin', 'superadmin']), fetchAllParameterDetails);  
router.patch("/updateParameterInfo",requireRole(['admin', 'superadmin']), UpdateParametersByAdminController);  


module.exports = router;