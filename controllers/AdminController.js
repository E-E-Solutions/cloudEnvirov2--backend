const Users = require("../models/User");
const Admin = require("../models/Admin");
const Reseller = require("../models/Reseller");
const { StatusCodes } = require("http-status-codes");

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
          isVerified: !!user.isVerified, 
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
          isVerified: !!user.isVerified, 
          role: role || "N/A",
        };
      })
    );

    const [[{ count }]] = await Admin.countUsers();

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
  
      const userResult = await Users.findOne(email);
      const user = userResult[0][0];
  
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User doesn't exist!",
        });
      }
  
      const roleId = user.role_id;
      const role = await Admin.findRole(roleId)
      const response = await Admin.removeUser(email);
  
      if (role === "reseller") {
         const [vendorIds] = await Reseller.findVendorId(email)
       const vendorId = vendorIds[0].vendor_id
        await Admin.removeReseller(email); 
         
        await Admin.removeAllResellerUsers(vendorId); 
      }
  
      if (response.affectedRows === 0) {
        return res.status(404).send({
          success: false,
          message: "No Records Found",
        });
      }
  
      return res.status(200).send({
        success: true,
        message: "Deleted User Successfully",
      });
  
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).send({
        success: false,
        message: "An error occurred while deleting user",
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
        const userResult = await Users.findOne(email);
        const user = userResult[0][0];
  
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "User doesn't exist!",
        });
      }
  
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
    
    deviceIds = deviceIds.map(id => id.toUpperCase());
    

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
    const userResult = await Admin.findUserByEmailId(email);
    const user = userResult[0][0]; 
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const roleId = user.role_id;
    const role = await Admin.findRole(roleId);
    
    let updateResult;
    if (role === "reseller") {
      // Update reseller and reseller_user_info products_list
      updateResult = await Admin.updateResellerDeviceInfo(email, deviceIds);
      await Admin.updateUserDeviceInfo(email, deviceIds);
    
      // Fetch updated reseller devices
      const [resellerDevicesRows] = await Reseller.fetchResellerDevices(email);
      const validDeviceIds = JSON.parse(resellerDevicesRows[0].products_list || "[]");
    
      // Fetch all users under this reseller
        const [vendorIds] = await Reseller.findVendorId(email)
       const vendorId = vendorIds[0].vendor_id
      const [resellerUsers] = await Reseller.fetchResellerUsers(vendorId);
    
      // Loop through each user and clean up their products list
      for (const user of resellerUsers) {
        const userEmail = user.email;
        const userDevices = JSON.parse(user.products_list || "[]");
    
        // Keep only the devices still valid under this reseller
        const filteredDevices = userDevices.filter(deviceId => validDeviceIds.includes(deviceId));
    
        // If filtered list is different, update DB
        if (filteredDevices.length !== userDevices.length) {
          await Reseller.removeDeviceId(filteredDevices, userEmail);
        }
      }
    }
     else {
      updateResult = await Admin.updateUserDeviceInfo(email, deviceIds);
    }

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
   
 const AddParametersByAdminController = async (req, res) => {
    try {
      const { paraName, paraUnit, paraKey, min, max } = req.body;
  
      if (![paraName, paraUnit, paraKey].every(v => v.toString().trim())) {
        return res.status(400).json({
          success: false,
          message: "All fields (Parameter Name, Unit, Key) are required.",
        });
      }
  
      // Check if parameter key and name already exist
      const key = await Admin.checkParameterKey(paraKey);
      const name = await Admin.checkParameterName(paraName,paraUnit);
      if (key[0][0]) {
        return res.status(400).json({
          success: false,
          message: "The parameter key already exists. Please use a different key.",
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
  
  const UpdateRole = async (req, res) => {
    try {
      const { email } = req.query;
      const { newRole, name,vendorId } = req.body;
  
      if (!email) {
        return res.status(400).send({
          success: false,
          message: "Email is required.",
        });
      }
  
      if (!newRole) {
        return res.status(400).send({
          success: false,
          message: "New role is required.",
        });
      }
  
      // Fetch existing user
      const userResult = await Users.findOne(email);
      const user = userResult[0][0];
  
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User doesn't exist!",
        });
      }
  
      // Get current role name
      const currentRoleName = await Admin.findRole(user.role_id);
      const newRoleId = await Admin.findRoleId(newRole);
  
      if (!newRoleId) {
        return res.status(400).send({
          success: false,
          message: "Invalid new role provided.",
        });
      }
  
      // Step 1: Update role
      await Admin.addRole(email, newRoleId);
      // Step 2: If current role is reseller, clean up reseller data
      if (currentRoleName === "reseller") {
          const vendorIds = await Reseller.findVendorId(email)

        let vendorId;
        if(vendorIds[0][0]) {
       vendorId = vendorIds[0][0].vendor_id
        }

        await Admin.removeReseller(email);
      
        await Admin.removeAllResellerUsers(vendorId);
      }
  
      // Step 3: If new role is reseller, add reseller entry
      if (newRole === "reseller") {
        if (!name) {
          return res.status(400).send({
            success: false,
            message: "Name is required for reseller role.",
          });
        }
  
        let deviceIds;
        try {
          deviceIds = JSON.parse(user.products_list || "[]");
        } catch (err) {
          return res.status(500).json({
            success: false,
            message: "Failed to parse device IDs.",
            error: err.message,
          });
        }
        await Admin.addReseller( name,email, deviceIds,vendorId);
      }
  
      return res.status(200).json({
        success: true,
        message: "Role updated successfully.",
      });
    } catch (error) {
      console.error("Error updating role:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while updating role.",
        error: error.message || error,
      });
    }
  };
  
  const removeDeviceFromUser = async (req, res) => {
    const { email } = req.query;
    const { deviceId } = req.body;
  
    if (!email || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Email and deviceId are required.",
      });
    }
    const userResult = await Admin.findUserByEmailId(email);
    const user = userResult[0][0]; // Assuming it's in the format [[{...user}]]
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const roleId = user.role_id;
    const role = await Admin.findRole(roleId);
    console.log("role",role)
    try {
      const [rows] = await Admin.getProductsList(email);
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
  
      let products = JSON.parse(rows[0].products_list || "[]");
      const updatedProducts = products.filter(id => id !== deviceId);
      await Admin.removeDeviceId(updatedProducts, email);
      if (role === "reseller") {
        const [resellerRows] = await Reseller.fetchResellerDevices(email);
        const resellerProducts = JSON.parse(resellerRows[0].products_list || "[]");
        const updatedResellerProducts = resellerProducts.filter(id => id !== deviceId);
        await Admin.updateResellerDeviceInfo(email, updatedResellerProducts);

         const [vendorIds] = await Reseller.findVendorId(email)
       const vendorId = vendorIds[0].vendor_id
        const [resellerUsers] = await Reseller.fetchResellerUsers(vendorId);
  
        for (const user of resellerUsers) {
          const userDevices = JSON.parse(user.products_list || "[]");
          const filteredDevices = userDevices.filter(id => id !== deviceId);
  
          if (filteredDevices.length !== userDevices.length) {
            await Reseller.removeDeviceId(filteredDevices, user.email);
          }
        }
      }
  
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
 
  const addUser = async (req, res) => {
    let { email, password, role, deviceIds, name,vendorId } = req.body;
  
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }
  
    // Check if user already exists
    const userResult = await Admin.findUserByEmailId(email);
    const user = userResult[0][0];
    if (user) {
      return res.status(409).json({
        success: false,
        message: "User already exists.",
      });
    }
  
    try {
      role = role || "user";
      const roleId = await Admin.findRoleId(role);
  
      if (role === "reseller") {
        if (!name || !vendorId) {
          return res.status(400).json({
            success: false,
            message: "Name and vendorId are required for resellers.",
          });
        }
        if(deviceIds){
  
        deviceIds = deviceIds.map((id) => id.toUpperCase());
  
        // Validate all device IDs first
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
  
        // Check for duplicates
        const hasDuplicates = new Set(deviceIds).size !== deviceIds.length;
        if (hasDuplicates) {
          return res.status(400).json({
            success: false,
            message: "Duplicate device IDs are not allowed.",
          });
        }
      }
         
  
        await Admin.addUserByAdmin(email, password, roleId,deviceIds);
        await Admin.addReseller(name, email, deviceIds,vendorId);
      } else {
        await Admin.addUserByAdmin(email, password, roleId);
      }
  
      return res.status(200).json({
        success: true,
        message: "User added successfully.",
      });
    } catch (error) {
      console.error("Error adding user:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while adding user.",
        error: error.message,
      });
    }
  };
   const fetchAllParameterDetails= async(req,res)=>{
    try {
        const [parameterDetails] = await Admin.fetchParameters(); 
        
        const paraInfo = parameterDetails.map(para=>({
          sno : para.sno,
          paraKey : para.para_key,
          paraUnit:para.para_unit,
          paraName : para.para_name,
          min : para.min,
          max : para.max
        }))
        return res.status(200).json({
          success: true,
          data: paraInfo
        });
      
      } catch (error) {
        console.error("Error fetching parameters:", error);
        return res.status(500).json({
          success: false,
          message: "An error occurred while fetching parameter details.",
          error: error.message
        });
    }  
  }
   const UpdateParametersByAdminController = async (req, res) => {
    try {
      const { paraKey, paraUnit,paraName, min, max } = req.body;
      if(!paraKey) {
      return res.status(400).json({
        success: false,
        message: "Parameter Key is required.",
      });
    }
  
      if (!(paraName|| paraUnit || min || max)) {
        return res.status(400).json({
          success: false,
          message: "Atleast update on field.",
        });
      }

      const updated = await Admin.updateParameterInfo(paraKey,paraUnit,paraName,min,max)

      if (updated[0].affectedRows === 0) {
          return res
            .status(StatusCodes.NOT_FOUND)
            .json({ success: false, message: "Can't Update Parameter Info!" });
        }
     
      return res.status(200).json({
        success: true,
        message: "Parameter updated successfully.",
      });
  
    } catch (error) {
      console.error("Error updating parameter:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while updating the parameter.",
        error: error.message || error,
      });
    }
  };
  
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
    UpdateParametersByAdminController,
    fetchAllParameterDetails
  };