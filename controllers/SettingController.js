const Settings = require("../models/Settings");
const { validateRequestBody } = require("../utils/common");
var postmark = require("postmark");
const fs = require('fs');
const path = require('path');

const htmlTemplate = require("../template/html/bug-mail");

var client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);

const GetSettings = async (req, res) => {
  try {
    const { email } = req.user;

    const settingsObj = new Settings({ email });
    const settings = await settingsObj.getSettings();
    console.log(settings[0]);
    res.status(200).json({ success: "true", data: settings[0] });
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .json({ success: "false", message: "Internal Server Error" });
  }
};

const SetMapSettings = async (req, res) => {
  try {
    const { email } = req.user;

    if (!validateRequestBody(req.body, ["mapCenter", "zoomLevel"])) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Request body should contain - mapCenter and zoomLevel",
        });
    }
    const { zoomLevel, mapCenter } = req.body;

    const settings = await Settings.setMapSettings(
      JSON.stringify({ zoomLevel, mapCenter }),
      email
    );
    if (settings[0].affectedRows > 0) {
      return res
        .status(200)
        .json({
          success: "true",
          message: "Map settings updated successfully",
        });
    }
    res
      .status(501)
      .json({ success: "false", message: "Failed to update map settings!" });
  } catch (er) {
    console.log(er);
    return res
      .status(500)
      .json({
        success: "false",
        message: "Something Went Wrong. |  Error: " + er,
      });
  }
};

const SetParaInfo = async (req, res) => {
  try {
    const { email } = req.user;
    const { paraInfo } = req.body;
    const oldSettings = new Settings(email);
    const [oldSettingsData] = await oldSettings.getSettings();

    console.log(oldSettingsData[0]);
    const oldParaInfo = oldSettingsData[0]
      ? JSON.parse(oldSettingsData[0].para_info)
      : {};
    const data = JSON.stringify({ ...oldParaInfo, ...paraInfo });
    const settings = await Settings.setParaSettings(data, email);
    if (settings[0].affectedRows > 0) {
      return res
        .status(200)
        .json({ success: "true", message: "Para Info updated successfully" });
    }
    res
      .status(501)
      .json({ success: "false", message: "Failed to update Para Info!" });
  } catch (er) {
    console.log(er);
    return res
      .status(500)
      .json({
        success: "false",
        message: "Something Went Wrong. |  Error: " + er,
      });
  }
};

const reportBug = async (req, res) => {
  try {

    console.log({body:req.body, files:req.files })
    const { email } = req.user;

    let {title, description, errorInfo, otherInfo } = req.body;
    const files = req.files;

    console.log({files})


    if (typeof otherInfo === "string") otherInfo = JSON.parse(otherInfo);
    if (typeof errorInfo === "string") errorInfo = JSON.parse(errorInfo);

    // Prepare attachments array
    const attachments = files.map((file) => ({
      Name: file.originalname,
      Content: fs.readFileSync(file.path).toString("base64"),
      ContentType: file.mimetype,
    }));

    client.sendEmail({
      From: "ce-bug-reporting@enggenv.com",
      To: "sheharyar@enggenv.com",
      Subject: `One Bug Reported by ${email}`,
      HtmlBody: htmlTemplate(
        title,
        email,
        new Date().toDateString(),
        description,
        otherInfo,
        errorInfo
      ),
      TextBody: "",
      MessageStream: "cloud-enviro-v2",
      Attachments: attachments
    });

    return res
      .status(200)
      .json({ success: "true", message: "Bug reported successfully" });
  } catch (er) {
    console.log(er);
    return res
      .status(500)
      .json({
        success: "false",
        message: "Something Went Wrong. |  Error: " + er,
      });
  }
};

module.exports = { GetSettings, SetMapSettings, SetParaInfo, reportBug };
