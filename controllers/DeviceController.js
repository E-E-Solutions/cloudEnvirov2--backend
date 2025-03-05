const Users = require("../models/User");
const Device = require("../models/Device");
const Data = require("../models/Data");
const { getStatus, validateRequestBody, getDeviceType } = require("../utils/common");

const AddDeviceController = async (req, res) => {
  try {
    const { email } = req.user;
    const { deviceId, serialNo } = req.body;

    const user = await Users.findOne(email);

    if (!user[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }
    console.log({ email, deviceId, serialNo });

    const DeviceObj = new Device(deviceId, serialNo);
    const result = await DeviceObj.validateDevice();

    console.log({ result: result[0][0] });

    if (!result[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "Device not found" });
    }

    let existingProducts = await Users.getProducts(email);

    console.log({ existingProducts: existingProducts });

    existingProducts = existingProducts === "" ? "[]" : existingProducts;

    existingProducts = JSON.parse(existingProducts);

    if (existingProducts.includes(deviceId)) {
      return res.status(501).json({
        success: false,
        message: "DeviceId already exist in this account.",
      });
    }

    const products = [...existingProducts, deviceId];
    console.log({ products });
    const addProductResult = await Users.addProduct(email, products);
    console.log({ addProductResult });
    console.log(addProductResult[0].affectedRows);
    if (addProductResult[0].affectedRows > 0) {
      return res.status(200).json({
        success: true,
        message: "Device added successfully",
        productsList: products,
      });
    }

    // res.status(200).json({ message: "Device already exists" });
  } catch (er) {
    console.log(er);
    res.status(500).json({ success: false, message: er });
  }
};

const ValidateDeviceController = async (req, res) => {
  try {
    const { deviceId, serialNo } = req.body;
    const DeviceObj = new Device(deviceId, serialNo);
    const result = await DeviceObj.validateDevice();
    console.log({ result: result[0][0] });
    if (!result[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "Device not found" });
    }

    res.status(200).json({ success: true, message: "Device exist" });
  } catch (er) {
    console.log(er);
    res.status(500).json({ success: false, message: er });
  }
};

const UpdateAliasController = async (req, res) => {
  try {
    const { deviceId } = req.query;
    const { alias } = req.body;
    const { email } = req.user;
    console.log(req.body);

    console.log({ email, alias, deviceId });
    if (!validateRequestBody(req.body, ["alias"].sort())) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - alias",
      });
    }

    const [fetchUserDetails] = await Users.findOne(email);
    console.log({ fetchUserDetails: fetchUserDetails[0] });

    if (!fetchUserDetails[0].products_list.includes(deviceId)) {
      return res.status(401).json({
        success: false,
        message:
          "This device is not in your device list, So you cannot Update its Alias",
      });
    }

    const result = await Device.updateAlias(alias, deviceId);
    console.log({ result: result[0] });
    if (result[0].affectedRows === 0) {
      return res
        .status(501)
        .json({ success: false, message: "Alias not Updated!" });
    }

    res
      .status(200)
      .json({ success: true, message: "Alias Updated Successfully!" });
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .json({ success: false, message: "Internal Server Error | " + er });
  }
};

const UpdateLocationController = async (req, res) => {
  try {
    // const {deviceId} = req.query;
    const { address, latitude, longitude, deviceIds } = req.body;
    const { email } = req.user;
    console.log(req.body);

    console.log({ email, address, latitude, longitude, deviceIds });

    if (
      !validateRequestBody(
        req.body,
        ["latitude", "longitude", "address", "deviceIds"].sort()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Request body should contain - latitude, longitude, deviceIds and address",
      });
    }

    const [fetchUserDetails] = await Users.findOne(email);
    console.log({ fetchUserDetails: fetchUserDetails[0] });

    if (
      !deviceIds.every((element) =>
        fetchUserDetails[0].products_list.includes(element)
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "This device is not in your device list, So you cannot Update its Location",
      });
    }

    const location = `${longitude};${latitude};${address}`;

    const allPromises = await Promise.all(
      deviceIds.map(async (deviceId) => {
        const result = await Device.updateLocation(location, deviceId);
        console.log({ result: result[0] });
        return result[0].affectedRows > 0;
      })
    );

    if (allPromises.every((value) => value)) {
      res
        .status(200)
        .json({ success: true, message: "Location Updated Successfully!" });
    } else {
      res
        .status(500)
        .json({
          success: false,
          message:
            "Something went wrong, we are unable to update all the locations, Please try again",
        });
    }
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .json({ success: false, message: "Internal Server Error | " + er });
  }
};

