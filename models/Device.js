const db = require("../db/connection");
const { getDeviceType } = require("../utils/common");

class Device {
  constructor(deviceId, serialNo) {
    this.deviceId = deviceId;
    this.serialNo = serialNo;
  }

  validateDevice() {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query("SELECT * FROM id_create_info WHERE device_id = ? AND sno = ?", [this.deviceId, this.serialNo]);
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }

  static getParaInfo(key) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          "SELECT * FROM parameters_info WHERE para_key = ?",
          [key]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }

  static getMultiParaInfo(keys) {
    return new Promise((resolve, reject) => {
      try {
        const placeholders = keys.map(() => '?').join(', ');
        const query = `SELECT * FROM parameters_info WHERE para_key IN (${placeholders})`;
        const row = db.query(query, keys); // Pass keys array as the parameter values
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }

  static getDeviceTypeInfo(type){
    console.log({type})
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          "SELECT * FROM device_type_info WHERE device_type = ?",
          [type]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });

  }

  static updateAlias(alias, deviceId) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query("UPDATE id_create_info SET alias = ? WHERE device_id = ?", [alias, deviceId]);
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
  static updateLocation(location, deviceId) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query("UPDATE id_create_info SET dev_location = ? WHERE device_id = ?", [location, deviceId]);
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
  static GetDeviceInfo(deviceId) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query("SELECT * FROM id_create_info WHERE device_id = ?", [deviceId]);
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
  static GetDeviceAlias(deviceId){
return db.execute("SELECT alias FROM id_create_info WHERE device_id = ?", [deviceId])
  }

  static GetDeviceCoordinates(deviceId){
    return new Promise((resolve, reject) => {
      try {
        const row = db.query("SELECT `dev_location` FROM id_create_info WHERE device_id = ?", [deviceId]);
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
}

module.exports = Device;
