// dependencies imports
const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcryptjs");
var postmark = require("postmark");
const htmlTemplate = require("../template/html/otp-mail");
const {validateRequestBody,validateEmail }=require("../utils/common")

// local imports
const Users = require("../db/User");
const CustomError = require("../errors/index");
const { GetDeviceInfo } = require("../db/Device");

var client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);
// ======================================================== Login controller ===============================================================
const loginController = async (req, res) => {
  try {
    // Extract email and password from request body
    const { email, password } = req.body;
    console.log({ email, password });

    // Check if email and password are provided
    if (!validateRequestBody(req.body, ["email", "password"])) {
      return res.status(400).json({ success: false, message: "Request body should contain - email and password" });
    }

    // Check if email is valid
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Email is not valid" });
    }

    // Retrieve user from the database
    const user = await Users.findOne(email);
    console.log({ user });

    // Check if user exist
    if (!user[0][0]) {
      return res.status(400).json({ success: false, message: "User does not exist!" });
    }

    // Compare passwords if it is in HASH
    // const isPasswordCorrect = await bcrypt.compare(
    //   password,
    //   user[0][0].password
    // );

    const isPasswordCorrect = user[0][0].password === password;
    console.log({ isPasswordCorrect });
    if (!isPasswordCorrect) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: "Invalid Credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { email: user[0][0].email, password: user[0][0].password }, // Customize payload as needed
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    // Set the token as a cookie in the response
    res.cookie("info-token-with-secret", token, {
      httpOnly: true,
      maxAge: 36000000, // Cookie expires in 10 hours
    });

    console.log({ productsList: user[0][0].products_list });
    const deviceIds = JSON.parse(user[0][0].products_list || "[]");
    console.log({ deviceIds });

    const productsList = await deviceIds.reduce(async (acc, deviceId) => {
      const [response] = await GetDeviceInfo(deviceId);
      const alias = (await response[0]?.alias) || deviceId;
      acc = [...(await acc), { deviceId, alias }];
      return acc;
    }, []);

    console.log({ productsList });

    // Send success response
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Login successfully",
      token: token,
      productsList,
      address: user[0][0].address,
      firmName: user[0][0].firm_name,
      contactNo: user[0][0].contact,
    });
  } catch (error) {
    // Handle errors

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, error: "Something went wrong | " + error });
  }
};

// =============================================================== register ==================================================================

const registerController = async (req, res) => {
  try {
    const { firmName, password, email, productsList, contactNo, address, otp } = req.body;
    console.log({ reqBody: req.body });
    if (!email || !password || !firmName || !productsList || !contactNo || !address || !otp) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Please provide all the details" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Email is not valid" });
    }

    const user = await Users.findOne(email);
    console.log({ user });

    // Check if user exist
    if (user[0][0]) {
      return res.status(400).json({ success: false, message: "User already exist!" });
    }

    const { success, message } = await Users.verifyOtp(email, otp);
    console.log({ success, message });
    if (success) {
      const user = new Users(firmName, password, email, productsList, contactNo, address);
      user.save();

      // if (response[0]?.affectedRows > 0) {
      res.status(StatusCodes.CREATED).json({ success: true, message: "User Register Successfully" });
      // } else {
      //   res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: "Something went wrong!" });
      // }
    } else {
      res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: message });
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
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Please provide all the details" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: "Email is not valid" });
    }

    const user = await Users.findOne(email);
    console.log({ user });

    // Check if user exist
    if (!user[0][0]) {
      return res.status(400).json({ success: false, message: "User doesn't exist!" });
    }

    const { success, message } = await Users.verifyOtp(email, otp);
    console.log({ success, message });
    if (success) {
      const [response] = await Users.forgetPassword(email, password);
      console.log(response);
      if (response.affectedRows > 0) {
        return res.status(StatusCodes.OK).json({ success: true, message: "Password updated successfully" });
      }

      // if (response[0]?.affectedRows > 0) {
      // res.status(StatusCodes.CREATED).json({ success: true, message: "User Register Successfully" });
      // } else {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: "Something went wrong!" });
      // }
    } else {
      res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: message });
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
    const email = req.query.email;
    const { oldPassword, newPassword } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Please provide email, oldPassword and newPassword" });
    }

    const user = await Users.findOne(email);

    console.log({ user: user[0][0] });
    // Check if user exist
    if (!user[0][0]) {
      return res.status(400).json({ success: false, message: "User does not exist!" });
    }

    // Hash the password
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);
    const updatePassword = await Users.changePassword(email, oldPassword, newPassword);

    console.log({ updatePassword, affectedRows: updatePassword[0].affectedRows });

    if (updatePassword[0].affectedRows === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Old password doesn't match" });
    }

    res.status(200).json({ success: true, message: "User Password Updated Successfully" });
  } catch (error) {
    console.log(error);
    throw new CustomError.BadRequestError(error);
  }
};

const sendOtpController = async (req, res) => {
  try {
    const email = req.query.email;
    const response = await Users.generateOtp(email);

    if (!response.success) {
      return res.status(500).json({ success: false, message: "Something went wrong!" });
    }

    client.sendEmail({
      From: "no-reply@enggenv.com",
      To: email,
      Subject: "Cloud Enviro email verification Code",
      HtmlBody: htmlTemplate(
        "Engineering and Environmental Solutions Pvt Ltd",
        "Cloud Enviro",
        "https://app.enggenv.com/public/elementRed.svg",
        response?.otp
      ),
      TextBody: "",
      MessageStream: "cloud-enviro-v2",
    });

    res.status(StatusCodes.CREATED).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.log(error);
    throw new CustomError.BadRequestError(error);
  }
};

// const verifyOtpController = async (req, res) => {
//   try {
//     const email = req.body.email;
//     const otp = req.body.otp;

//     const { success, message } = await Users.verifyOtp(email, otp);
//     console.log({ success, message });
//     if (success) {
//       return res.status(StatusCodes.OK).json({ success: true, message: "OTP verified successfully" });
//     }

//     res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: message });
//   } catch (er) {
//     console.log(er);
//     throw new CustomError.BadRequestError(er);
//   }
// };

const userExistsController = async (req, res) => {
  try {
    const email = req.query.email;
    const user = await Users.findOne(email);
    if (user[0][0]) {
      return res.status(StatusCodes.OK).json({ success: false, message: "User already exists" });
    }
    res.status(StatusCodes.OK).json({ success: true, message: "User does not exist" });
  } catch (er) {
    console.log(er);
    throw new CustomError.BadRequestError(er);
  }
};



module.exports = { userExistsController, loginController, registerController, changePasswordController, sendOtpController, forgetPasswordController };
