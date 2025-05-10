const Users = require("../models/User");
const Device = require("../models/Device");
const Admin = require("../models/Admin");

// to search users
const searchUserController = async (req, res) => {
  try {
    const { email, contact, address, deviceId, firmName } = req.query;

    if (!email && !contact && !address && !deviceId && !firmName) {
      return res.status(400).send({
        success: false,
        message: "At least one search parameter is required.",
      });
    }

    let userRows = [];

    if (email) {
      [userRows] = await Admin.findUserByEmailId(email);
    } else if (contact) {
      [userRows] = await Admin.findUserbycontact(contact);
    } else if (address) {
      [userRows] = await Admin.findUserbyAddress(address);
    } else if (firmName) {
      [userRows] = await Admin.findUserbyfirmname(firmName);
    } else if (deviceId) {
      [userRows] = await Admin.findUserbydevice(deviceId);
    }

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User doesn't exist!",
      });
    }

    // Fetch and attach role for each user
    const formattedUsers = await Promise.all(
      userRows.map(async (user) => {
        const role = await Admin.findRole(user.role_id);
        return {
          email: user.email,
          password: user.password,
          contact: user.contact,
          address: user.address,
          firmName: user.firm_name,
          productsList: user.products_list,
          role: role || "N/A",
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: formattedUsers,
    });

  } catch (error) {
    console.error("Error while searching for user:", error);
    res.status(500).send({
      success: false,
      message: "An error occurred while searching for user",
      error: error.message || error,
    });
  }
};


