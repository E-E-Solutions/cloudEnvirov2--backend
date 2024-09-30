const Data = require("../db/Data");
const Users = require("../db/User");

const GetLatestData = async (req, res) => {
  try {
    const { email } = req.user;
    const { deviceId } = req.query;

    let existingProducts = await Users.getProducts(email);

    console.log({ existingProducts: existingProducts });

    existingProducts = existingProducts === "" ? "[]" : existingProducts;

    console.log({ existingProducts });
    // existingProducts = JSON.parse(existingProducts);
    console.log(existingProducts.includes(deviceId));

    if (!existingProducts.includes(deviceId)) {
      return res.status(401).json({ success: false, message: "You are not authorize to get the data of this device." });
    }

    const DataObj = new Data(deviceId);
    const data = await DataObj.getLatestData();

    console.log({ data });

    console.log({ email, deviceId });
  } catch (er) {
    console.log(er);
    res.status(500).send({ message: "Internal Server Error" });
  }
};

module.exports = { GetLatestData };