const GetDeviceInfoController = async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const result = await Device.GetDeviceInfo(deviceId);
    console.log({ result: result[0][0] });
    if (!result[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "Device not found" });
    }
    res.status(200).json({ success: true, data: result[0][0] });
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .json({ success: false, message: "Something went wrong | " + er });
  }
};

const GetUserDevicesInfoController = async (req, res) => {
  try {
    const { email } = req.user;

    let returnableObj = [];
    let products = await Users.getProducts(email);
    products = products === "" ? "[]" : products;

    let productsList = JSON.parse(products);
    console.log({ productsList });

    if (productsList.length === 0) {
      return res.status(401).json({
        success: false,
        message:
          "No device found in the products list. Please Add your device to access the data",
      });
    }

    // First, get the status for each device
    const result = await productsList.reduce(async (acc, deviceId) => {
      let obj = await acc;
      const DataObj = new Data(deviceId);
      let data = await DataObj.getLatestData();
      if(data){
        // =============== to get the time stamp column name for different device type ==============
        const deviceType = getDeviceType(deviceId);
        const [deviceTypeInfo]=await Device.getDeviceTypeInfo(deviceType);
        const {ts_col_name}=deviceTypeInfo[0]; 
  
        const ts_server=data.latestData[0][ts_col_name];
        // ==========================================================================================
       obj = [...obj, { [deviceId]: { status: getStatus(ts_server) } }];
       
      }else{
        obj = [...obj, { [deviceId]: { status: "Offline" } }];
      }
      return obj;

    }, Promise.resolve([]));

    console.log({ result: JSON.stringify(result) });

    // Then, get the location and address for each device in parallel using Promise.all
    returnableObj = await Promise.all(
      result.map(async (data) => {
        const [deviceId, objValue] = Object.entries(data)[0]; // Get deviceId and its corresponding value

        // Get location and address for the device
        const [deviceInfo] = await Device.GetDeviceInfo(deviceId);

        console.log({ deviceInfo: deviceInfo[0] });

        const { type: deviceType, sno, created_on, alias } = deviceInfo[0];

        // return;

        const [long, lat, address] = deviceInfo[0].dev_location.split(";");

        // Attach location info to the device's status object
        objValue.deviceId = deviceId;
        objValue.serialNo = sno;
        objValue.type = deviceType;
        objValue.createdOn = created_on;
        objValue.alias = alias;
        objValue.location = [lat, long];
        objValue.address = address;
        return { ...objValue };
      })
    );

    // Respond with the final result
    res.status(200).json({ success: true, data: returnableObj });
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .json({ success: false, message: "Something went wrong | " + er });
  }
};

const DeleteDeviceController = async (req, res) => {
  try {
    const { deviceIds } = req.body;
    const { email } = req.user;

    console.log({ email });

    if(!deviceIds){
     return res.status(400).json({ success: false, message: "Device IDs are required"});
    }

    const user = await Users.findOne(email);

    if (!user[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    let products = await Users.getProducts(email);

    console.log({ products });

    products = products ? products : "[]";

    products = JSON.parse(products);

    if ( !deviceIds.every(deviceId=>products.includes(deviceId))) {
      return res.status(400).json({
        success: false,
        message: "Device not found in your device list",
      });
    }

    let remainingDevices=[];
   

      remainingDevices = products.filter((existingDevice) => !deviceIds.includes(existingDevice));
      console.log({ remainingDevices });
  

    const result = await Users.addProduct(email, remainingDevices);
    console.log({ result });

    if (result[0].affectedRows === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Failed to delete device" });
    }

    res
      .status(200)
      .json({ success: true, message: "Device deleted successfully!" });
  } catch (er) {
    console.log(er);
  }
};

module.exports = {
  AddDeviceController,
  ValidateDeviceController,
  UpdateAliasController,
  UpdateLocationController,
  GetDeviceInfoController,
  DeleteDeviceController,
  GetUserDevicesInfoController,
};
