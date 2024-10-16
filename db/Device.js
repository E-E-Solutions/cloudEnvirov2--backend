const db = require("./connection");

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
