const db = require("../db/connection");
module.exports = class Reseller {
    constructor(email) {
      this.email = email;
    }

    static findResellersUserByEmailId(emailId) {
        return  db.execute("SELECT * FROM reseller_user_info WHERE email = ?", [emailId]);
      }
      
    static addResellerUser(email,password,name,reseller_email,deviceIds){
                    if (deviceIds && Array.isArray(deviceIds) && deviceIds.length > 0) {
                      const deviceIdsJson = JSON.stringify(deviceIds);
                      return db.execute(
                        `INSERT INTO reseller_user_info (email, password, name, reseller_email,products_list) VALUES (?, ?, ?, ?, ?)`,
                        [ email, password,name,reseller_email,deviceIdsJson]
                      );
                    }
                }
    static async fetchResellerDevices(email) {
                return db.execute("SELECT products_list FROM reseller_info WHERE email = ?", [email]);
            }

    static async fetchResellerUsers(email){
        return db.execute("SELECT * FROM reseller_user_info WHERE reseller_email = ?", [email]);
    }
   // Fetch a single reseller user (by email)
static async fetchResellerUserDevices(email) {
    return db.execute("SELECT products_list FROM reseller_user_info WHERE email = ?", [email]);
  }
  
  // Update user's device list
  static async removeDeviceId(updatedProducts, email) {
    return db.execute(
      'UPDATE reseller_user_info SET products_list = ? WHERE email = ?',
      [JSON.stringify(updatedProducts), email]
    );
  }
  
    static async checkDevice(email, deviceId) {
        return db.execute(
          `SELECT * FROM reseller_info WHERE email = ? AND JSON_CONTAINS(products_list, JSON_QUOTE(?))`,
          [email, deviceId]
        );
      }
      
      static async findResellerUser(reseller_email,email){
                return db.execute("SELECT * FROM reseller_user_info WHERE reseller_email = ? AND email=?", [reseller_email,email]);
            }
    static async updateResellerUserDeviceInfo( email, deviceId, ) {
        let query = "UPDATE reseller_user_info SET";
        const params = [];
        const fields = [];
      
        if (deviceId !== undefined && deviceId !== null) {
          fields.push(" products_List = ?");
          params.push(JSON.stringify(deviceId));
        }
        
        if (fields.length > 0) {
          query += fields.join(",") + " WHERE email = ?";
          params.push(email);
          
          return db.execute(query, params);
        } else {
          return Promise.resolve({ message: "No fields to update" });
        }
      }
     static async updateResellerUserFirmInfo(emailId, password,firmName, firmAddress, contactNo) {
        let query = "UPDATE reseller_user_info SET";
        const params = [];
        const fields = [];
        if (password !== undefined && password !== null) {
          fields.push(" password = ?");
          params.push(password);
        }
      
        if (firmName !== undefined && firmName !== null) {
          fields.push(" firm_name = ?");
          params.push(firmName);
        }
        
        if (firmAddress !== undefined && firmAddress !== null) {
          fields.push(" address = ?");
          params.push(firmAddress);
        }
        
        if (contactNo !== undefined && contactNo !== null) {
          fields.push(" contact = ?");
          params.push(contactNo);
        }
        
        // Add WHERE clause if there are fields to update
        if (fields.length > 0) {
          query += fields.join(",") + " WHERE email = ?";
          params.push(emailId);
          
          return db.execute(query, params);
        } else {
          // Nothing to update
          return Promise.resolve({ message: "No fields to update" });
        }
      }
      static removeResellerUser(emailId){
          console.log({emailId})
          return db.execute('DELETE FROM reseller_user_info WHERE email = ?', [emailId]);   
        }

}