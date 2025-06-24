const Users = require("../models/User");
const Device = require("../models/Device");
const Data = require("../models/Data");
const {
  getStatus,
  validateRequestBody,
  getDeviceType,
} = require("../utils/common");
const Reseller = require("../models/Reseller");

const AddDeviceController = async (req, res) => {
  try {
    const { email,role } = req.user;
    let { deviceId, serialNo } = req.body;
    const [userResult] = await Users.findByEmail(email);
        const user = userResult[0];
    
        // If not found, try reseller
        let currentUser = user;
        let isReseller = false;
    
        if (!currentUser) {
          const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
          currentUser = resellerResult[0];
          isReseller = true;
        }
    
        // If still not found
        if (!currentUser) {
          return res.status(400).json({
            success: false,
            message: "User does not exist!",
          });
        }
    deviceId = deviceId.toUpperCase();
    console.log({ email, deviceId, serialNo });

    const DeviceObj = new Device(deviceId, serialNo);
    const result = await DeviceObj.validateDevice();

    console.log({ result: result[0][0] });

    if (!result[0][0]) {
      return res
        .status(400)
        .json({ success: false, message: "Device not found" });
    }

    let existingProducts;
    if (role === "resellerUser") {
      const vendorId = currentUser.vendor_id
      const verifyResellerDevices = await Reseller.checkDevice(vendorId,deviceId);
      if (!verifyResellerDevices[0][0]) {
        return res.status(400).json({
          success: false,
          message: "Device not assigned to your reseller.",
        });
      }
      existingProducts = await Users.getResellerUserProducts(email);
    }
     else {
          existingProducts = await Users.getProducts(email);
        }

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
    let addProductResult;
    if(role === "reseller"){
    addProductResult = await Users.addResellerProduct(email, products);
    await Users.addProduct(email, products);
    }
    else if(role === "resellerUser"){
    addProductResult = await Users.addResellerUserProduct(email, products);

    }
    else{
    addProductResult = await Users.addProduct(email, products);

    }
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
    const { email,role } = req.user;
    console.log(req.body);

    console.log({ email, alias, deviceId });
    if (!validateRequestBody(req.body, ["alias"].sort())) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - alias",
      });
    }

    let fetchUserDetails;

    if (role === "resellerUser") {
      const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
      fetchUserDetails = resellerResult;
    } else {
      const [userResult] = await Users.findOne(email);
      fetchUserDetails = userResult;
    }
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
    const { email,role } = req.user;
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
    let fetchUserDetails;

    if (role === "resellerUser") {
      const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
      fetchUserDetails = resellerResult;
    } else {
      const [userResult] = await Users.findOne(email);
      fetchUserDetails = userResult;
    }
    
    console.log({ fetchUserDetails: fetchUserDetails[0] });
