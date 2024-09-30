const Users = require("../db/User");
const Device = require("../db/Device");

const AddDeviceController = async (req, res) => {
  try {
    const { email } = req.user;
    const { deviceId, serialNo } = req.body;

    const user = await Users.findOne(email);

    if (!user[0][0]) {
      return res.status(400).json({ success: false, message: "User not found" });
    }
    console.log({ email, deviceId, serialNo });

    const DeviceObj = new Device(deviceId, serialNo);
    const result = await DeviceObj.validateDevice();

    console.log({ result: result[0][0] });

    if (!result[0][0]) {
      return res.status(400).json({ success: false, message: "Device not found" });
    }

    let existingProducts = await Users.getProducts(email);

    console.log({ existingProducts: existingProducts });

    existingProducts = existingProducts === "" ? "[]" : existingProducts;

    existingProducts = JSON.parse(existingProducts);

    if (existingProducts.includes(deviceId)) {
      return res.status(501).json({ success: false, message: "DeviceId already exist in this account." });
    }

    const products = [...existingProducts, deviceId];
    console.log({ products });
    const addProductResult = await Users.addProduct(email, products);
    console.log(addProductResult[0].affectedRows);
    if (addProductResult[0].affectedRows > 0) {
      return res.status(200).json({ success: true, message: "Device added successfully" });
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
      return res.status(400).json({ success: false, message: "Device not found" });
    }

    res.status(200).json({ success: true, message: "Device exist" });
  } catch (er) {
    console.log(er);
    res.status(500).json({ success: false, message: er });
  }
};
const UpdateAliasController = async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const { alias } = req.body;
    const { email } = req.user;

    const fetchUserDetails = await Users.findOne(email);

    if (!fetchUserDetails[0][0].products_list.includes(deviceId)) {
      return res.status(401).json({ success: false, message: "This device is not in your device list, So you cannot Update its Alias" });
    }

    const result = await Device.updateAlias(alias, deviceId);
    console.log({ result: result[0] });
    if (result[0].affectedRows === 0) {
      return res.status(501).json({ success: false, message: "Alias not Updated!" });
    }

    res.status(200).json({ success: true, message: "Alias Updated Successfully!" });
  } catch (er) {
    console.log(er);
    res.status(500).json({ success: false, message: er });
  }
};

const GetDeviceInfoController = async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const result = await Device.GetDeviceInfo(deviceId);
    console.log({ result: result[0][0] });
    if (!result[0][0]) {
      return res.status(400).json({ success: false, message: "Device not found" });
    }
    res.status(200).json({ success: true, data: result[0][0] });
  } catch (er) {
    console.log(er);
    res.status(500).json({ success: false, message: "Something went wrong | " + er });
  }
};

const DeleteDeviceController = async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const { email } = req.user;

    console.log({ email });

    const user = await Users.findOne(email);

    if (!user[0][0]) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    let products = await Users.getProducts(email);

    console.log({ products });

    products = products ? products : "[]";

    products = JSON.parse(products);

    if (!products.includes(deviceId)) {
      return res.status(400).json({ success: false, message: "Device not found in your device list" });
    }

    const newProducts = products.filter((product) => product !== deviceId);
    console.log({ newProducts });

    const result = await Users.addProduct(email, newProducts);
    console.log({ result });

    if (result[0].affectedRows === 0) {
      return res.status(400).json({ success: false, message: "Failed to delete device" });
    }

    res.status(200).json({ success: true, message: "Device deleted successfully!" });
  } catch (er) {
    console.log(er);
  }
};

module.exports = { AddDeviceController, ValidateDeviceController, UpdateAliasController, GetDeviceInfoController, DeleteDeviceController };
