const express = require("express");
const { getAllParametersController, getTableStructureController, setTableStructureController, deleteTableColumnController, updateColumnController, changeSequenceController } = require("../controllers/SuperAdminController");
const requireRole = require("../middleware/roleguard");
const router = express.Router();

router.get("/fetchAllParameters", requireRole('superadmin'), getAllParametersController);
router.get("/getTableStructure", requireRole('superadmin'), getTableStructureController);
router.post("/setTableStructure", requireRole('superadmin'), setTableStructureController);
router.delete("/deleteTableColumn", requireRole('superadmin'), deleteTableColumnController);
router.patch("/updateColumns", requireRole('superadmin'), updateColumnController);
router.post("/changeSequence", requireRole('superadmin'), changeSequenceController);



module.exports = router;