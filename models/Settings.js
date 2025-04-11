const db = require("../db/connection");


module.exports = class Settings {
  constructor(email) {
    this.email = email;
  }

  getSettings() {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query("SELECT * FROM user_settings WHERE email = ?", [
          this.email,
        ]);
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }

  static setMapSettings(mapSettings, email) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          `INSERT INTO user_settings (email, map_settings) 
                 VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE map_settings = ?`,
          [email, mapSettings, mapSettings]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }

  static setParaSettings(paraInfo, email) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          `INSERT INTO user_settings (email, para_info) 
                 VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE para_info = ?`,
          [email, paraInfo, paraInfo]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
};
