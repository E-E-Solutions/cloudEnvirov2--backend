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

    // Retrieve user from the database
    const user = await Users.findOne(email);
    // Check if user exists
    if (!user) {
      throw new CustomError.BadRequestError("No user found with this email");
    }

    // Compare passwords
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user[0][0].password
    );

    if (!isPasswordCorrect) {
      throw new CustomError.UnauthenticatedError("Invalid Credentials");
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, // Customize payload as needed
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "12h" }
    );

    // Set the token as a cookie in the response
    res.cookie("info-token-with-secret", token, {
      httpOnly: true,
      maxAge: 36000000, // Cookie expires in 10 hours
    });

    // Send success response
    res.status(StatusCodes.OK).json({ message: "Login successful", token });
  } catch (error) {
    // Handle errors
    console.error("Login error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Something went wrong" });
  }
};

// =============================================================== register ==================================================================

const registerController = async (req, res) => {
  try {
    const { emailId, password, name } = req.body;

    if (!emailId || !password || !name) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Please provide emailId and password" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new Users(name, hashedPassword, emailId);
    await user.save();
    res.status(StatusCodes.CREATED).json("Successfully user Register");
  } catch (error) {
    console.log(error);
    throw new CustomError.BadRequestError(error);
  }
};

module.exports = { loginController, registerController };
