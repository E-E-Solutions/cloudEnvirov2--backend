const db = require("../db/connection");
module.exports = class Reseller {
    constructor(email) {
      this.email = email;
    }

    static findResellersUserByEmailId(emailId) {
        return  db.execute("SELECT * FROM reseller_user_info WHERE email = ?", [emailId]);
      }
      
    static addResellerUser(email,password,name,vendorId,deviceIds){
                    if (deviceIds && Array.isArray(deviceIds) && deviceIds.length > 0) {
                      const deviceIdsJson = JSON.stringify(deviceIds);
                      return db.execute(
                        `INSERT INTO reseller_user_info (email, password, name, vendor_id,products_list,created_at,access_status) VALUES (?, ?, ?, ?, ?, NOW(),true)`,
                        [ email, password,name,vendorId,deviceIdsJson]
                      );
                    }
                }
    static async fetchResellerDevices(email) {
                return db.execute("SELECT products_list FROM reseller_info WHERE email = ?", [email]);
            }
    static async fetchAllVendorIds(){
      return db.execute (`SELECT * FROM reseller_info` )
    }

    static async fetchResellerUsers(vendorId){
        return db.execute("SELECT * FROM reseller_user_info WHERE vendor_id = ?", [vendorId]);
    }
   // Fetch a single reseller user (by email)
static async fetchResellerUserDevices(email) {
    return db.execute("SELECT products_list FROM reseller_user_info WHERE email = ?", [email]);
  }
  static async changeAccessStatus(accessStatus,email){
    return db.execute('UPDATE reseller_user_info SET access_status = ? WHERE email = ?',[accessStatus,email])
  }
  static async findAccessStatus(email) {
  const [rows] = await db.execute(
    `SELECT access_status FROM reseller_user_info WHERE email = ?`,
    [email]
  );

  if (rows.length === 0) return null; // or throw error if preferred

  return {
    accessStatus: rows[0].access_status === 1, // Convert to true/false
  };
}

  
  // Update user's device list
  static async removeDeviceId(updatedProducts, email) {
    return db.execute(
      'UPDATE reseller_user_info SET products_list = ? WHERE email = ?',
      [JSON.stringify(updatedProducts), email]
    );
  }
  
    static async checkDevice(vendorId, deviceId) {
        return db.execute(
          `SELECT * FROM reseller_info WHERE vendor_id = ? AND JSON_CONTAINS(products_list, JSON_QUOTE(?))`,
          [vendorId, deviceId]
        );
      }
      
      static async findResellerUser(vendorId,email){
                return db.execute("SELECT * FROM reseller_user_info WHERE vendor_id = ? AND email=?", [vendorId,email]);
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
          return db.execute('DELETE FROM reseller_user_info WHERE email = ?', [emailId]);   
        }
 
        static checkVendorId(vendorId){
              return db.execute(`SELECT * FROM reseller_info WHERE vendor_id = ?`,[vendorId]);
        }
        static addVendorId(vendorId,email){
          return db.execute(`Update reseller_user_info SET vendor_id = ? WHERE email =?`,[vendorId,email])
        }
        static async findReseller(vendorId) {
          return db.execute(
            `SELECT email FROM reseller_info WHERE vendor_id = ?`,
            [vendorId]
          );
        }
        static vendorIdExists(email){
          return db.execute(`SELECT vendor_id FROM reseller_info WHERE email = ? `,[email])
        }
        static vendorUserIdExists(email){
          return db.execute(`SELECT vendor_id FROM reseller_user_info WHERE email = ? `,[email])
        }
        static async updateResellerDevices1( email, deviceId, ) {
            let query = "UPDATE reseller_info SET";
            const params = [];
            const fields = [];
          
            if (deviceId !== undefined && deviceId !== null) {
              fields.push(" products_list = ?");
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

          static async findVendorId(email){
            return db.execute(`SELECT vendor_id FROM reseller_info WHERE email =?`,[email])
          }
          static async findVendorEmail(vendorId){
            return db.execute(`SELECT email FROM reseller_info WHERE vendor_id = ?`,[vendorId])
          }
          static async revokeDeviceIdForResellerUser(email,vendorId,deviceId){
            return db.execute(`INSERT INTO device_status_info (email,vendor_id,device_id,is_active,revoked_on) VALUES (?,?,?,false,NOW())`, [email,vendorId,deviceId])
          }
            static async revokeDeviceIdForResellerUserUpdate(deviceId){
            return db.execute(`UPDATE device_status_info SET is_active = false, revoked_on = NOW() WHERE device_id = ?`, [deviceId])
          }
         static async grantDeviceIdToResellerUser(deviceId) {
          return db.execute(
            `UPDATE device_status_info SET is_active = true, granted_on = NOW() WHERE device_id = ?`,
            [ deviceId]
          );
          }
          static async findRevokedDeviceId(deviceId){
            return db.execute(`SELECT * FROM device_status_info WHERE device_id = ?`, [deviceId])
          }
          static async fetchAllRevokedDeviceIds(email){
            return db.execute(`SELECT * FROM device_status_info WHERE email = ?`, [email])
          }
      
}