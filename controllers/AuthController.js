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
const Admin = require("../models/Admin");
const CustomError = require("../errors/index");
const { GetDeviceInfo } = require("../models/Device");

const { oauth2client } = require("../utils/googleConfig");
const Reseller = require("../models/Reseller");
// const Admin = require("../models/Admin");


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

    const [userResult] = await Users.findByEmail(email);
    const user = userResult[0];

    let currentUser = user;
    let isReseller = false;

    if (!currentUser) {
      const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
      currentUser = resellerResult[0];
      isReseller = true;
    }

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

    const deviceIds = JSON.parse(currentUser.products_list || "[]");

    const productsList = await deviceIds.reduce(async (acc, deviceId) => {
      const [response] = await GetDeviceInfo(deviceId);
      const alias = (await response[0].alias) || deviceId;
      acc = [...(await acc), { deviceId, alias }];
      return acc;
    }, []);
  
    res.status(200).json({
      success: true,
      message: "Login successfully",
      token,
      productsList,
      isVerified: !!currentUser.isVerified,
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

    const [userResult] = await Users.findByEmail(email);
    const user = userResult[0];

    let currentUser = user;
    let isReseller = false;

    if (!currentUser) {
      const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
      currentUser = resellerResult[0];
      isReseller = true;
    }

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
        password: currentUser.password,role:user[0][0].role, 
        role: isReseller ? "resellerUser" : currentUser.role,
      },
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

    const password = "1mllf7imc5huf64r66dhqcc0t7jgh57j";
    const role = req.body.role || "user";
    const roleId = await Admin.findRoleId(role)
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
        { email, password,role }, // Customize payload as needed
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
      email
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
    const role = req.body.role || "user";
    const roleId = await Admin.findRoleId(role)

    const user = await Users.findOne(email);
    console.log({ user });

    // Check if user exist
    if (user[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "User already exist!" });
    }
    const isVerified = true;
    const { success, message } = await Users.verifyOtp(email, otp);
   
    console.log({ success, message });
    if (success) {
      const user = new Users(
        firmName,
        password,
        email,
        productsList,
        contactNo,
        address,
        roleId
      ,isVerified);
      user.save();
      const role = "user";
      const token = jwt.sign(
        { email, password,role }, // Customize payload as needed
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
        email,
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

    if (!email || !password || !otp) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Please provide email, password, and OTP",
      });
    }

    if (!validateEmail(email)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Email is not valid",
      });
    }

    // Check in Users table first
    const [userResult] = await Users.findByEmail(email);
    let currentUser = userResult[0];
    let isReseller = false;

    // If not found, check in Reseller table
    if (!currentUser) {
      const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
      currentUser = resellerResult[0];
      isReseller = !!currentUser;
    }

    if (!currentUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "User does not exist!",
      });
    }

    // Verify OTP
    const { success, message } = await Users.verifyOtp(email, otp);
    if (!success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: message || "Invalid OTP",
      });
    }

    // Update password
    let response;
    if (isReseller) {
      [response] = await Users.forgetResellerUserPassword(email, password);
    } else {
      [response] = await Users.forgetPassword(email, password);
    }

    if (response.affectedRows > 0) {
      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Password updated successfully",
      });
    } else {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Something went wrong!",
      });
    }

  } catch (error) {
    console.error("Forget Password Error:", error);
    throw new CustomError.BadRequestError("Failed to reset password");
  }
}


const changePasswordController = async (req, res) => {
  try {
    const { email, role } = req.user;
    const { oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Please provide email, oldPassword, and newPassword",
      });
    }

    // First check in Users table
    const [userResult] = await Users.findByEmail(email);
    let currentUser = userResult[0];

    // If not found in Users, check in Reseller
    if (!currentUser && role === "resellerUser") {
      const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
      currentUser = resellerResult[0];
    }

    if (!currentUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "User does not exist!",
      });
    }

    // Call the correct changePassword function
    let updatePassword;
    if (role === "resellerUser") {
      updatePassword = await Reseller.changePassword(email, oldPassword, newPassword);
    } else {
      updatePassword = await Users.changePassword(email, oldPassword, newPassword);
    }

    const affectedRows = updatePassword[0].affectedRows || 0;

    if (affectedRows === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Old password doesn't match",
      });
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Password updated successfully",
    });

  } catch (error) {
    console.error("Error changing password:", error);
    throw new CustomError.BadRequestError("Failed to change password");
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
      fetchUserDetails = resellerResult[0];
    } else {
      const [userResult] = await Users.findByEmail(email);
      fetchUserDetails = userResult[0];
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

    if (updateResult[0].affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Firm information could not be updated",
      });
    }

    // Fetch updated data
    let updatedUser;
    if (role === "resellerUser") {
      const [resellerUpdated] = await Reseller.findResellersUserByEmailId(email);
      updatedUser = resellerUpdated[0];
    } else {
      const [userUpdated] = await Users.findOne(email);
      updatedUser = userUpdated[0];
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

    if (!email) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check in Users table
    const [userRows] = await Users.findOne(email);
    const user = userRows[0];

    if (user) {
      return res.status(StatusCodes.OK).json({
        success: false,
        message: "User already exists",
      });
    }

    // If not found, check in Reseller table
    const [resellerRows] = await Reseller.findResellersUserByEmailId(email);
    const resellerUser = resellerRows[0];

    if (resellerUser) {
      return res.status(StatusCodes.OK).json({
        success: false,
        message: "User already exists",
      });
    }

    // User not found in either table
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "User does not exist",
    });

  } catch (error) {
    console.error("userExistsController error:", error);
    throw new CustomError.BadRequestError(error);
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
