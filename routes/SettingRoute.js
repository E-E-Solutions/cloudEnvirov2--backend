const express = require("express");
const { SetMapSettings, GetSettings, SetParaInfo } = require("../controllers/SettingController");

const router = express.Router();

// Get latest data
router.get("/", GetSettings);
router.post("/mapSettings", SetMapSettings);
router.post("/paraInfo", SetParaInfo);

module.exports = router;