if(role !=="admin"){
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
      res.status(500).json({
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
    const { email,role } = req.user;

    let returnableObj = [];
    let products;
    if (role === "resellerUser") {
      products = await Users.getResellerUserProducts(email);
    } else {
      products = await Users.getProducts(email);
    }
    products = products === "" ? "[]" : products;

    let productsList = JSON.parse(products);
    console.log({ productsList });

    if (productsList === null || productsList.length === 0) {
      return res.status(401).json({
        success: false,
        message:
          "No device found in the products list. Please Add your device to access the data",
      });
    }

    // First, get the status for each device
    // const result = await productsList.reduce(async (acc, deviceId) => {
    //   let obj = await acc;
    //   const DataObj = new Data(deviceId);
    //   let data = await DataObj.getLatestData();
    //   if(data){
    //     // =============== to get the time stamp column name for different device type ==============
    //     const deviceType = getDeviceType(deviceId);
    //     const [deviceTypeInfo]=await Device.getDeviceTypeInfo(deviceType);
    //     const {ts_col_name}=deviceTypeInfo[0];

    //     const ts_server=data.latestData[0][ts_col_name];
    //     // ==========================================================================================
    //    obj = [...obj, { [deviceId]: { status: getStatus(ts_server) } }];

    //   }else{
    //     obj = [...obj, { [deviceId]: { status: "Offline" } }];
    //   }
    //   return obj;

    // }, Promise.resolve([]));

    const result = productsList.reduce((acc, deviceId) => {
      acc = [...acc, { [deviceId]: { status: "na" } }];
      return acc;
    }, []);

    console.log({ result: JSON.stringify(result) });

    // Then, get the location and address for each device in parallel using Promise.all
    returnableObj = await Promise.all(
      result.map(async (data) => {
        const [deviceId, objValue] = Object.entries(data)[0]; // Get deviceId and its corresponding value

        // Get location and address for the device
        const [deviceInfo] = await Device.GetDeviceInfo(deviceId);
        if(deviceInfo[0]){
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
        }
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

const GetUserDevicesStatusController = async (req, res) => {
  try {
    const { email,role } = req.user;

    let returnableObj = [];
    let products;
    if (role === "resellerUser") {
      products = await Users.getResellerUserProducts(email);
    } else {
      products = await Users.getProducts(email);
    }
    products = products === "" ? "[]" : products;

    let productsList = JSON.parse(products);
    console.log({ productsList });
    if (productsList === null || productsList.length === 0) {
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
      if (data) {
        // =============== to get the time stamp column name for different device type ==============
        const deviceType = getDeviceType(deviceId);
        const [deviceTypeInfo] = await Device.getDeviceTypeInfo(deviceType);
        const { ts_col_name } = deviceTypeInfo[0];

        const ts_server = data.latestData[0][ts_col_name];
        // ==========================================================================================
        obj = {...obj,  [deviceId]:  getStatus(ts_server)  };
      } else {
        obj = {...obj,  [deviceId]:   "Offline"  };
      }
      return obj;

      // Respond with the final result
    
    }, Promise.resolve([]));

    res.status(200).json({ success: true, info: result });

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
    const { email, role } = req.user;

    if (!deviceIds || !Array.isArray(deviceIds)) {
      return res
        .status(400)
        .json({ success: false, message: "Device IDs are required" });
    }

    // Normalize input deviceIds to uppercase
    const normalizedDeviceIds = deviceIds.map((id) => id.toUpperCase());

    const [userResult] = await Users.findByEmail(email);
    let currentUser = userResult[0];

    if (!currentUser) {
      const [resellerResult] = await Reseller.findResellersUserByEmailId(email);
      currentUser = resellerResult[0];
    }

    if (!currentUser) {
      return res.status(400).json({
        success: false,
        message: "User does not exist!",
      });
    }

    let products;
    if (role === "resellerUser") {
      products = await Users.getResellerUserProducts(email);
    } else {
      products = await Users.getProducts(email);
    }

    products = typeof products === "string" ? JSON.parse(products) : products || [];

    // Ensure all requested deviceIds exist in user’s current device list
    if (!normalizedDeviceIds.every((deviceId) => products.includes(deviceId))) {
      return res.status(400).json({
        success: false,
        message: "One or more devices not found in your device list",
      });
    }

    // Filter out devices to delete
    const remainingDevices = products.filter(
      (device) => !normalizedDeviceIds.includes(device)
    );

    let result;

    if (role === "reseller") {
      const vendorId = await Reseller.findVendorId(email)
      const [resellerUsersResult] = await Reseller.fetchResellerUsers(vendorId);
      const userEmails = resellerUsersResult.map((u) => u.email);

      // Update all associated reseller users
      for (const userEmail of userEmails) {
        await Users.addResellerUserProduct(userEmail, remainingDevices);
      }

      await Users.addResellerProduct(email, remainingDevices);
      result = await Users.addProduct(email, remainingDevices);
    } else if (role === "resellerUser") {
      result = await Users.addResellerUserProduct(email, remainingDevices);
    } else {
      result = await Users.addProduct(email, remainingDevices);
    }

    if (!result || result[0].affectedRows === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Failed to delete device" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Device(s) deleted successfully!" });
  } catch (er) {
    console.error("DeleteDeviceController Error:", er);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error | " + er });
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
  GetUserDevicesStatusController
};
