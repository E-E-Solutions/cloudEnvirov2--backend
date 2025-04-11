const db = require("../db/connection");

module.exports = class Theme{
    constructor(compId){
        this.compId = compId;
    }


    getTheme(){
        return new Promise((resolve, reject) => {
            try {
              const row = db.query("SELECT config FROM user_theme WHERE compId = ?", [this.email]);
              resolve(row);
            } catch (er) {
              console.log(er);
              reject(er);
            }
          });
    }
}