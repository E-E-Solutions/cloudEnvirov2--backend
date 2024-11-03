const db = require("../db/connection");
const GWR = require("./DeviceTypes/GWR");
const ENE = require("./DeviceTypes/ENE");
const FLM = require("./DeviceTypes/FLM");
const FMU = require("./DeviceTypes/FMU");
const WMS = require("./DeviceTypes/WMS");
const IAQ = require("./DeviceTypes/IAQ");
const PIZ = require("./DeviceTypes/PIZ");
const { getDeviceType } = require("../utils/common");

class Data {
  constructor(deviceId) {
    this.deviceId = deviceId;
  }

  #deviceMapping = {
    ENE,
    IAQ,
    WMS,
    FLM,
    FMU,
    GWR,
    PIZ,
  };

  async getLatestData() {
    const instance = new Data(this.deviceId);
    return await instance.executeDeviceFunction("getLatestData", this.deviceId);
  }

  static async getLastAvgDataByDays(deviceId, days, average) {
    const instance = new Data(deviceId);
    return await instance.executeDeviceFunction(
      "getLastAvgDataByDays",
      deviceId,
      days,
      average
    );
  }

  static async getLastDataByDuration(deviceId, duration) {
    const instance = new Data(deviceId);
    return await instance.executeDeviceFunction(
      "getLastDataByDuration",
      deviceId,
      duration
    );
  }

  static async getLastAvgDataByCustomDuration(deviceId, from, to, average) {
    const instance = new Data(deviceId);
    return await instance.executeDeviceFunction(
      "getLastAvgDataByCustomDuration",
      deviceId,
      from,
      to,
      average
    );
  }

  static async getDataPoints(deviceId, year) {
    const instance = new Data(deviceId);
    return await instance.executeDeviceFunction(
      "getDataPoints",
      deviceId,
      year
    );
  }

  static async getMaxDataPointValue(deviceId, year) {
    const instance = new Data(deviceId);
    return await instance.executeDeviceFunction(
      "getMaxDataPointValue",
      deviceId,
      year
    );
  }

  static async getDataAvailabilityYears(deviceId) {
    const instance = new Data(deviceId);
    return await instance.executeDeviceFunction(
      "getDataAvailabilityYears",
      deviceId
    );
  }

  async executeDeviceFunction(method, ...args) {
    const deviceType = getDeviceType(args[0]); // Assuming deviceId is the first argument
    const deviceClass = this.#deviceMapping[deviceType];
    console.log({deviceClass})
    if (method === "getLatestData") {
      const deviceInstance = new deviceClass(args[0]);
      return await deviceInstance[method](...args);
    }

    if (deviceClass && typeof deviceClass[method] === "function") {
      return await deviceClass[method](...args);
    } else {
      throw new Error("Invalid device type or method.");
    }
  }
}

module.exports = Data;
