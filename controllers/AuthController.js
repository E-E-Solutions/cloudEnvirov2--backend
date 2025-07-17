// dependencies imports
const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");
const bcrypt = require("bcryptjs");
var postmark = require("postmark");
const htmlTemplate = require("../template/html/otp-mail");
const { validateRequestBody, validateEmail } = require("../utils/common");
const https = require("https"); // Use https for secure requests

var client = new postmark.ServerClient("d7c1a2c7-ed9c-41ef-8dfa-0462caebdb92");

// local imports
const Users = require("../models/User");
const Admin = require("../models/Admin");
const Device = require("../models/Device");
const CustomError = require("../errors/index");
const { GetDeviceInfo } = require("../models/Device");

const { oauth2client } = require("../utils/googleConfig");
const Reseller = require("../models/Reseller");
const { stringify } = require("querystring");
// const Admin = require("../models/Admin");
const crypto = require("crypto");

function decryptVendorId({ cipherText, iv }, secretKey) {
  const salt = Buffer.from("my-salt", "utf8");
  const ivBuffer = Buffer.from(iv, "base64");
  const encryptedBuffer = Buffer.from(cipherText, "base64");

  // Derive key from password
  const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, "sha256");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuffer);

  // ✅ Web Crypto includes the auth tag automatically at the end of the cipherText
  // But Node expects it set explicitly, so we must extract it manually
  const authTag = encryptedBuffer.slice(encryptedBuffer.length - 16);
  const actualEncrypted = encryptedBuffer.slice(0, encryptedBuffer.length - 16);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(actualEncrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// ======================================================== Login controller ===============================================================
const loginController = async (req, res) => {
 let currentUser;
  try {
 var { email, password, vendorId } = req.body;
 console.log({ email, password, vendorId });

var resolvedVendorId;
if (vendorId && typeof vendorId === "object" && vendorId.cipherText && vendorId.iv) {
  try {
    resolvedVendorId = await decryptVendorId(vendorId,  process.env.VENDOR_SECRET_KEY);
    console.log("Decrypted Vendor ID:", resolvedVendorId);
  } catch (err) {
    console.error("Decryption error:", err);
await Users.logUserActivity(
      "unknown",
      email,
      "Login",
      `decryption error: ${err.message}`,
      "failure",
      "",
      { email, password, resolvedVendorId }
    );
    return res.status(400).json({
      success: false,
      message: "Failed to decrypt vendor ID",
    });
  }
}



    // if (!validateRequestBody(req.body, ["email", "password"])) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Request body should contain - email and password",
    //   });
    // }

    if(!email ||!password){
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

    let isReseller;
    const [userResult] = await Users.findByEmail(email);
    let user = userResult[0];
    if(!resolvedVendorId){

    currentUser = user;
    console.log({currentUser})
    isReseller = false;
    }

    if (!currentUser) {
      if(!resolvedVendorId){
        return res.status(400).json({
        success: false,
        message: "Please provide Vendor Id!",
      });
      }
      const [existedVendorId] = await Reseller.vendorIdExists(email,resolvedVendorId)
      const roleRow = await Users.findRoleByEmail(email);

      let roleId;
      if(roleRow){       
      roleId = roleRow.role_id;
      }


      const [userDetails] = await Users.findByRole(email,roleId)
     
      const [userRole]= userDetails.map((user)=>user.role)
      if(userRole === "admin"){
         const [adminResult] = await Users.findByEmail(email);

      user = adminResult[0];
      currentUser = user;
      }
      if(userRole === "reseller" && existedVendorId[0].vendor_id === resolvedVendorId){

      const [resellerResult] = await Users.findByEmail(email);

      user = resellerResult[0];
      currentUser = user;
      if(currentUser){
        await Users.updateLastLoginForReseller(email)
      }   
     }
     
      if(!currentUser){
        const [resellerUserExist] = await Reseller.findResellersUserByEmailId(email);
        if(!resellerUserExist[0]){
           const [userResult] = await Users.findByEmail(email);
           if(userResult[0]){
            currentUser = userResult[0]
            console.log({currentUser})
             const isPasswordCorrect = currentUser.password === password;
            if (!isPasswordCorrect) {
              return res.status(401).json({
                success: false,
                message: "Invalid Credentials",
              });
            }
            console.log({email, password,firmname:currentUser.firm_name,contact:currentUser.contact, address:currentUser.address,resolvedVendorId, productsList:currentUser.products_list})
            const firmName = currentUser.firm_name || "";
            const contactNo = currentUser.contact || "";
            const address = currentUser.address || "";
            const productsList = currentUser.products_list ? JSON.parse(currentUser.products_list) : [];
            const newReseller = await Users.createResellerUser(email, password, firmName,contactNo,address,resolvedVendorId, productsList);
            console.log(newReseller,"newReseller")
            if(!newReseller){
              return res.status(400).json({
                success:false,
                message:"Failed to login reseller user",
              })
            }
           }
        }
        if(resellerUserExist[0]){
      const [existedVendorId] = await Reseller.vendorUserIdExists(email,resolvedVendorId)

       if((existedVendorId && existedVendorId[0].vendor_id === resolvedVendorId)  || existedVendorId[0].vendor_id ===null){
        
      const [matchVendorId] = await Reseller.checkVendorId(resolvedVendorId)
      console.log({matchVendorId})
      if(matchVendorId.length<=0){
        return res.status(400).json({
        success: false,
        message: "Vendor Id doesn't exists!",
      });
      }
      else{
      const isAllowedAccess = await Reseller.findAccessStatus(email)
      if(!isAllowedAccess.accessStatus){
            return res.status(404).json({
              success: false,
              message: "Your service has ended. Please contact the account administrator for assistance.",

            });
      }
      const [resellerUserResult] = await Reseller.findResellersUserByEmailId(email);
      currentUser = resellerUserResult[0]; 
      if(currentUser){
        await Users.updateLastLoginForResellerUser(email)
      } 
    
      isReseller = true;

      if(isReseller){
      const [rows] = await Reseller.fetchResellerUserDevices(email);
      
          if (rows.length === 0) {
            return res.status(404).json({
              success: false,
              message: "User not found.",
            });
          }
         let deviceIds = [];

try {
  deviceIds = JSON.parse(rows[0].products_list || "[]");

  for (let i = 0; i < deviceIds.length; i++) {
    const deviceId = deviceIds[i];

    // Await async call to checkDevice
    const validateDevice = await Admin.checkDevice(deviceId);

    // If device is invalid AND vendor_id is null
    if (!validateDevice[0].length>0 && existedVendorId[0].vendor_id === null) {
      return res.status(400).json({
        success: false,
        message: `You own an invalid Device ID in your account. Please contact support.`,
      });
    }
  }

  // If all device IDs are valid, proceed to update
  const updatedId = await Reseller.addVendorId(resolvedVendorId, email);
  

          } catch (err) {
            return res.status(500).json({
              success: false,
              message: "Failed to parse device list.",
              error: err.message,
            });
          }
        const [resellerRows] = await Reseller.findReseller(resolvedVendorId);
        if (resellerRows.length > 0) {
          const resellerEmail = resellerRows[0].email;

            const resellerDevices = await Reseller.fetchResellerDevices(resellerEmail);
            const productsListRaw = resellerDevices[0][0].products_list;

            let mergedList;

            if (productsListRaw !== null) {
              let parsedList = [];

              try {
                parsedList = JSON.parse(productsListRaw); // Convert string to array
              } catch (err) {
                console.error("Invalid JSON in products_list:", productsListRaw);
                parsedList = []; // fallback
              }

              mergedList = Array.from(new Set([...parsedList, ...deviceIds]));
            } else {
              mergedList = deviceIds;
            }

              updateResult = await Admin.updateResellerDeviceInfo(resellerEmail, mergedList);
              await Admin.updateUserDeviceInfo(resellerEmail, mergedList);
        } 
        }
      }
      }
    }
      if(!currentUser && !isReseller){
         return res.status(401).json({
        success: false,
        message: "You are not Authorised to get Access!",
      });
      }
    }
      
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
      let alias;

      if(response[0]){

      alias = (await response[0].alias) || deviceId;
      }
      acc = [...(await acc), { deviceId, alias }];
      return acc;
    }, []);
    let role;
     if(isReseller){
      role = "resellerUser";
    }
    else{
      role = currentUser.role
       }
    await Users.logUserActivity(role ,email, "Login", "User logged in","success","",{ email, password,resolvedVendorId });
  
  
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
    let role
     if(currentUser){
      role = currentUser.role || "unknown";
    }
     await Users.logUserActivity(
      role,
      email,
      "Login",
      `error: ${error.message}`,
      "failure",
      "",
      { email, password, resolvedVendorId }
    );
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Something went wrong | " + error.message,
    });
  }
};

