// This module has been specifically developed for NTPC to lay out and pinpoint devices on their site-area map.

const Users = require("../models/User");
const Image = require("../models/Image");
const { v4: uuidv4 } = require('uuid');




const findDevicesByIdController = async (req, res, next) => {
  const { email } = req.user || {};
  const { imageId } = req.query;

  // 1. Validate inputs
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }
  if (!imageId) {
    return res
      .status(400)
      .json({ success: false, message: "Image ID is required" });
  }

  try {
    // 2. Retrieve devices
    const [devices] = await Image.findAllDeviceIds(email, imageId);

    // 3. No devices → 404
    if (!devices || devices.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No devices found for image ID: ${imageId}`,
      });
    }

    // 4. Format output
    const formatted = devices.map(({ device_id, x, y }) => ({
      deviceId: device_id,
      top: y,
      left: x,
    }));

    // 5. Send success
    return res.status(200).json({
      success: true,
      message: "Devices fetched successfully",
      data: {
        [imageId]: formatted,
      },
    });
  } catch (error) {
    console.error("Error in findDevicesByIdController:", error);
    // 6. Delegate to error middleware or send generic 500
    return next
      ? next(error)
      : res.status(500).json({
          success: false,
          message: "An error occurred while fetching devices",
        });
  }
};



const addDeviceIdOnImageController = async (req, res, next) => {
  const { email } = req.user || {};
  const { imageId, deviceId, top, left } = req.body;

  // 1. Validate inputs
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }
  if (!imageId || !deviceId || top == null || left == null) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are mandatory" });
  }

  try {
    // 2. Verify user exists
    const [users] = await Users.findOne(email);
    if (!users.length) {
      return res
        .status(404)
        .json({ success: false, message: "User does not exist" });
    }

    // 3. Verify image ID
    const [images] = await Image.checkImageId(imageId);
    if (!images.length) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect Image ID" });
    }

    // 4. Verify device ID
    const [devices] = await Image.checkDevice(deviceId);
    if (!devices.length) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect Device ID" });
    }

    // 5. Prevent duplicate device on any image
    const [dupDevice] = await Image.duplicateDeviceId(email, deviceId);
    if (dupDevice.length) {
      return res
        .status(400)
        .json({ success: false, message: "Device already exists" });
    }

    // 6. Prevent duplicate location on this image
    const [dupLoc] = await Image.duplicateLocationCheck(imageId, left, top);
    if (dupLoc.length) {
      return res.status(400).json({
        success: false,
        message: "A device is already registered at this location",
      });
    }

    // 7. Insert the new device
    const result = await Image.addDeviceId(email, imageId, deviceId, top, left);
    // adjust the following check to your library’s return shape:
    if (!result || result.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to add device",
      });
    }

    // 8. Success!
    return res.status(200).json({
      success: true,
      message: "Device added successfully",
    });

  } catch (err) {
    console.error("addDeviceIdOnImageController:", err);
    return next
      ? next(err)
      : res.status(500).json({
          success: false,
          message: "Internal server error",
        });
  }
};



const updateDeviceController = async (req, res, next) => {
  const { email } = req.user || {};
  const { imageId, oldDeviceId, newDeviceId, top, left } = req.body;

  // 1. Validate inputs
  if (!email || !imageId || !oldDeviceId || !newDeviceId || top == null || left == null) {
    return res.status(400).json({
      success: false,
      message: "email, imageId, oldDeviceId, newDeviceId, top and left are all mandatory"
    });
  }

  try {
    // 2. Verify image exists
    const [images] = await Image.checkImageId(imageId);
    if (!images.length) {
      return res.status(400).json({
        success: false,
        message: "Incorrect Image ID"
      });
    }

    // 3. Verify old device is actually on this image for this user
    const [existing] = await Image.findDeviceId(email, oldDeviceId);
    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: `No device found with ID ${oldDeviceId}`
      });
    }

    // 4. Verify newDeviceId is valid
    const [validDevice] = await Image.checkDevice(newDeviceId);
    if (!validDevice.length) {
      return res.status(400).json({
        success: false,
        message: "Incorrect new Device ID"
      });
    }

    // 5. If changing ID, ensure it’s not already used elsewhere by this user
    if (newDeviceId !== oldDeviceId) {
      const [dupId] = await Image.duplicateDeviceId(email, newDeviceId);
      if (dupId.length) {
        return res.status(400).json({
          success: false,
          message: "Device ID already exists"
        });
      }
    }

    // 6. Ensure no other device occupies the new location on this image
    const [dupLoc] = await Image.duplicateLocationCheck(imageId, left, top);
    if (dupLoc.length && dupLoc[0].device_id !== oldDeviceId) {
      return res.status(400).json({
        success: false,
        message: "Another device is already registered at this location"
      });
    }

    // 7. Perform the update
    const result = await Image.updateDevicePositionAndId(
      email,
      oldDeviceId,
      newDeviceId,
      imageId,
      top,
      left
    );

    // 8. Check update success
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Update failed: no matching record found"
      });
    }

    // 9. Success
    return res.status(200).json({
      success: true,
      message: "Device updated successfully"
    });

  } catch (err) {
    console.error("Error in updateDeviceController:", err);
    return next
      ? next(err)
      : res.status(500).json({
          success: false,
          message: "Internal Server Error"
        });
  }
};


 const deleteDeviceIdController = async (req, res, next) => {
  const { email } = req.user || {};
  const { deviceId } = req.query;

  // 1. Validate
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }
  if (!deviceId) {
    return res
      .status(400)
      .json({ success: false, message: "deviceId is required" });
  }

  try {
    // 2. Check existence
    const [rows] = await Image.findDeviceId(email, deviceId);
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Device ID does not exist",
      });
    }

    // 3. Delete
    const result = await Image.removeDeviceId(email, deviceId);
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "No records found to delete",
      });
    }

    // 4. Success
    return res.status(200).json({
      success: true,
      message: "Deleted device successfully",
    });
  } catch (err) {
    console.error("deleteDeviceIdController:", err);
    return next
      ? next(err)
      : res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
  }
};

const insertImageController = async (req, res) => {
  const emailId = req.user.email;
  if (!emailId) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    const imageId = uuidv4();
    const imageName = req.body.imageName;
    const filePath = req.file.path; 
    console.log(emailId, imageId, imageName, filePath)
    await Image.addImage(emailId, imageId, imageName, filePath);

    return res.status(200).json({
      success: true,
      message: "Image inserted successfully",
      imageId,
      imageName,
      imagePath: filePath,
    });
  } catch (error) {
    console.error('Error inserting image:', error.message);
    return res.status(500).json({ success: false, message: "Error inserting image", error: error.message });
  }
};

const findImageDetailsController = async (req,res) =>{
  try{
    const emailId = req.user.email;
    if(!emailId){
      res.status(400)
      .json({ success: false, message: "Email is required" });;
      throw new Error("Email is required")
    }

    const rawData = await Image.findAllImageDetails(emailId);
    const images = rawData[0]; 

    const formattedData = images.map(item => ({
      imageId: item.image_id,
      imageName: item.image_name,
      imagePath: item.image_path 
    }));
    
    if (rawData.length !== 0) {
      return res.status(200).json({
        success: true,
        message: "Images fetched successfully",
        data: formattedData,
      });
    }
    
    return res.status(404).json({
      success: false,
      message: "No images found for this user",
    });
    
  } catch (error) {
    console.error("Error fetching all images:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching images",
      error: error.message || error,
    });
  }
}
const deleteImageController = async (req, res) => {
  const email = req.user.email;
  const { imageId } = req.query;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  if (!imageId) {
    return res.status(400).json({ success: false, message: "Image id is required" });
  }

  try {
    const result = await Image.removeImage(email, imageId);
    await Image.removeAllDevices(email, imageId);

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "No records found to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Image and associated devices deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting image",
      error: error.message || error,
    });
  }
};



module.exports = {
   addDeviceIdOnImageController,
   findDevicesByIdController,
   deleteDeviceIdController,
   updateDeviceController,
   insertImageController,
   findImageDetailsController,
   deleteImageController
  };