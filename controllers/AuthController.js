// dependencies imports
const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcryptjs");
var postmark = require("postmark");
const htmlTemplate = require("../template/html/otp-mail");
const { validateRequestBody, validateEmail } = require("../utils/common");
const https = require("https"); // Use https for secure requests

// local imports
const Users = require("../models/User");
const CustomError = require("../errors/index");
const { GetDeviceInfo } = require("../models/Device");

const { oauth2client } = require("../utils/googleConfig");
const Reseller = require("../models/Reseller");

var client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);
// ======================================================== Login controller ===============================================================
const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!validateRequestBody(req.body, ["email", "password"])) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - email and password",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Email is not valid",
      });
    }

    // Try to fetch user from Users table
    const [userResult] = await Users.findByEmail(email);
    const user = userResult?.[0];

    // If not found, try reseller
    let currentUser = user;
    let isReseller = false;

    if (!currentUser) {
      const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
      currentUser = resellerResult?.[0];
      isReseller = true;
    }

    // If still not found
    if (!currentUser) {
      return res.status(400).json({
        success: false,
        message: "User does not exist!",
      });
    }

    const isPasswordCorrect = currentUser.password === password;
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid Credentials",
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        email: currentUser.email,
        password: currentUser.password, 
        role: isReseller ? "resellerUser" : currentUser.role,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    // Set cookie
    res.cookie("info-token-with-secret", token, {
      httpOnly: true,
      maxAge: 36000000,
    });

    // Parse devices
    const deviceIds = JSON.parse(currentUser.products_list || "[]");

    const productsList = await deviceIds.reduce(async (acc, deviceId) => {
      const [response] = await GetDeviceInfo(deviceId);
      const alias = (await response?.[0]?.alias) || deviceId;
      acc = [...(await acc), { deviceId, alias }];
      return acc;
    }, []);

    // Final response
    res.status(200).json({
      success: true,
      message: "Login successfully",
      token,
      productsList,
      address: currentUser.address || null,
      firmName: currentUser.firm_name || null,
      contactNo: currentUser.contact || null,
      email: currentUser.email,
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Something went wrong | " + error.message,
    });
  }
};


const googleLoginController = async (req, res) => {
  const { code } = req.query;
  try {
    if (!code) {
      throw new Error("Authorization code is missing.");
    }
    console.log({ code });

    const { email, name, picture } = await getUserInfoFromGoogle(code);

    const user = await Users.findOne(email);
    console.log({ user });

    if (!user || !user[0] || !user[0][0]) {
      return res
        .status(200)
        .json({
          success: true,
          exists: false,
          message: "New User, Need some more information",
        });
    }

    const token = jwt.sign(
      { email: user[0][0].email, password: user[0][0].password },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("info-token-with-secret", token, {
      httpOnly: true,
      maxAge: 36000000, // Cookie expires in 10 hours
    });

    let deviceIds = [];
    if (user[0][0].products_list) {
      deviceIds = JSON.parse(user[0][0].products_list);
    }

    console.log({ deviceIds });

    const productsList = await deviceIds.reduce(async (acc, deviceId) => {
      const [response] = await GetDeviceInfo(deviceId);
      let alias;
      if (response[0] && response[0].alias) {
        alias = response[0].alias;
      } else {
        alias = deviceId;
      }
      acc = [...(await acc), { deviceId, alias }];
      return acc;
    }, []);

    let address = "";
    if (user[0][0].address) {
      address = user[0][0].address;
    }

    let firmName = "";
    if (user[0][0].firm_name) {
      firmName = user[0][0].firm_name;
    }

    let contactNo = "";
    if (user[0][0].contact) {
      contactNo = user[0][0].contact;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      exist: true,
      message: "Login successfully",
      token: token,
      productsList,
      address: address,
      firmName: firmName,
      contactNo: contactNo,
      name,
      picture,
      email,
    });
  } catch (er) {
    console.error("Error occurred:", er);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Something went wrong | " + er.message,
      env: {
        code: code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      },
    });
  }
};

