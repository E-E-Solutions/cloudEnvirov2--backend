const Reseller = require("../models/Reseller");
const Admin = require("../models/Admin");

const { StatusCodes } = require("http-status-codes");
const addResellerUserController = async (req, res) => {
    const { email } = req.user;
    let { userEmail, password,name, deviceIds } = req.body;
  
    if (!email || !password || !name|| !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Email, password, name and deviceIds (array) are required.",
      });
    }
    try {
      // Check if user already exists
      const userResult = await Reseller.findResellersUserByEmailId(userEmail);
      const user = userResult[0][0];
      if (user) {
        return res.status(409).json({
          success: false,
          message: "User already exists.",
        });
      }
  
      // Normalize deviceIds to uppercase
      deviceIds = deviceIds.map((id) => id.toUpperCase());
  
      // Fetch reseller's allowed device list
      const resellerDevicesResult = await Reseller.fetchResellerDevices(email);
      const productsListRaw = resellerDevicesResult[0][0].products_list;
  
      if (!productsListRaw) {
        return res.status(400).json({
          success: false,
          message: "Reseller has no registered devices.",
        });
      }
  
      let allowedDeviceIds;
      try {
        allowedDeviceIds = JSON.parse(productsListRaw).map(id => id.toUpperCase());
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to parse reseller's product list.",
          error: err.message,
        });
      }
  
      // Check for duplicates
      const hasDuplicates = new Set(deviceIds).size !== deviceIds.length;
      if (hasDuplicates) {
        return res.status(400).json({
          success: false,
          message: "Duplicate device IDs are not allowed.",
        });
      }
  
      // Ensure all deviceIds are in allowedDeviceIds
      for (const deviceId of deviceIds) {
        if (!allowedDeviceIds.includes(deviceId)) {
          return res.status(400).json({
            success: false,
            message: `Device ID not owned by reseller: ${deviceId}`,
          });
        }
      }
      const [vendorIds] = await Reseller.findVendorId(email)
       const vendorId = vendorIds[0].vendor_id
      // Insert into DB
      await Reseller.addResellerUser(userEmail, password, name,vendorId, deviceIds);
  
      return res.status(200).json({
        success: true,
        message: "Reseller user added successfully.",
      });
  
    } catch (error) {
      console.error("Error adding reseller user:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while adding the user.",
        error: error.message,
      });
    }
  };  
  const fetchAllResellerDevices= async(req,res)=>{

    const {email } = req.user
    try {
          const [vendorIds] = await Reseller.findVendorId(email)
       const vendorId = vendorIds[0].vendor_id
        const [deviceDetails] = await Reseller.fetchResellerDevices(vendorId); 
        
        const formattedDeviceDetails = deviceDetails.map(device => ({
           
            deviceId: device.products_list,
          }));
        return res.status(200).json({
          success: true,
          data: formattedDeviceDetails
        });
      
      } catch (error) {
        console.error("Error fetching devices:", error);
        return res.status(500).json({
          success: false,
          message: "An error occurred while fetching device details.",
          error: error.message
        });
    }  
  }
  const fetchAllResellerUsers= async(req,res)=>{

    const {email } = req.user
    try {
        const [vendorIds] = await Reseller.findVendorId(email)
       const vendorId = vendorIds[0].vendor_id
        const [users] = await Reseller.fetchResellerUsers(vendorId); 
        
        const formattedUsers = users.map(user => ({
           
          email: user.email,
          password: user.password,
          contact: user.contact,
          address: user.address,
          firmName: user.firm_name,
          productsList: user.products_list,
          accessStatus: !!user.access_status
          }));
        return res.status(200).json({
          success: true,
          data: formattedUsers
        });
      
      } catch (error) {
        console.error("Error fetching devices:", error);
        return res.status(500).json({
          success: false,
          message: "An error occurred while fetching device details.",
          error: error.message
        });
    }  
  }
  const updateResellerUserDeviceInfoController = async (req, res) => {
    try {
      const {email}  = req.user; 
      const { userEmail } = req.query;
      let { deviceIds } = req.body; 
      
      if (!userEmail) {
        return res.status(400).send({
          success: false,
          message: "Email is required.",
        });
      }
      
      if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
        return res.status(400).send({
          success: false,
          message: "At least one device ID is required.",
        });
      }
      
      deviceIds = deviceIds.map(id => id.toUpperCase());
      
  
      for (const deviceId of deviceIds) {
        if (!deviceId) {
          return res.status(400).json({
            success: false,
            message: "Each device must have a valid deviceId.",
          });
        }
        const validateDevice = await Admin.checkDevice(deviceId)
         if (!validateDevice[0][0]) {
          return res.status(400).json({
            success: false,
            message: `Device ID ${deviceId} does not exist.`,
          });
        }

         const [vendorIds] = await Reseller.findVendorId(email)
         const vendorId = vendorIds[0].vendor_id

        const result = await Reseller.checkDevice(vendorId,deviceId);
  
        if (!result[0][0]) {
          return res.status(400).json({
            success: false,
            message: `Device ID ${deviceId} is not linked to your vendor profile. Please verify the ID or contact support.`,
          });
        }
      }
      const hasDuplicates = new Set(deviceIds).size !== deviceIds.length;
      if (hasDuplicates) {
        return res.status(400).json({
          success: false,
          message: "Duplicate device IDs are not allowed.",
        });
      }
        const [vendorIds] = await Reseller.findVendorId(email)
       const vendorId = vendorIds[0].vendor_id
      const userResult = await Reseller.findResellerUser(vendorId,userEmail);
      const user = userResult[0][0]; 
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
    
        updateResult = await Reseller.updateResellerUserDeviceInfo(userEmail, deviceIds);
  
      if (updateResult[0].affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "No matching user found or device info not updated.",
        });
      }
  
      res.status(200).json({
        success: true,
        message: "Device info updated successfully.",
        data: { deviceIds },
      });
  
    } catch (error) {
      console.error("Error updating devices:", error);
      res.status(500).send({
        success: false,
        message: "An error occurred while updating devices.",
        error: error.message || error,
      });
    }
  };
  const updateResellerUserFirmInfoController = async (req, res) => {
    try {
        const {email} = req.query
      const { password,firmName, firmAddress, contactNo } = req.body;
   
      console.log({ email, password, firmName, firmAddress, contactNo });
  
      const user = await Reseller.findResellersUserByEmailId(email);
  
      console.log({ user: user[0][0] });
      // Check if user exist
      if (!user[0][0]) {
        return res
          .status(400)
          .json({ success: false, message: "User does not exist!" });
      }
  
      const updateFirmInfo = await Reseller.updateResellerUserFirmInfo(
        email,
        password,
        firmName,
        firmAddress,
        contactNo
      );
  
      console.log({
        updateFirmInfo,
        affectedRows: updateFirmInfo[0].affectedRows,
      });
  
      if (updateFirmInfo[0].affectedRows === 0) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ success: false, message: "Can't Update Firm Info!" });
      }
  
      const updatedUser = await Reseller.findResellersUserByEmailId(email);
  
      console.log({ user: updatedUser[0][0] });
  
      const { firm_name, address, contact } = updatedUser[0][0];
  
      res
        .status(200)
        .json({
          success: true,
          message: "User Firm Info Updated Successfully",
          data: { firmName: firm_name, address, contactNo: contact },
        });
    } catch (error) {
      console.log(error);
    }
  };
  const removeResellerUserController = async (req, res) => {
      try {
        const { email } = req.query;
    
        if (!email) {
          return res.status(400).send({
            success: false,
            message: "Email is required",
          });
        }
        const user = await Reseller.findResellersUserByEmailId(email);
        if (!user[0][0]) {
          return res
            .status(400)
            .json({ success: false, message: "User doesn't exist!" });
        }
    
        const response = await Reseller.removeResellerUser(email);
    
        if (response.affectedRows === 0) {
          return res.status(404).send({
            success: false,
            message: "No Records Found",
          });
        }
    
        res.status(200).send({
          success: true,
          message: "Deleted User Successfully",
        });
        
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send({
          success: false,
          message: "An Error occures while deleting user ",
          error: error.message || error,
        });
      }
    };
    const removeDeviceFromResellerUser = async (req, res) => {
        const { email } = req.query;
        const { deviceId } = req.body;
      
        if (!email || !deviceId) {
          return res.status(400).json({
            success: false,
            message: "Email and deviceId are required.",
          });
        }
      
        try {
          // Get user info
          const [rows] = await Reseller.fetchResellerUserDevices(email);
      
          if (rows.length === 0) {
            return res.status(404).json({
              success: false,
              message: "User not found.",
            });
          }
      
          // Safely parse products_list (make sure field name is correct)
          let products = [];
          try {
            products = JSON.parse(rows[0].products_list || "[]");
          } catch (err) {
            return res.status(500).json({
              success: false,
              message: "Failed to parse device list.",
              error: err.message,
            });
          }
      
          // Filter out the device
          const updatedProducts = products.filter(id => id !== deviceId);
      
          // Update DB
          await Reseller.removeDeviceId(updatedProducts, email);
      
          return res.status(200).json({
            success: true,
            message: "Device removed from products list.",
          });
      
        } catch (error) {
          console.error("Error removing device:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to remove device.",
            error: error.message,
          });
        }
      };
      
      const fetchAllVendorIdsController = async (req,res)=>{
        try{
           const [vendorIdList] = await Reseller.fetchAllVendorIds()
           const vendorIds = vendorIdList.map((vendor)=> vendor.vendor_id)
             return res.status(200).json({
          success: true,
          data: vendorIds
        });
        }
       catch (error) {
          console.error("Error removing device:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to remove device.",
            error: error.message,
          });
        }
      }

    const changeAccessStatusController = async (req, res) => {
  const { email, accessStatus } = req.body;

 console.log("changeAccessStatus inputs:", { email, accessStatus })
  try {
    const [result] = await Reseller.changeAccessStatus(accessStatus,email);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "No user found with the provided email.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Access status updated successfully.",
    });
  } catch (error) {
    console.error("Failed to change access status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change access status.",
      error: error.message,
    });
  }
};



 
  module.exports = {
    addResellerUserController,
    fetchAllResellerDevices,
    fetchAllResellerUsers,
    updateResellerUserDeviceInfoController,
    updateResellerUserFirmInfoController,
    removeResellerUserController,
    removeDeviceFromResellerUser,
    changeAccessStatusController,
    fetchAllVendorIdsController,
    
  }