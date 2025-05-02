const Users = require("../models/User");
const Device = require("../models/Device");
const Data = require("../models/Data");
const Image = require("../models/Image");
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');



const findDevicesByIdController = async (req,res) =>{
  try{
    const emailId = req.user.email;
    const {imageId} = req.query;
    if(!emailId){
      res.status(400)
      .json({ success: false, message: "Email is required" });;
      throw new Error("Email is required")
    }
    if(!imageId){
        res.status(400)
        .json({ success: false, message: "Image Id is required" });;
        throw new Error("Image Id is required")
    }

    const [devices] =  await Image.findAllDeviceIds(emailId,imageId);

    const formattedDevices = devices.reduce((acc, device) => {
      const { image_id, device_id, y, x } = device;
    
      if (!acc[image_id]) {
        acc[image_id] = [];
      }
    
      acc[image_id].push({
        deviceId: device_id,
        top: y,
        left: x,
      });
    
      return acc;
    }, {});
    
    if (devices.length !== 0) {
      return res.status(200).json({
        success: true,
        message: "Devices fetched successfully",
        data: formattedDevices,
      });
    }
    
    return res.status(404).json({
      success: false,
      message: "No devices found for this image id",
    });
    
  } catch (error) {
    console.error("Error fetching all devices:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching devices",
      error: error.message || error,
    });
  }
}
const  addDeviceIdOnImageController = async (req, res) => {
  try{
  const emailId = req.user.email;
  const {imageId,deviceId,top,left} = req.body;
  if(!emailId){
    res.status(400)
    .json({ success: false, message: "Email is required" });;
    throw new Error("Email is required")
  }
  if(!emailId||!imageId||!deviceId||!top||!left){
      res.status(400)
      .json({ success: false, message: "All fields are mandatory" });;
      throw new Error("All fields are mandatory")
  }
  const user = await Users.findOne(emailId);
  if (!user[0][0]) {
    res.status(400)
      .json({ success: false, message: "User does not exist!" });
  }
  const image = await Image.checkImageId(imageId)
  if(!image[0][0]){
    res.status(400)
    .json({ success: false, message: "Incorrect Image Id" });;
    throw new Error("Incorrect Image Id")
  }
  const device = await Image.checkDevice(deviceId)
  if(!device[0][0]){
    res.status(400)
    .json({ success: false, message: "Incorrect Device Id" });;
    throw new Error("Incorrect Device Id")
  }

  const duplicateDeviceId = await Image.duplicateDeviceId(emailId,deviceId)
  if(duplicateDeviceId[0][0]){
    res.status(400)
    .json({ success: false, message: "Device Id already exist" });;
    throw new Error("Device Id already exist")
  }
  const duplicateLocation = await Image.duplicateLocationCheck(imageId,left,top)
  console.log("Checking for duplicate at:", imageId, left, top);
console.log("DB result:", duplicateLocation[0]);

  if(duplicateLocation[0][0]){
    res.status(400)
    .json({ success: false, message: "DeviceId already exist at this location" });
    throw new Error("DeviceId already exist at this location")
  }

  const addDeviceId = await Image.addDeviceId(
    emailId,imageId,deviceId,top,left
  );
    
      if(!addDeviceId){
          return res.status(404).send({
              success:false,
              message: "Failed to Add Device"
          });
      }
      res.status(200).send({
          success: true,
          message: "Device Added Successfully!",
          
      })
  }
  catch(error){
          console.log(error);
          res.status(500).send({
              success:false,
              message: "Error in Add Device Id API",
              error,
          })
  }
}
const updateDeviceController = async (req, res) => {
  try {
    const emailId = req.user.email;
    const { imageId, oldDeviceId, newDeviceId, left, top } = req.body;

    if (!emailId || !imageId || !newDeviceId || top == null || left == null) {
      return res.status(400).json({ success: false, message: "All fields are mandatory" });
    }

    const image = await Image.checkImageId(imageId);
    if (!image[0][0]) {
      return res.status(400).json({ success: false, message: "Incorrect Image Id" });
    }

    const existingDevice = await Image.findDeviceId(emailId, oldDeviceId);
    if (!existingDevice[0][0]) {
      return res.status(400).json({ success: false, message: `There is no existing Device ID: ${oldDeviceId}` });
    }

    const deviceCheck = await Image.checkDevice(newDeviceId);
    if (!deviceCheck[0][0]) {
      return res.status(400).json({ success: false, message: "Incorrect Device Id" });
    }

    if (newDeviceId !== oldDeviceId) {
      const duplicateDeviceId = await Image.duplicateDeviceId(emailId, newDeviceId);
      if (duplicateDeviceId[0][0]) {
        return res.status(400).json({ success: false, message: "Device Id already exists" });
      }
    }

    const updated = await Image.updateDevicePositionAndId(emailId, oldDeviceId, newDeviceId, imageId, top, left);
    if (updated?.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Update failed: no matching record found" });
    }

    return res.status(200).json({ success: true, message: "Device Updated Successfully!" });
  } catch (error) {
    console.error("Error in updateDeviceController:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


const deleteDeviceIdController = async (req, res) => {
  try {
    const emailId = req.user.email;
    const {  deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).send({
        success: false,
        message: "deviceId is required",
      });
    }


    const device = await Image.findDeviceId(emailId,deviceId);
    if (!device[0][0]) {
      return res.status(400).json({
        success: false,
        message: "Device Id doesn't exist",
      });
    }

    const response = await Image.removeDeviceId(emailId, deviceId);
    if (response?.affectedRows === 0) {
      return res.status(404).send({
        success: false,
        message: "No Records Found",
      });
    }

    res.status(200).send({
      success: true,
      message: "Deleted Device Successfully",
    });
  } catch (error) {
    console.error("Error in deleteDeviceIdController:", error);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
    });
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

module.exports = {
   addDeviceIdOnImageController,
   findDevicesByIdController,
   deleteDeviceIdController,
   updateDeviceController,
   insertImageController,
   findImageDetailsController,
  };