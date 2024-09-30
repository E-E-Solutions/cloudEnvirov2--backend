const express = require("express");
const { GetLatestData } = require("../controllers/DataController");

const router = express.Router();

// Get latest data
router.get("/", GetLatestData);

module.exports = router;
