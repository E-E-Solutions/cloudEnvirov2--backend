const Data = require("../db/Data");
const Users = require("../db/User");
const Device = require("../db/Device");

const { getStatus } = require("../utils/common");

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
      return res.status(401).json({
        success: false,
        message: "You are not authorize to get the data of this device.",
      });
    }

    const DataObj = new Data(deviceId);
    let [data] = await DataObj.getLatestData();

    data = data[0];
    const ts_server = data?.ts_server;
    const ts_client = data?.ts_client;

    delete data._id;
    delete data.lg;
    delete data.lt;
    delete data.bv;
    delete data.ts_client;
    delete data.ts_server;

    const LatestData = await Promise.all(
      Object.entries(data).map(async ([key, value]) => {
        try {
          console.log({ para: key });
          let [response] = await Data.getParaInfo(key);
          response = response[0];

          console.log({ response });
          let dataObj = {
            name: response.para_name,
            unit: response.para_unit,
            value: value,
            minimum: response.min,
            maximum: response.max,
            
          };
          console.log({ dataObj });
          return dataObj;
        } catch (er) {
          console.log(er);
          return null; // Return null or some fallback value on error
        }
      })
    );

    console.log({ LatestData });

    res.status(200).json({
      success: true,
      data: LatestData,
      time: new Date(ts_server).getTime(),
      status: getStatus(ts_server)
    });
    // res.status(500).json({success:false,message:"Something Went wrong"})
  } catch (er) {
    console.log(er);
    res.status(500).send({ success:false, message: "Internal Server Error" });
  }
};

const GetDeviceStatusAndLocation = async (req, res) => {
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
        message: "No device found in the products list.",
      });
    }

    // First, get the status for each device
    const result = await productsList.reduce(async (acc, deviceId) => {
      let obj = await acc;
      const DataObj = new Data(deviceId);
      let [data] = await DataObj.getLatestData();
      const ts_server = data?.[0]?.ts_server;
      obj = [...obj, { [deviceId]: { status: getStatus(ts_server) } }];
      return obj;
    }, Promise.resolve([]));

    console.log({ result: JSON.stringify(result) });

    // Then, get the location and address for each device in parallel using Promise.all
    returnableObj = await Promise.all(
      result.map(async (data) => {
        const [deviceId, objValue] = Object.entries(data)[0]; // Get deviceId and its corresponding value

        // Get location and address for the device
        const [locAndAddress] = await Device.GetDeviceCoordinates(deviceId);
        const [long, lat,address] = locAndAddress?.[0]?.dev_location.split(";");

        // Attach location info to the device's status object
        objValue.deviceId=deviceId;
        objValue.location = [lat, long];
        objValue.address = address;
        return { ... objValue };
      })
    );

    console.log({ returnableObj: JSON.stringify(returnableObj) });

    // Respond with the final result
    res.status(200).json({ success: true, data: returnableObj });
  } catch (er) {
    console.log(er);
    res.status(500).send({success:false, message: "Internal Server Error" });
  }
};


module.exports = { GetLatestData, GetDeviceStatusAndLocation };
