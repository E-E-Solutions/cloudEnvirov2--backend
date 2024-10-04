const db = require("./connection");

class Data {
  constructor(deviceId) {
    this.deviceId = deviceId;
  }

  getLatestData() {
    return new Promise((resolve, reject) => {
      try {
        
        const row = db.query("SELECT * FROM ?? ORDER BY _id DESC LIMIT 1", [this.deviceId]);
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }

  static getParaInfo(key){
    return new Promise((resolve, reject) => {
      try {
        const row = db.query("SELECT * FROM parameters_info WHERE para_key = ?", [key]);
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }

  static latestDataByDataPoints(deviceId, limit) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query("SELECT * FROM ?? ORDER BY _id DESC LIMIT ?", [deviceId, limit]);
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
}

module.exports = Data;
