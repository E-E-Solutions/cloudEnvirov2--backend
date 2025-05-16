const Data = require("../models/Data");
const Users = require("../models/User");
const Device = require("../models/Device");

const {
  getStatus,
  validateRequestBody,
  getDeviceType,
} = require("../utils/common");
const Settings = require("../models/Settings");

const GetLatestData = async (req, res) => {
  try {
    const { email,role } = req.user;
    const { deviceId } = req.query;

    let existingProducts = await Users.getProducts(email);

    console.log({ existingProducts: existingProducts });

    existingProducts = existingProducts === "" ? "[]" : existingProducts;

    console.log({ existingProducts });
    // existingProducts = JSON.parse(existingProducts);
    console.log(existingProducts.includes(deviceId));
    if (!existingProducts.includes(deviceId) && role!=="admin") {
      return res.status(401).json({
        success: false,
        message: "You are not authorize to get the data of this device.",
      });
    }


    const DataObj = new Data(deviceId);
    let latestDataObj = await DataObj.getLatestData();
    console.log({ latestDataObj });

    if (!latestDataObj) {
      return res.status(501).json({
        success: false,
        message: "No data is currently available for this device",
      });
    }
    // return;
    const data = latestDataObj.latestData[0];
    console.log({ data });
    //  return res.status(200).json({ success:"false", data:latestDataObj})
    const dailyAverages = latestDataObj.dailyAverages[0];

    // let ts_server = "";

    const deviceType = getDeviceType(deviceId);
    const [deviceTypeInfo] = await Device.getDeviceTypeInfo(deviceType);
    const { ts_col_name, useless_col } = deviceTypeInfo[0];
    const deleteColumns = JSON.parse(useless_col);
    deleteColumns.forEach((col) => {
      delete data[col]; // delete  useless columns like lg, lt, bv,  etc.
    });
    const ts_server = data[ts_col_name];
    delete data[ts_col_name];

    // if (deviceType === "ENE" ||  deviceType === "FLM") {
    //   ts_server = data.ts_server;
    //   delete data._id;
    //   delete data.lg;
    //   delete data.lt;
    //   delete data.bv;
    //   delete data.lon;
    //   delete data.lat;
    //   delete data.batVolt;
    //   delete data.ts_client;
    //   delete data.ts_server;
    // } else if (deviceType === "GWR") {
    //   ts_server = data.date;
    //   delete data.date;
    //   delete data.time;
    //   delete data.id;
    // } else if (deviceType === "WMS") {
    //   ts_server = data._13;
    //   delete data._id;
    //   delete data._9;
    //   delete data._10;
    //   delete data._11;
    //   delete data._12;
    //   delete data._13;
    // }
    // else if (deviceType === "IAQ") {
    //   ts_server = data.date_time;
    //   delete data._id;
    //   delete data.date_time;
    //   delete data.date;
    // }
    // else if (deviceType === "FMU") {
    //   ts_server = data.ts;
    //   delete data._id;
    //   delete data.bv;
    //   delete data.ts;
    // }
    // else if (deviceType === "PIZ") {
    //   ts_server = data.ts;
    //   delete data.id;
    //   delete data.mobile_number;
    //   delete data.batt_volt;
    //   delete data.ts;
    // }

    console.log({ data });
    // const ts_client = data.ts_client;

    const LatestData = await Promise.all(
      Object.entries(data).map(async ([key, value]) => {
        try {
          console.log({ para: key });

          const settings = new Settings(email);
          let [setting] = await settings.getSettings();
          setting = setting[0];
          // console.log({ setting });

          const paraInfo = setting ? JSON.parse(setting.para_info) : {};
          let deviceSettings = paraInfo[deviceId];
          // console.log({ deviceSettings });

          if (deviceSettings) {
            let dataObj = {
              key,
              name: deviceSettings[key].name,
              unit: deviceSettings[key].unit,
              minimum: deviceSettings[key].minimum,
              maximum: deviceSettings[key].maximum,
              threshold: deviceSettings[key].threshold,
              value: value,
              average:
                dailyAverages && Number(dailyAverages[`${key}`]).toFixed(0),
            };

            // console.log(dataObj);
            return dataObj;
          }

          // console.log({ paraInfo });

          let [response] = await Device.getParaInfo(key);
          response = response[0];

          // console.log({ response });
          let dataObj = {
            key,
            name: response.para_name,
            unit: response.para_unit,
            value: value,
            minimum: response.min,
            maximum: response.max,
          };
          // console.log({ dataObj });
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
    let years = dataObj.map((obj) => obj.year);
    console.log({ years });

    console.log({ LatestData });
    console.log({ ts_server });
    const tsServer = new Date(ts_server) || ts_server;
    let gmtOffset = tsServer.getTimezoneOffset() * 60000; // Convert minutes to milliseconds

    // gmtOffset=gmtOffset===0?-19800000:gmtOffset;  // this is because  of the server timezone offset is 0.

    const adjustedTimestamp = tsServer.getTime() + gmtOffset;

    console.log({
      gmtOffset,
      tsServer,
      adjustedTimestamp,
      ts: new Date(adjustedTimestamp),
    });

    res.status(200).json({
      success: true,
      data: LatestData,
      time: adjustedTimestamp,
      dataAvailabilityYears: years.sort((a, b) => b - a),
      status: getStatus(ts_server),
      other: {
        gmtOffset,
        tsServer,
        adjustedTimestamp,
        ts: new Date(adjustedTimestamp),
      },
    });
    // res.status(500).json({success:false,message:"Something Went wrong"})
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error | " + er });
  }
};

const GetSelectedDeviceStatusAndLocation = async (req, res) => {
  try {
    const { email } = req.user;
    const { deviceId } = req.query;
    let returnableObj = [];
    let deviceDataObj = {};
    const DataObj = new Data(deviceId);
    let data = await DataObj.getLatestData();

    // =============== to get the time stamp column name for different device type ==============
    const deviceType = getDeviceType(deviceId);
    const [deviceTypeInfo] = await Device.getDeviceTypeInfo(deviceType);
    const { ts_col_name } = deviceTypeInfo[0];
    const ts_server = data.latestData[0][ts_col_name];
    // ==========================================================================================

    deviceDataObj = { status: getStatus(ts_server) };

    const [locAndAddress] = await Device.GetDeviceCoordinates(deviceId);
    const [long, lat, address] = locAndAddress[0].dev_location.split(";");

    // Attach location info to the device's status object
    deviceDataObj.deviceId = deviceId;
    deviceDataObj.location = [lat, long];
    deviceDataObj.address = address;

    const settingsObj = new Settings(email);
    const [settings] = await settingsObj.getSettings();

    if (settings[0] && settings[0].map_settings) {
      const settingsList = JSON.parse(settings[0].map_settings);
      returnableObj = { mapData: [deviceDataObj], mapSettings: settingsList };
    } else {
      returnableObj = { mapData: [deviceDataObj] };
    }

    // Respond with the final result
    res.status(200).json({ success: true, data: returnableObj });
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error | " + er });
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
      let data = await DataObj.getLatestData();
      console.log({ data });
      if (data) {
        data.latestData[0].ts_server;

        // =============== to get the time stamp column name for different device type ==============
        const deviceType = getDeviceType(deviceId);
        const [deviceTypeInfo] = await Device.getDeviceTypeInfo(deviceType);
        const { ts_col_name } = deviceTypeInfo[0];
        const ts_server = data.latestData[0][ts_col_name];
        // ==========================================================================================

        // let ts_server = "";

        // if (deviceType === "ENE"  || deviceType === "FLM") {
        //   ts_server = data.latestData[0].ts_server;
        // }
        // else if(deviceType==="GWR"){
        //   ts_server = data.latestData[0].date
        // }
        // else if(deviceType==="IAQ"){
        //   ts_server = data.latestData[0].date_time
        // }
        // else if(deviceType==="WMS"){
        //   ts_server = data.latestData[0]._13
        // }
        // else if(deviceType==="FMU"){
        //   ts_server = data.latestData[0].ts
        // }
        // else if(deviceType==="PIZ"){
        //   ts_server = data.latestData[0].ts
        // }

        obj = [...obj, { [deviceId]: { status: getStatus(ts_server) } }];
        return obj;
      } else {
        return obj;
      }
    }, Promise.resolve([]));

    // console.log({ result: JSON.stringify(result) });

    // Then, get the location and address for each device in parallel using Promise.all
    returnableObj = await Promise.all(
      result.map(async (data) => {
        const [deviceId, objValue] = Object.entries(data)[0]; // Get deviceId and its corresponding value

        // Get location and address for the device
        const [locAndAddress] = await Device.GetDeviceCoordinates(deviceId);
        const [long, lat, address] = locAndAddress[0].dev_location.split(";");

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
    if (settings[0] && settings[0].map_settings) {
      const settingsList = JSON.parse(settings[0].map_settings);
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
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error | " + er });
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
    if (!products.includes(deviceId)) {
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
    maxValue = maxValue[0].max_data_points;

    let [data] = await Data.getDataPoints(deviceId, year);
    console.log({ data });

    res.status(200).json({
      success: "true",
      data: {
        maxValue,
        dataPoints: data.map((point) => [
          new Date(point.date).toISOString().split("T")[0],
          point.data_points,
        ]),
      },
    });
  } catch (er) {
    console.log("GetDataPointsPerYear | " + er);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

const GetLastAvgDataByDays = async (req, res) => {
  try {
    const { email } = req.user;

    if (
      !validateRequestBody(req.query, ["deviceId", "days", "average"].sort())
    ) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - deviceId, days and average",
      });
    }
    const { deviceId, days, average } = req.query;

    let data = await Data.getLastAvgDataByDays(deviceId, days, average);
    console.log({ data });

    const avgData = data.avgData.map((obj) => {
      delete obj.day;
      if (obj.avg_lg) delete obj.avg_lg;
      if (obj.avg_lt) delete obj.avg_lt;
      if (obj.avg_bv) delete obj.avg_bv;
      return obj;
    });

    console.log({ avgData });

    res.status(200).json({ success: true, data: avgData, deviceId });
  } catch (er) {
    console.log(er);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

const GetLastDataByDuration = async (req, res) => {
  try {
    const { email } = req.user;
    console.log({ email });

    if (!validateRequestBody(req.query, ["deviceId", "duration"].sort())) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - deviceId, days and average",
      });
    }
    const { deviceId, duration } = req.query;

    let result = await Data.getLastDataByDuration(deviceId, duration);
    // console.log({ data });

    if(!result.data[0]){
      return
    }
    const paraInfo = await Device.getMultiParaInfo([
      ...Object.keys(result.data[0]),
    ]);
    console.log({ defaultParaInfo: paraInfo }); // default para info from parameters_info table

    const settings = new Settings(email);
    let [setting] = await settings.getSettings();
    setting = setting[0];
    console.log({ setting });
    const userPrefferedParaInfo = setting ? JSON.parse(setting.para_info) : {};
    console.log({ userPrefferedParaInfo });
    console.log({ uppiUser: userPrefferedParaInfo[deviceId] });

    // if user  has set preferred parameters, use them
    const paraObj = paraInfo[0].reduce((acc, info) => {
      if (
        userPrefferedParaInfo[deviceId] &&
        userPrefferedParaInfo[deviceId][info.para_key]
      ) {
        console.log({ para: info.para_key });
        console.log({
          name: userPrefferedParaInfo[deviceId][info.para_key].name,
        });

        acc = {
          ...acc,
          [info.para_key]: `${
            userPrefferedParaInfo[deviceId][info.para_key].name
          }${
            userPrefferedParaInfo[deviceId][info.para_key].unit
              ? ` (${userPrefferedParaInfo[deviceId][info.para_key].unit})`
              : ``
          }`,
        };
        return acc;
      } else {
        acc = {
          ...acc,
          [info.para_key]: `${info.para_name}${
            info.para_unit ? ` (${info.para_unit})` : ``
          }`,
        };
        return acc;
      }
    }, {});

    console.log({ paraObj });

    const avgData = result.data.map((obj) => {
      delete obj.day;
      if (obj.lg) delete obj.lg;
      if (obj.lt) delete obj.lt;
      if (obj.bv) delete obj.bv;

      const data = Object.entries(obj).reduce((acc, [key, value]) => {
        console.log(paraObj[key]);

        let _obj;
        if (paraObj[key]) {
          _obj = { [paraObj[key]]: value };
        } else {
          _obj = { [key]: value };
        }

        // console.log({})
        acc = { ...acc, ..._obj };
        return acc;
      }, {});

      console.log({ data });

      return data;
    });

    res.status(200).json({ success: true, data: avgData, deviceId });
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error | " + er });
  }
};

const GetLastAvgDataByCustomDuration = async (req, res) => {
  try {
    const { email } = req.user;
    const { from, to, average, duration } = req.body;
    const { deviceId } = req.query;
    let result = null;

    console.log({ body: req.body });

    if (
      !(
        validateRequestBody(req.body, ["from", "to", "average"].sort()) ||
        validateRequestBody(req.body, ["duration"].sort())
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Request body should contain - (from, to and average) or (duration)",
      });
    }

    if (duration) {
      result = await Data.getLastDataByDuration(deviceId, duration);
    } else {
      result = await Data.getLastAvgDataByCustomDuration(
        deviceId,
        from,
        to,
        average
      );
    }

    console.log({ result });

    if (result.data.length === 0) {
      return res.status(404).json({ success: false, message: "No data found" });
    }

    const paraInfo = await Device.getMultiParaInfo([
      ...Object.keys(result.data[0]),
    ]);
    console.log({ defaultParaInfo: paraInfo });

    const settings = new Settings(email);
    let [setting] = await settings.getSettings();
    setting = setting[0];
    console.log({ setting });
    const userPrefferedParaInfo = setting ? JSON.parse(setting.para_info) : {};

    // if user has set preferred parameters, use them
    const paraObj = paraInfo[0].reduce((acc, info) => {
      if (
        userPrefferedParaInfo[deviceId] &&
        userPrefferedParaInfo[deviceId][info.para_key]
      ) {
        // user preferred settings
        acc = {
          ...acc,
          [info.para_key]: `${
            userPrefferedParaInfo[deviceId][info.para_key].name
          }${
            userPrefferedParaInfo[deviceId][info.para_key].unit
              ? ` (${userPrefferedParaInfo[deviceId][info.para_key].unit})`
              : ``
          }`,
        };
        return acc;
      } else {
        // default settings
        acc = {
          ...acc,
          [info.para_key]: `${info.para_name}${
            info.para_unit ? ` (${info.para_unit})` : ``
          }`,
        };
        return acc;
      }
    }, {});
    console.log({ paraObj });

    const customReport = await result.data.map((obj) => {
      delete obj.day;
      if (obj.lg) delete obj.lg;
      if (obj.lt) delete obj.lt;
      if (obj.bv) delete obj.bv;

      const data = Object.entries(obj).reduce((acc, [key, value]) => {
        console.log(paraObj[key]);
        let _obj;
        if (paraObj[key]) {
          _obj = { [paraObj[key]]: value };
        } else {
          _obj = { [key]: value };
        }

        // console.log({})
        acc = { ...acc, ..._obj };
        return acc;
      }, {});
      console.log(data);

      return data;
    });
    console.log({ customReport });
    res.status(200).json({ success: true, data: customReport, deviceId });
  } catch (er) {
    console.log(er);
    res.status(500).send({ success: false, message: "Internal Server Error", detail:er });
  }
};

module.exports = {
  GetLatestData,
  GetDeviceStatusAndLocation,
  GetSelectedDeviceStatusAndLocation,
  GetDataPointsPerYear,
  GetLastAvgDataByDays,
  GetLastDataByDuration,
  GetLastAvgDataByCustomDuration,
};