const googleLoginController = async (req, res) => {

  var { code } = req.query;
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

   

    // Generate JWT
    const token = jwt.sign(
      {
        email: currentUser.email,
        password: currentUser.password,role:currentUser.role, 
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
    if (currentUser.products_list) {
      deviceIds = JSON.parse(currentUser.products_list);
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
    if (currentUser.address) {
      address = currentUser.address;
    }

    let firmName = "";
    if (currentUser.firm_name) {
      firmName = currentUser.firm_name;
    }

    let contactNo = "";
    if (currentUser.contact) {
      contactNo = currentUser.contact;
    }

    // await Users.logUserActivity(currentUser.role ,email, "Login", "User logged in successfully using google account","success","",{ email, code });


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

      // await Users.logUserActivity(currentUser.role ,email, "Login", "error:error.message","failure","",{ email, code });

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
    var { email, firmName, productsList, contactNo, address } = req.body;
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
    // await Users.logUserActivity(currentUser.role ,email, "Signup", "User registered using google account", "success","",{ email, password, role });


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

    var {
      firmName,
      password,
      email,
      productsList,
      contactNo,
      address,
      otp,
      vendorId,
    } = req.body;

    if (!email || !password || !firmName || !productsList || !contactNo || !address || !otp) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Please provide all the details",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Email is not valid",
      });
    }
    let role;
    if(vendorId){
     role = "resellerUser";
    }
    else{
      role= "user"
    }
    const roleId = await Admin.findRoleId(role);

    let success, message;
    let resolvedVendorId = null;
    if (vendorId && typeof vendorId === "object" && vendorId.cipherText && vendorId.iv) {
      try {
        resolvedVendorId = await decryptVendorId(vendorId,  process.env.VENDOR_SECRET_KEY);
        console.log("Decrypted Vendor ID:", resolvedVendorId);
      } catch (err) {
        console.error("Decryption error:", err);
        return res.status(400).json({
          success: false,
          message: "Failed to decrypt vendor ID",
        });
      }
    }
    if(!resolvedVendorId && vendorId){
      return res.status(400).json({
        success: false,
        message: "Cannot resolve vendor id!",
      });
    }

    if (resolvedVendorId) {
      const resellerUser = await Reseller.findResellerUser(resolvedVendorId, email);
      if (resellerUser[0][0]) {
        return res.status(400).json({
          success: false,
          message: "User already exists!",
        });
      }
     for (const deviceId of productsList) {
        if (!deviceId) {
          return res.status(400).json({
            success: false,
            message: "Each device must have a valid deviceId.",
          });
        }

        const deviceInfo = await Device.GetDeviceAlias(deviceId);
        const alias = deviceInfo[0][0].alias
        var updatedProductsList =[{deviceId:deviceId, alias:alias }]

        const result = await Reseller.checkDevice(resolvedVendorId,deviceId);
  
        if (!result[0][0]) {
          return res.status(400).json({
            success: false,
            message: `Device ID ${deviceId} is not linked to your vendor profile. Please verify the ID or contact support.`,
          });
        }
      }
      const hasDuplicates = new Set(productsList).size !== productsList.length;
      if (hasDuplicates) {
        return res.status(400).json({
          success: false,
          message: "Duplicate device IDs are not allowed.",
        });
      }

      ({ success, message } = await Users.verifyOtp(email, otp));

      if (!success) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message });
      }

      const newUser = await Users.createResellerUser(email, password, firmName,contactNo, address,resolvedVendorId, productsList);
      console.log({ newUser });
 const token = jwt.sign(
      { email, password, role:"resellerUser" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );
      return res.status(StatusCodes.CREATED).json({
        success: true,

        message: "Reseller user registered successfully",
        token,
      productsList:updatedProductsList,
      address,
      email,
      firmName,
      contactNo,
      });
    }

    // Regular user registration
    const user = await Users.findOne(email);
    if (user[0][0]) {
      return res.status(400).json({
        success: false,
        message: "User already exists!",
      });
    }

    ({ success, message } = await Users.verifyOtp(email, otp));

    if (!success) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message });
    }

    const newUser = new Users(
      firmName,
      password,
      email,
      productsList,
      contactNo,
      address,
      roleId,
      true // isVerified
    );
    newUser.save();

    const token = jwt.sign(
      { email, password, role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );

    var userRole;
    if(vendorId){
      userRole = "resellerUser";
    }
    else{
      userRole = "user";
    }
     await Users.logUserActivity(userRole ,email, "Signup", "User registered", "success","",{
      firmName,
      password,
      email,
      productsList,
      contactNo,
      address,
      otp,
      vendorId,
    });


    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "User registered successfully",
      token,
      productsList:updatedProductsList,
      address,
      email,
      firmName,
      contactNo,
    });
  } catch (error) {
    console.error("Registration error:", error);
      await Users.logUserActivity(userRole ,email, "Signup", `error: ${error.message}`,"failure","",{
      firmName,
      password,
      email,
      productsList,
      contactNo,
      address,
      otp,
      vendorId,
    });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error || "Something went wrong during registration.",
    });
  }
};

