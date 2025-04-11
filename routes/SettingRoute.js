const express = require("express");
const { SetMapSettings, GetSettings, SetParaInfo, reportBug } = require("../controllers/SettingController");
const multer  = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userEmail = req.user.email || 'anonymous';
    const safeUser = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const dir = path.join('uploads/screenshots/', safeUser);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { files: 3 }
});

const router = express.Router();

// Get latest data
router.get("/", GetSettings);
router.post("/mapSettings", SetMapSettings);
router.post("/paraInfo", SetParaInfo);
router.post("/reportBug", upload.array('screenshots', 3), reportBug);

module.exports = router;