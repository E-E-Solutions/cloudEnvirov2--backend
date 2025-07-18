const Data = require("../models/Data");
const Users = require("../models/User");
const Device = require("../models/Device");
const Admin = require("../models/Admin");


const {
  getStatus,
  validateRequestBody,
  getDeviceType,
} = require("../utils/common");
const Settings = require("../models/Settings");
const Reseller = require("../models/Reseller");

const GetLatestData = async (req, res) => {
  try {
    let { email, role } = req.user;
     if(role === "reseller"){
       email = req.query.email;
       if (email ) {
       role = "resellerUser";
    }
     else{
      email= req.user.email;    
    }
  }
    else if(role === "admin"){
    email = req.query.email;
     email = req.query.email;
       if (email ) {
       role = "resellerUser";
    }
     else{
      email= req.user.email;    
    }
  }
  
    const rawDeviceId = req.query.deviceId;
    const deviceId = rawDeviceId.toUpperCase(); // Ensure deviceId is uppercase
  //  const checkDeviceId = await Admin.checkDatabase(deviceId);
  //   if (!checkDeviceId) {
  //     return res
  //       .status(500)
  //       .json({ success: false, message: "No Database available for deviceId: " + deviceId });
  //   }

    if (role === "resellerUser") {
      const validateDeviceId = await Reseller.findRevokedDeviceId(deviceId);
     if (validateDeviceId[0] && validateDeviceId[0].length > 0) {
    const isAnyRevoked = validateDeviceId[0].map(
      (device) => device.is_active
    );
        if (isAnyRevoked == 0) {
          return res.status(403).json({
            success: false,
            message:
              "Access to this device's data has been revoked. For help, please reach out to your account administrator.",
          });
        }
      }
    }

    let existingProducts;
    if (role === "resellerUser") {
      existingProducts = await Users.getResellerUserProducts(email);
    } else {
      existingProducts = await Users.getProducts(email);
    }

    console.log({ existingProducts });

    existingProducts = existingProducts === "" ? "[]" : existingProducts;
    // Convert from JSON string if needed
    existingProducts =
      typeof existingProducts === "string"
        ? JSON.parse(existingProducts)
        : existingProducts;

    if (!existingProducts.includes(deviceId) && role !== "admin") {
      return res.status(401).json({
        success: false,
        message: "You are not authorized to get the data of this device.",
      });
    }
    const DataObj = new Data(deviceId);
    const latestDataObj = await DataObj.getLatestData();

    if (!latestDataObj) {
      return res.status(501).json({
        success: false,
        message: "No data is currently available for this device",
      });
    }

    const data = latestDataObj.latestData[0];
    const dailyAverages = latestDataObj.dailyAverages[0];

    const deviceType = getDeviceType(deviceId);
    const [deviceTypeInfo] = await Device.getDeviceTypeInfo(deviceType);
    const { ts_col_name, useless_col } = deviceTypeInfo[0];
    const deleteColumns = JSON.parse(useless_col);
    deleteColumns.forEach((col) => delete data[col]);

    const ts_server = data[ts_col_name];
    delete data[ts_col_name];

    const LatestData = await Promise.all(
      Object.entries(data).map(async ([key, value]) => {
        try {
          const settings = new Settings(email);
          let [setting] = await settings.getSettings();
          setting = setting[0];
          const paraInfo = setting ? JSON.parse(setting.para_info) : {};
          let deviceSettings = paraInfo[deviceId];

          if (deviceSettings && deviceSettings[key]) {
            return {
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
          }

          const [response] = await Device.getParaInfo(key);
          const responseObj = response[0];
          return {
            key,
            name: responseObj.para_name,
            unit: responseObj.para_unit,
            value: value,
            minimum: responseObj.min,
            maximum: responseObj.max,
          };
        } catch (er) {
          console.log(er);
          return null;
        }
      })
    );

    const [dataObj] = await Data.getDataAvailabilityYears(deviceId);
    const years = dataObj.map((obj) => obj.year);

    const tsServer = new Date(ts_server) || ts_server;
    const gmtOffset = tsServer.getTimezoneOffset() * 60000;
    const adjustedTimestamp = tsServer.getTime() + gmtOffset;

    return res.status(200).json({
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
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error | " + er });
  }
};

const GetSelectedDeviceStatusAndLocation = async (req, res) => {
  try {
    const { email, role } = req.user;
    const { deviceId } = req.query;
    let returnableObj = [];
    let deviceDataObj = {};

    if (role === "resellerUser") {
      const validateDeviceId = await Reseller.findRevokedDeviceId(deviceId);
     if (validateDeviceId[0] && validateDeviceId[0].length > 0) {
    const isAnyRevoked = validateDeviceId[0].map(
      (device) => device.is_active
    );
        if (isAnyRevoked == 0) {
          return res.status(403).json({
            success: false,
            message:
              "Access to this device's data has been revoked. For help, please reach out to your account administrator.",
          });
        }
      }
    }

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
    const { email, role } = req.user;

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

    if (productsList.length === 0) {
      return res.status(401).json({
        success: false,
        message: "No device found in the products list.",
      });
    }

    // First, get the status for each device
    const result = await productsList.reduce(async (acc, deviceId) => {
      if (role === "resellerUser") {
      const validateDeviceId = await Reseller.findRevokedDeviceId(deviceId);
     if (validateDeviceId[0] && validateDeviceId[0].length > 0) {
    const isAnyRevoked = validateDeviceId[0].map(
      (device) => device.is_active
    );
        if (isAnyRevoked == 0) {
          return res.status(403).json({
            success: false,
            message:
              "Access to this device's data has been revoked. For help, please reach out to your account administrator.",
          });
        }
      }
    }

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
    const { email, role } = req.user;

    if (!validateRequestBody(req.query, ["deviceId", "year"])) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - deviceId and year",
      });
    }
    const { deviceId, year } = req.query;

    let returnableObj = [];
    let products = await Users.getProducts(email);
    if (!products.includes(deviceId) && role !== "admin") {
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
    const { email, role } = req.user;
    console.log({ email });

    if (!validateRequestBody(req.query, ["deviceId", "duration"].sort())) {
      return res.status(400).json({
        success: false,
        message: "Request body should contain - deviceId, days and average",
      });
    }
    const { deviceId, duration } = req.query;
    if (role === "resellerUser") {
      const validateDeviceId = await Reseller.findRevokedDeviceId(deviceId);
     if (validateDeviceId[0] && validateDeviceId[0].length > 0) {
    const isAnyRevoked = validateDeviceId[0].map(
      (device) => device.is_active
    );
        if (isAnyRevoked == 0) {
          return res.status(403).json({
            success: false,
            message:
              "Access to this device's data has been revoked. For help, please reach out to your account administrator.",
          });
        }
      }
    }


    let result = await Data.getLastDataByDuration(deviceId, duration);
    // console.log({ data });

    if (!result.data[0]) {
      return;
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
        const displayKey = paraObj[key] || key;
        const numericValue = Number(value);
        const isDate = !isNaN(Date.parse(value));

        const roundedValue = isDate
          ? value
          : isNaN(numericValue)
          ? value
          : parseFloat(numericValue.toFixed(1));

        acc[displayKey] = roundedValue;
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
    var { email, role } = req.user;
    var { from, to, average, duration } = req.body;
    var { deviceId } = req.query;
    let result = null;

    console.log({ body: req.body });

    if (role === "resellerUser") {
      const validateDeviceId = await Reseller.findRevokedDeviceId(deviceId);
     if (validateDeviceId[0] && validateDeviceId[0].length > 0) {
    const isAnyRevoked = validateDeviceId[0].map(
      (device) => device.is_active
    );
        if (isAnyRevoked == 0) {
          return res.status(403).json({
            success: false,
            message:
              "Access to this device's data has been revoked. For help, please reach out to your account administrator.",
          });
        }
      }
    }


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
        const displayKey = paraObj[key] || key;
        // Round if value is a number
        const numericValue = Number(value);
        const isDate = !isNaN(Date.parse(value));

        const roundedValue = isDate
          ? value
          : isNaN(numericValue)
          ? value
          : parseFloat(numericValue.toFixed(1));

        acc[displayKey] = roundedValue;
        return acc;
      }, {});

      console.log(data);

      return data;
    });
    console.log({ customReport });
      await Users.logUserActivity(role ,email, "Get Data By Custom Duration", "User fetched data by custom duration","success","", { from, to, average, duration,deviceId });
    res.status(200).json({ success: true, data: customReport, deviceId });
  } catch (er) {
    console.log(er);
     await Users.logUserActivity(role ,email, "Get Data By Custom Duration", `error: ${er}`,"failure","", { from, to, average, duration,deviceId });
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", detail: er });
  }
};
const GetAllParametersData = async (req, res) => {
  try {
    const { email, role } = req.user;

    // Fetch products based on role
   
    let existingProducts;
    if (role === "resellerUser") {
      existingProducts = await Users.getResellerUserProducts(email);
    } else {
      existingProducts = await Users.getProducts(email);
    }

    console.log({ existingProducts });

    existingProducts = existingProducts === "" ? "[]" : existingProducts;

    // Convert from JSON string if needed
    existingProducts =
      typeof existingProducts === "string"
        ? JSON.parse(existingProducts)
        : existingProducts;

    // existingProducts should be an array now
    // Process each deviceId asynchronously and gather results
    const allDevicesData = await Promise.all(
      
      existingProducts.map(async (deviceId) => {
       if (role === "resellerUser") {
      const validateDeviceId = await Reseller.findRevokedDeviceId(deviceId);
     if (validateDeviceId[0] && validateDeviceId[0].length > 0) {
    const isAnyRevoked = validateDeviceId[0].map(
      (device) => device.is_active
    );
        if (isAnyRevoked == 0) {
          return res.status(403).json({
            success: false,
            message:
              "Access to this device's data has been revoked. For help, please reach out to your account administrator.",
          });
        }
      }
    }

        const DataObj = new Data(deviceId);
        const latestDataObj = await DataObj.getLatestData();

        if (!latestDataObj) {
          // If no data for this device, skip it by returning null or empty
          return null;
        }

        const data = latestDataObj.latestData[0];
        const dailyAverages = latestDataObj.dailyAverages[0];

        const deviceType = getDeviceType(deviceId);
        const [deviceTypeInfo] = await Device.getDeviceTypeInfo(deviceType);
        const { ts_col_name, useless_col } = deviceTypeInfo[0];
        const deleteColumns = JSON.parse(useless_col);
        deleteColumns.forEach((col) => delete data[col]);

        const ts_server = data[ts_col_name];
        delete data[ts_col_name];

        // Process each parameter in data
        const LatestData = await Promise.all(
          Object.entries(data).map(async ([key, value]) => {
            try {
              const settings = new Settings(email);
              let [setting] = await settings.getSettings();
              setting = setting[0];
              const paraInfo = setting ? JSON.parse(setting.para_info) : {};
              let deviceSettings = paraInfo[deviceId];

              if (deviceSettings && deviceSettings[key]) {
                return {
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
              }

              // If no device-specific setting, get default para info
              const [response] = await Device.getParaInfo(key);
              const responseObj = response[0];
              return {
                key,
                name: responseObj.para_name,
                unit: responseObj.para_unit,
                value: value,
                minimum: responseObj.min,
                maximum: responseObj.max,
              };
            } catch (er) {
              console.log(er);
              return null;
            }
          })
        );

        const [dataObj] = await Data.getDataAvailabilityYears(deviceId);
        const years = dataObj.map((obj) => obj.year);

        const tsServer = new Date(ts_server) || ts_server;
        const gmtOffset = tsServer.getTimezoneOffset() * 60000;
        const adjustedTimestamp = tsServer.getTime() + gmtOffset;

        return {
          deviceId,
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
        };
      })
    );

    // Filter out null devices (devices with no data)
    const filteredDevicesData = allDevicesData.filter((d) => d !== null);

    if (filteredDevicesData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No data is currently available for any devices",
      });
    }

    return res.status(200).json({
      success: true,
      devices: filteredDevicesData,
    });
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error | " + er });
  }
};
const GetAllDevicesLatestData = async (req, res) => {
  try {
    const { deviceId: rawDeviceId } = req.query;
    const deviceId = rawDeviceId.toUpperCase();

    const DataObj = new Data(deviceId);
    const latestDataObj = await DataObj.getLatestData();

    if (!latestDataObj) {
      return res.status(501).json({
        success: false,
        message: "No data is currently available for this device",
      });
    }

    const data = latestDataObj.latestData[0];
    const dailyAverages = latestDataObj.dailyAverages[0];

    const deviceType = getDeviceType(deviceId);
    const [deviceTypeInfo] = await Device.getDeviceTypeInfo(deviceType);
    const { ts_col_name, useless_col } = deviceTypeInfo[0];
    const deleteColumns = JSON.parse(useless_col);
    deleteColumns.forEach((col) => delete data[col]);

    const ts_server = data[ts_col_name];
    delete data[ts_col_name];

    const LatestData = await Promise.all(
      Object.entries(data).map(async ([key, value]) => {
        try {
          const settings = new Settings();
          let [setting] = await settings.getSettings();
          setting = setting[0];
          const paraInfo = setting ? JSON.parse(setting.para_info) : {};
          let deviceSettings = paraInfo[deviceId];

          if (deviceSettings && deviceSettings[key]) {
            return {
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
          }

          const [response] = await Device.getParaInfo(key);
          const responseObj = response[0];
          return {
            key,
            name: responseObj.para_name,
            unit: responseObj.para_unit,
            value: value,
            minimum: responseObj.min,
            maximum: responseObj.max,
          };
        } catch (er) {
          console.log(er);
          return null;
        }
      })
    );

    const [dataObj] = await Data.getDataAvailabilityYears(deviceId);
    const years = dataObj.map((obj) => obj.year);

    const tsServer = new Date(ts_server) || ts_server;
    const gmtOffset = tsServer.getTimezoneOffset() * 60000;
    const adjustedTimestamp = tsServer.getTime() + gmtOffset;

    return res.status(200).json({
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
  } catch (er) {
    console.log(er);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error | " + er });
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
  GetAllParametersData,
  GetAllDevicesLatestData,
};
