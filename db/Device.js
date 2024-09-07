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
}

module.exports = Device;
