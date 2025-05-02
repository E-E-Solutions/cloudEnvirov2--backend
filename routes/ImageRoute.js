const express = require("express");
const {  addDeviceIdOnImageController, findDevicesByIdController, deleteDeviceIdController, updateDeviceController, insertImageController,  findImageDetailsController } = require("../controllers/ImageController");
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post("/addDeviceIdOnImage",addDeviceIdOnImageController);
router.get("/fetchDevices",findDevicesByIdController);
router.delete("/deleteDevice",deleteDeviceIdController);
router.patch("/updateDevice",updateDeviceController);
router.get("/findImageDetails",findImageDetailsController);
router.post("/insertImage", upload.single("image"), insertImageController);


module.exports = router;