const registerWithGoogleController = async (req, res) => {
  try {
    const { email, firmName, productsList, contactNo, address } = req.body;
    console.log({ reqBody: req.body });
    if (!email || !firmName || !productsList || !contactNo || !address) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: "Please provide all the details" });
    }

    const password='1mllf7imc5huf64r66dhqcc0t7jgh57j'
    console.log({
      firmName,
      password,
      email,
      productsList,
      contactNo,
      address,
    });
    
    
      const user = new Users(firmName, password, email, productsList, contactNo, address);
      user.save();

      const token = jwt.sign(
        { email, password }, // Customize payload as needed
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );

    // if (response[0]?.affectedRows > 0) {
    // res.status(StatusCodes.CREATED).json({ success: true, message: "User Register Successfully",  });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "User Register Successfully",
      token: token,
      productsList,
      address,
      firmName,
      contactNo,
    });
    // } else {
    //   res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: "Something went wrong!" });
    // }

    // Hash the password
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);
  } catch (error) {
    console.log({ error });
    throw new CustomError.BadRequestError(error);
  }
};

// =============================================================== register ==================================================================

const registerController = async (req, res) => {
  try {
    const { firmName, password, email, productsList, contactNo, address, otp } =
      req.body;
    console.log({ reqBody: req.body });
    if (
      !email ||
      !password ||
      !firmName ||
      !productsList ||
      !contactNo ||
      !address ||
      !otp
    ) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: "Please provide all the details" });
    }

    if (!validateEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Email is not valid" });
    }

    const user = await Users.findOne(email);
    console.log({ user });

    // Check if user exist
    if (user[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "User already exist!" });
    }

    const { success, message } = await Users.verifyOtp(email, otp);
    console.log({ success, message });
    if (success) {
      const user = new Users(firmName, password, email, productsList, contactNo, address);
      user.save();

      const token = jwt.sign(
        { email, password }, // Customize payload as needed
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );

      // if (response[0]?.affectedRows > 0) {
      // res.status(StatusCodes.CREATED).json({ success: true, message: "User Register Successfully",  });

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: "User Register Successfully",
        token: token,
        productsList,
        address,
        firmName,
        contactNo,
      });
      // } else {
      //   res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: "Something went wrong!" });
      // }
    } else {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: message });
    }

    // Hash the password
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);
  } catch (error) {
    console.log({ error });
    throw new CustomError.BadRequestError(error);
  }
};

const forgetPasswordController = async (req, res) => {
  try {
    const { email } = req.query;
    const { password, otp } = req.body;
    console.log({ reqBody: req.body });
    if (!email || !password || !otp) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: "Please provide all the details" });
    }

    if (!validateEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Email is not valid" });
    }

    const user = await Users.findOne(email);
    console.log({ user });

    // Check if user exist
    if (!user[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "User doesn't exist!" });
    }

    const { success, message } = await Users.verifyOtp(email, otp);
    console.log({ success, message });
    if (success) {
      const [response] = await Users.forgetPassword(email, password);
      console.log(response);
      if (response.affectedRows > 0) {
        return res
          .status(StatusCodes.OK)
          .json({ success: true, message: "Password updated successfully" });
      }

      // if (response[0]?.affectedRows > 0) {
      // res.status(StatusCodes.CREATED).json({ success: true, message: "User Register Successfully" });
      // } else {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: "Something went wrong!" });
      // }
    } else {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: message });
    }

    // Hash the password
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);
  } catch (error) {
    console.log({ error });
    throw new CustomError.BadRequestError(error);
  }
};

const changePasswordController = async (req, res) => {
  try {
    const email = req.user.email;
    const { oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({
          success: false,
          message: "Please provide email, oldPassword and newPassword",
        });
    }

    const user = await Users.findOne(email);

    console.log({ user: user[0][0] });
    // Check if user exist
    if (!user[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "User does not exist!" });
    }

    // Hash the password
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);
    const updatePassword = await Users.changePassword(
      email,
      oldPassword,
      newPassword
    );

    console.log({
      updatePassword,
      affectedRows: updatePassword[0].affectedRows,
    });

    if (updatePassword[0].affectedRows === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ success: false, message: "Old password doesn't match" });
    }

    res
      .status(200)
      .json({ success: true, message: "User Password Updated Successfully" });
  } catch (error) {
    console.log(error);
    throw new CustomError.BadRequestError(error);
  }
};

