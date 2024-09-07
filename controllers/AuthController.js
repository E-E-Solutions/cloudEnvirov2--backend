// dependencies imports
const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcryptjs");

// local imports
const Users = require("../db/user");
const CustomError = require("../errors/index");

// ======================================================== Login controller ===============================================================
const loginController = async (req, res) => {
  try {
    // Extract email and password from request body
    const { email, password } = req.body;

    console.log({ email, password });

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

    console.log({ email: user[0][0].email, password: user[0][0].password });

    // Generate JWT token
    const token = jwt.sign(
      { email: user[0][0].email, password: user[0][0].password }, // Customize payload as needed
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "12h" }
    );

    // Set the token as a cookie in the response
    res.cookie("info-token-with-secret", token, {
      httpOnly: true,
      maxAge: 36000000, // Cookie expires in 10 hours
    });

    console.log({ productsList: user[0][0].products_list });
    const productsList = user[0][0].products_list || "[]";
    console.log({ productsList });

    // Send success response
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Login successfully",
      token: token,
      productsList: JSON.parse(productsList),
      address: user[0][0].address,
      firmName: user[0][0].firm_name,
      contactNo: user[0][0].contact,
    });
  } catch (error) {
    // Handle errors

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Something went wrong" });
  }
};

// =============================================================== register ==================================================================

const registerController = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Please provide email and password" });
    }

    // Hash the password
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);
    const user = new Users(name, password, email);
    await user.save();
    res.status(StatusCodes.CREATED).json({ success: true, message: "User Register Successfully" });
  } catch (error) {
    console.log({ error });
    throw new CustomError.BadRequestError(error);
  }
};

const changePasswordController = async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;

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

module.exports = { loginController, registerController, changePasswordController };
