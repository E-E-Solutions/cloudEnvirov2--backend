const Data = require("../db/Data");
const Users = require("../db/User");
const Device = require("../db/Device");

const { getStatus, validateRequestBody } = require("../utils/common");
const Settings = require("../db/Settings");

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
    let latestDataObj = await DataObj.getLatestData();
    console.log({ latestDataObj });

    // return;
    const data = latestDataObj?.latestData[0];
    const dailyAverages=latestDataObj?.dailyAverages[0]
    const ts_server = data?.ts_server || data?.ts || data?.ts_client ||`${data?.date} ${data?.time}` ;
    const ts_client = data?.ts_client;

    delete data._id;
    delete data.lg;
    delete data.lt;
    delete data.bv;
    delete data.lon;
    delete data.lat;
    delete data.batVolt;
    delete data.ts_client;
    delete data.ts_server;

    const LatestData = await Promise.all(
      Object.entries(data).map(async ([key, value]) => {
        try {
          console.log({ para: key });

          const settings = new Settings(email);
          let [setting] = await settings.getSettings();
          setting = setting[0];
          console.log({ setting });
          const paraInfo = JSON.parse(setting?.para_info || "{}");
          let deviceSettings = paraInfo[deviceId];
          console.log({ deviceSettings });

          if (deviceSettings) {
            let dataObj = {
              key,
              name: deviceSettings?.[key]?.name,
              unit: deviceSettings?.[key]?.unit,
              minimum: deviceSettings?.[key]?.minimum,
              maximum: deviceSettings?.[key]?.maximum,
              threshold: deviceSettings?.[key]?.threshold,
              value: value,
              average:Number(dailyAverages[`avg_${key}`]).toFixed(0)
            };

            console.log(dataObj);
            return dataObj;
          }

          console.log({ paraInfo });

          let [response] = await Data.getParaInfo(key);
          response = response[0];

          console.log({ response });
          let dataObj = {
            key,
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

    let [dataObj] = await Data.getDataAvailabilityYears(deviceId);
    console.log({ dataObj });
    // dataObj = dataObj[0];
    let years = dataObj?.map(obj=>obj.year);
    console.log({ years });

    console.log({ LatestData });

    res.status(200).json({
      success: true,
      data: LatestData,
      time: new Date(ts_server).getTime(),
      dataAvailabilityYears: years.sort((a,b)=>b-a),
      status: getStatus(ts_server),
    });
    // res.status(500).json({success:false,message:"Something Went wrong"})
  } catch (er) {
    console.log(er);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

const GetDeviceStatusAndLocation = async (req, res) => {
  try {
    const { email } = req.user;

    let returnableObj = [];
    let products = await Users.getProducts(email);
    products = products === "" ? "[]" : products;

    let productsList = JSON.parse(products);
    // console.log({ productsList });

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
      let data = await DataObj.getLatestData();
      const ts_server = data?.latestData?.[0]?.ts_server;
      obj = [...obj, { [deviceId]: { status: getStatus(ts_server) } }];
      return obj;
    }, Promise.resolve([]));

    // console.log({ result: JSON.stringify(result) });

    // Then, get the location and address for each device in parallel using Promise.all
    returnableObj = await Promise.all(
      result.map(async (data) => {
        const [deviceId, objValue] = Object.entries(data)[0]; // Get deviceId and its corresponding value

        // Get location and address for the device
        const [locAndAddress] = await Device.GetDeviceCoordinates(deviceId);
        const [long, lat, address] =
          locAndAddress?.[0]?.dev_location.split(";");

        // Attach location info to the device's status object
        objValue.deviceId = deviceId;
        objValue.location = [lat, long];
        objValue.address = address;
        return { ...objValue };
      })
    );

    const settingsObj = new Settings(email);
    const [settings] = await settingsObj.getSettings();
    // console.log({settings})
    if (settings[0]?.map_settings) {
      const settingsList = JSON.parse(settings[0]?.map_settings);
      // console.log({ settingsList });
      returnableObj = { mapData: returnableObj, mapSettings: settingsList };
    } else {
      returnableObj = { mapData: returnableObj };
    }

    // console.log({ returnableObj: JSON.stringify(returnableObj) });

    // Respond with the final result
    res.status(200).json({ success: true, data: returnableObj });
  } catch (er) {
    console.log(er);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

const GetDataPointsPerYear = async (req, res) => {
  try {
    const { email } = req.user;

    if (!validateRequestBody(req.query, ["deviceId", "year"])) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - deviceId and year",
      });
    }
    const { deviceId, year } = req.query;

    let returnableObj = [];
    let products = await Users.getProducts(email);
    if (!products?.includes(deviceId)) {
      return res.status(400).send({
        success: false,
        message: "You are not authorized to access this device",
      });
    }

    products = products === "" ? "[]" : products;
    let productsList = JSON.parse(products);
    console.log({ productsList });

    if (productsList.length === 0) {
      return res.status(401).json({
        success: false,
        message: "No device found in the products list.",
      });
    }

    let [maxValue] = await Data.getMaxDataPointValue(deviceId, year);
    console.log({ data: maxValue[0] });
    maxValue = maxValue[0]?.max_data_points;

    let [data] = await Data.getDataPoints(deviceId, year);
    console.log({ data });

    res.status(200).json({
      success: "true",
      data: {
        maxValue,
        dataPoints: data?.map(point=>[new Date(point?.date).toISOString().split("T")[0],point?.data_points]),
      },
    });
  } catch (er) {
    console.log("GetDataPointsPerYear | " + er);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};


const GetLastAvgDataByDays=async(req,res)=>{
  try {
    const { email } = req.user;

    if (!validateRequestBody(req.query, ["deviceId", "days", "average"].sort())) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - deviceId, days and average",
      });
    }
    const { deviceId, days , average} = req.query;

    let data = await Data.getLastAvgDataByDays(deviceId,days,average);
    console.log({ data });

    const avgData=data?.avgData.map(obj=>{
      delete obj?.day;
      if(obj?.avg_lg) delete obj?.avg_lg
      if(obj?.avg_lt) delete obj?.avg_lt
      if(obj?.avg_bv) delete obj?.avg_bv
      return obj;
    })
  
    res.status(200).json({success:true, data:avgData, deviceId})


  }
  catch (er) {
    console.log(er)
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
}

const GetLastDataByDuration=async(req,res)=>{
  try {
    const { email } = req.user;


    if (!validateRequestBody(req.query, ["deviceId", "duration"].sort())) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - deviceId, days and average",
      });
    }
    const { deviceId, duration} = req.query;

    let data = await Data.getLastDataByDuration(deviceId,duration);
    // console.log({ data });

    const avgData=data?.avgData.map(obj=>{
      delete obj?.day;
      if(obj?.avg_lg) delete obj?.avg_lg
      if(obj?.avg_lt) delete obj?.avg_lt
      if(obj?.avg_bv) delete obj?.avg_bv
      return obj;
    })
  
    res.status(200).json({success:true, data:avgData,deviceId})


  }
  catch (er) {
    console.log(er)
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
}


const GetLastAvgDataByCustomDuration=async(req,res)=>{
  try {
    const { email } = req.user;
    const {from,to,average}=req.body;
    const {deviceId}=req.query;


    if (!validateRequestBody(req.body, ["from", "to","average"].sort())) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - from, to and average",
      });
    }

    

    let result = await Data.getLastAvgDataByCustomDuration(deviceId,from,to,average);
    // console.log({ data });

    const customReport=result?.data.map(obj=>{
      delete obj?.day;
      if(obj?.avg_lg) delete obj?.avg_lg
      if(obj?.avg_lt) delete obj?.avg_lt
      if(obj?.avg_bv) delete obj?.avg_bv
      if(obj?.lg) delete obj?.lg
      if(obj?.lt) delete obj?.lt
      if(obj?.bv) delete obj?.bv
      return obj;
    })
  
    res.status(200).json({success:true, data:customReport,deviceId})


  }
  catch (er) {
    console.log(er)
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
}

module.exports = {
  GetLatestData,
  GetDeviceStatusAndLocation,
  GetDataPointsPerYear,
  GetLastAvgDataByDays,
  GetLastDataByDuration,
  GetLastAvgDataByCustomDuration
};