const updateFirmInfoController = async (req, res) => {
  try {
    const { email, role } = req.user;
    const { firmName, firmAddress, contactNo } = req.body;

    if (!firmName || !firmAddress || !contactNo) {
      return res.status(400).json({
        success: false,
        message: "Please provide firmName, firmAddress, and contactNo",
      });
    }

    let fetchUserDetails;
    if (role === "resellerUser") {
      const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
      fetchUserDetails = resellerResult?.[0];
    } else {
      const [userResult] = await Users.findByEmail(email);
      fetchUserDetails = userResult?.[0];
    }

    if (!fetchUserDetails) {
      return res.status(400).json({
        success: false,
        message: "User does not exist!",
      });
    }

    let updateResult;
    if (role === "resellerUser") {
      updateResult = await Users.updateResellerUserFirmInfo(
        email,
        firmName,
        firmAddress,
        contactNo
      );
    } else {
      updateResult = await Users.updateFirmInfo(
        email,
        firmName,
        firmAddress,
        contactNo
      );
    }

    if (updateResult?.[0]?.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Firm information could not be updated",
      });
    }

    // Fetch updated data
    let updatedUser;
    if (role === "resellerUser") {
      const [resellerUpdated] = await Reseller.findResellersUserByEmailId(email);
      updatedUser = resellerUpdated?.[0];
    } else {
      const [userUpdated] = await Users.findOne(email);
      updatedUser = userUpdated?.[0];
    }

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: "Unable to fetch updated user information",
      });
    }

    const { firm_name, address, contact } = updatedUser;

    res.status(200).json({
      success: true,
      message: "User firm info updated successfully",
      data: {
        firmName: firm_name,
        address,
        contactNo: contact,
      },
    });
  } catch (error) {
    console.error("Update Firm Info Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};


const sendOtpController = async (req, res) => {
  try {
    const email = req.query.email;
    const response = await Users.generateOtp(email);

    if (!response.success) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong!" });
    }

    client.sendEmail({
      From: "no-reply@enggenv.com",
      To: email,
      Subject: "Cloud Enviro email verification Code",
      HtmlBody: htmlTemplate(
        "Engineering and Environmental Solutions Pvt Ltd",
        "Cloud Enviro",
        "https://app.enggenv.com/public/elementRed.svg",
        response.otp
      ),
      TextBody: "",
      MessageStream: "cloud-enviro-v2",
    });

    res
      .status(StatusCodes.CREATED)
      .json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.log(error);
    throw new CustomError.BadRequestError(error);
  }
};

const verifyOtpController = async (req, res) => {
  try {
    const email = req.body.email;
    const otp = req.body.otp;

    const { success, message } = await Users.verifyOtp(email, otp);
    console.log({ success, message });
    if (success) {
      return res.status(StatusCodes.OK).json({ success: true, message: "OTP verified successfully" });
    }

    res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: message });
  } catch (er) {
    console.log(er);
    throw new CustomError.BadRequestError(er);
  }
};

const userExistsController = async (req, res) => {
  try {
    const email = req.query.email;
    const user = await Users.findOne(email);
    if (user[0][0]) {
      return res
        .status(StatusCodes.OK)
        .json({ success: false, message: "User already exists" });
    }
    res
      .status(StatusCodes.OK)
      .json({ success: true, message: "User does not exist" });
  } catch (er) {
    console.log(er);
    throw new CustomError.BadRequestError(er);
  }
};

const getUserInfoFromGoogle = async (code) => {
  try {
    const googleTokenOptions = {
      hostname: "oauth2.googleapis.com",
      path: `/token`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    console.log({
      code: code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const postData = new URLSearchParams({
      code: code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString();

    const googleTokenRequest = new Promise((resolve, reject) => {
      const request = https.request(googleTokenOptions, (response) => {
        let responseBody = "";
        response.on("data", (chunk) => (responseBody += chunk));
        response.on("end", () => resolve(JSON.parse(responseBody)));
      });

      request.on("error", reject);
      request.write(postData);
      request.end();
    });

    const googleRes = await googleTokenRequest;
    console.log({ googleRes });
    if (!googleRes || !googleRes.access_token) {
      throw new Error("Failed to fetch access token.");
    }

    console.log({ googleRes });

    const access_token = googleRes.access_token;

    const userInfoOptions = {
      hostname: "www.googleapis.com",
      path: `/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      method: "GET",
    };

    const userInfoRequest = new Promise((resolve, reject) => {
      const request = https.request(userInfoOptions, (response) => {
        let responseBody = "";
        response.on("data", (chunk) => (responseBody += chunk));
        response.on("end", () => resolve(JSON.parse(responseBody)));
      });

      request.on("error", reject);
      request.end();
    });

    const userData = await userInfoRequest;
    if (!userData.email) {
      throw new Error("Email not found in user data.");
    }
    return userData;
  } catch (er) {
    console.log({ er });
    return er;
  }
};


module.exports = {
  userExistsController,
  loginController,
  googleLoginController,
  registerWithGoogleController,
  registerController,
  changePasswordController,
  sendOtpController,
  forgetPasswordController,
  updateFirmInfoController,
  verifyOtpController
};