const forgetPasswordController = async (req, res) => {
  try {
    var { email,role } = req.query;
    var { password, otp } = req.body;

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
      await Users.logUserActivity("" ,email, "Forget Password", "User changed password", "success", "", { email, password });
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
    await Users.logUserActivity("" ,email, "Forget Password", `error:${error.message}`,"failure", "", { email, password });
    throw new CustomError.BadRequestError("Failed to reset password");
  }
}

const changePasswordController = async (req, res) => {
  try {
    var { email, role } = req.user;
    var { oldPassword, newPassword } = req.body;

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
    await Users.logUserActivity(role ,email, "Changed Password", "User changed password", "success", "", { email, oldPassword, newPassword });
    return res.status(StatusCodes.OK).json({
      
      success: true,
      message: "Password updated successfully",
    });

  } catch (error) {
    console.error("Error changing password:", error);
    await Users.logUserActivity(role ,email, "Changed Password", `error:${error.message}`,"failure", "", { email, oldPassword, newPassword });
    throw new CustomError.BadRequestError("Failed to change password");
  }
};


const updateFirmInfoController = async (req, res) => {
  try {

    var { email, role } = req.user;
    var { firmName, firmAddress, contactNo } = req.body;

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
    const logActivity = await Users.logUserActivity(role ,email, "Update Firm Info", "User updated firm info", "success", "",{ firmName, firmAddress, contactNo });

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
    await Users.logUserActivity(role ,email, "Update Firm Info", `error:${error.message}`,"failure", "",{ firmName, firmAddress, contactNo });
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message || error,
    });
  }
};


const sendOtpController = async (req, res) => {
  try {
    var {email} = req.query;
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

    const {email} = req.body.email;

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