// to find all users
const findAllUsersController = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Fetch paginated users
    const [users] = await Admin.fetchPaginatedUsers(limit, offset);

    // Fetch role names and attach to each user
    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const role = await Admin.findRole(user.role_id);
        return {
          email: user.email,
          password: user.password,
          contact: user.contact,
          address: user.address,
          firmName: user.firm_name,
          productsList: user.products_list,
          role: role || "N/A", // fallback in case role is null
        };
      })
    );

    // Get total count
    const [[{ count }]] = await Admin.countUsers();

    // Respond with final data
    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: formattedUsers,
      pagination: {
        totalItems: count,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching users",
      error: error.message || error,
    });
  }
};


  
  // to remove user
  const removeUserController = async (req, res) => {
    try {
      const { email } = req.query;
  
      if (!email) {
        return res.status(400).send({
          success: false,
          message: "Email is required",
        });
      }
      const user = await Users.findOne(email);
      if (!user[0][0]) {
        return res
          .status(400)
          .json({ success: false, message: "User doesn't exist!" });
      }
  
      const response = await Admin.removeUser(email);
  
      if (response?.affectedRows === 0) {
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
  
  // update user info
  const updateUserInfoController = async (req, res) => {
    try {
  
      const {email} = req.query
      const {  password, contact,firmName, address, } = req.body;
      if(!email){
        return res.status(400).send({
          success: false,
          message: "Email is required.",
        });
      }
      if(!password && !contact && !firmName && !address)
        return res.status(400).send({
          success: false,
          message: "At least update one parameter .",
        });
  
        const updateUserInfo = await Admin.updateUserInfo(
          email,
          password, contact,firmName, address
        );
    
      
        if (updateUserInfo[0].affectedRows === 0) {
          return res
            .status(StatusCodes.NOT_FOUND)
            .json({ success: false, message: "Can't Update User Info!" });
        }
    
        const updatedUser = await Users.findOne(email);
  
     
        res
          .status(200)
          .json({
            success: true,
            message: "User Info Updated Successfully",
            data: { email,password, firmName, address, contactNo: contact },
          });
    }
    catch (error) {
      console.error("Error updating user:", error);
      res.status(500).send({
        success: false,
        message: "An Error occures while updating user ",
        error: error.message || error,
      });
    }
  }
  // admin apis
// to update deviceId of user
const updateUserDeviceInfoController = async (req, res) => {
  try {
    const { email } = req.query;
    let { deviceIds } = req.body; 
    
    if (!email) {
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
    
    deviceIds = deviceIds.map(id => id?.toUpperCase());
    

    for (const deviceId of deviceIds) {
      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: "Each device must have a valid deviceId.",
        });
      }

      const result = await Admin.checkDevice(deviceId);

      if (!result[0][0]) {
        return res.status(400).json({
          success: false,
          message: `Device not found: ${deviceId}`,
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
    
    const updateUserDeviceInfo = await Admin.updateUserDeviceInfo(email, deviceIds);

    if (updateUserDeviceInfo[0].affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Can't update device info!",
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

   
 const AddParametersByAdminController = async (req, res) => {
    try {
      const { paraName, paraUnit, paraKey, min, max } = req.body;
  
      if (![paraName, paraUnit, paraKey, min, max].every(v => v?.toString().trim())) {
        return res.status(400).json({
          success: false,
          message: "All fields (Parameter Name, Unit, Key, Min, Max) are required.",
        });
      }
  
      // Check if parameter key and name already exist
      const key = await Admin.checkParameterKey(paraKey);
      const name = await Admin.checkParameterName(paraName,paraUnit);
  
      if (key[0][0] && name[0][0]) {
        return res.status(400).json({
          success: false,
          message: "Both the parameter name and key already exist. Please use unique values.",
        });
      } else if (key[0][0]) {
        return res.status(400).json({
          success: false,
          message: "The parameter key already exists. Please use a different key.",
        });
      } else if (name[0][0]) {
        return res.status(400).json({
          success: false,
          message: "The parameter name already exists. Please use a different name.",
        });
      }
      
      await Admin.addParametersByAdmin(
        paraName,
        paraUnit,
        paraKey,
        min,
        max
      );
      return res.status(200).json({
        success: true,
        message: "Parameter added successfully.",
      });
  
    } catch (error) {
      console.error("Error adding parameter:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while adding the parameter.",
        error: error.message || error,
      });
    }
  };
  
  const UpdateRole= async(req,res)=>{
    try {
        const { email } = req.query;
        const { role } = req.body;
    
        if (!email) {
          return res.status(400).send({
            success: false,
            message: "Email is required.",
          });
        }
        const roleId = await Admin.findRoleId(role)
        if (!roleId) {
            return res.status(400).send({
              success: false,
              message: "no role exists.",
            });
        }
        await Admin.addRole(email, roleId); 

        return res.status(200).json({
            success: true,
            message: "Role added successfully.",
          });
  }
  catch (error) {
    console.error("Error updating role:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while updating role.",
      error: error.message || error,
    });
  }
  }
  const removeDeviceFromUser = async (req, res) => {
    
    const { email } = req.query;
    const {  deviceId } = req.body;
  
    if (!email || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Email and deviceId are required.",
      });
    }
  
    try {
      // Step 1: Get the current productsList
      const [rows] = await Admin.getProductsList(email)
  
      if (rows?.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
  
      let products = JSON.parse(rows[0].productsList || "[]");
  
      // Step 2: Remove the deviceId
      const updatedProducts = products.filter(id => id !== deviceId);
  
      // Step 3: Save it back
     const updated = await Admin.removeDeviceId(updatedProducts,email)
  
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
  
  const fetchAllDeviceDetails= async(req,res)=>{
    try {
        const [deviceDetails] = await Admin.fetchDevices(); 
        
        const formattedDeviceDetails = deviceDetails.map(device => ({
          id: device.id, 
          type: device.type,
          deviceId: device.device_id,
          sno: device.sno,
          createdOn: device.created_on,
          createdBy: device.created_by,  
          alias: device.alias,
          deviceLocation: device.dev_location,
          manualLocation: device.manual_location,
          activeStatus: device.active_status
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
 
  const addUser = async(req,res)=>{
    const {email,password} = req.body
    if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required.",
        });
      }
    try {
        await Admin.addUserByAdmin(email,password); 
        
        return res.status(200).json({
          success: true,
          message: "User Added Successfully"
        });
      
      } catch (error) {
        console.error("Error adding user:", error);
        return res.status(500).json({
          success: false,
          message: "An error occurred while adding user.",
          error: error.message
        });
    }  
  }
  
module.exports = {
    removeUserController,
    findAllUsersController,
    searchUserController,
    updateUserInfoController,
    updateUserDeviceInfoController,
    // AddDeviceByAdminController,
    AddParametersByAdminController,
    UpdateRole,
    removeDeviceFromUser,
    fetchAllDeviceDetails,
    addUser,

  };