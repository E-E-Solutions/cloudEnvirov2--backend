const Users = require("../db/user");
const Device = require("../db/Device");

const AddDeviceController = async (req, res) => {
  try {
    const email = req.query.email;
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

    res.status(400).json({ success: true, message: "Device exist" });
  } catch (er) {
    console.log(er);
    res.status(500).json({ success: false, message: er });
  }
};

module.exports = { AddDeviceController, ValidateDeviceController };
