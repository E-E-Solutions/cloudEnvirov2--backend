const db = require("../db/connection");

module.exports = class Admin {
  constructor(email) {
    this.email = email;
  }
static findUserbyId(userId) {
    console.log("Find Query Ran")
    return  db.execute("SELECT * FROM user_ WHERE _id = ?", [userId]);
  }
  static findUserByEmailId(emailId) {
    console.log("Find Query Ran")
    const user =  db.execute("SELECT * FROM user_ WHERE email LIKE ?", [`%${emailId}%`]);
    return user;
  }

  static findUserbycontact(contact) {
    return  db.execute("SELECT * FROM user_ WHERE contact LIKE ?", [`%${contact}%`]);
  }

  static findUserbyfirmname(firmName) {
    return  db.execute("SELECT * FROM user_ WHERE firm_name LIKE ?", [`%${firmName}%`]);
  }
  static findUserbyAddress(address) {
    return  db.execute("SELECT * FROM user_ WHERE address LIKE ?", [`%${address}%`]);
  }
  static findUserbydevice(deviceId) {
    return  db.execute("SELECT * FROM user_ WHERE products_List LIKE ?", [`%${deviceId}%`]);
  }
    static findUserbyRole(role) {
    return  db.execute("SELECT * FROM user_ WHERE role_id LIKE ?", [`%${role}%`]);
  }
  
  static removeUser(emailId){
    console.log({emailId})
    return db.execute('DELETE FROM user_ WHERE email = ?', [emailId]);   
  }
  static removeReseller(emailId){
    return db.execute('DELETE FROM reseller_info WHERE email = ?', [emailId]);   
  }
  static async removeAllResellerUsers(vendorId) {
    return db.execute("DELETE FROM reseller_user_info WHERE vendor_id = ?", [vendorId]);
  }
  
  // update user
  static async updateUserInfo( email, password, contact,firmName, address, ) {
    let query = "UPDATE user_ SET";
    const params = [];
    const fields = [];
  
    if (firmName !== undefined && firmName !== null) {
      fields.push(" firm_name = ?");
      params.push(firmName);
    }
    
    if (address !== undefined && address !== null) {
      fields.push(" address = ?");
      params.push(address);
    }
    
    if (contact!== undefined && contact !== null) {
      fields.push(" contact = ?");
      params.push(contact);
    }

    if (password!== undefined && password !== null) {
      fields.push(" password = ?");
      params.push(password);
    }
    
    // Add WHERE clause if there are fields to update
    if (fields.length > 0) {
      query += fields.join(",") + " WHERE email = ?";
      params.push(email);
      
      return db.execute(query, params);
    } else {
      // Nothing to update
      return Promise.resolve({ message: "No fields to update" });
    }
  }

  // update User device
  static async updateUserDeviceInfo( email, deviceId, ) {
    let query = "UPDATE user_ SET";
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

  static async updateResellerDeviceInfo( email, deviceId, ) {
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

    static async updateParameterInfo( paraKey,paraUnit,paraName,min,max ) {
    let query = "UPDATE parameters_info SET";
    const params = [];
    const fields = [];
  
    if (paraName !== undefined && paraName !== null) {
      fields.push(" para_name = ?");
      params.push(paraName);
    }
    if (paraUnit !== undefined && paraUnit !== null) {
      fields.push(" para_unit = ?");
      params.push(paraUnit);
    }
    if (min !== undefined && min !== null) {
      fields.push(" min = ?");
      params.push(min);
    }
     if (max !== undefined && max !== null) {
      fields.push(" max = ?");
      params.push(max);
    }
    
    if (fields.length > 0) {
      query += fields.join(",") + " WHERE para_key = ?";
      params.push(paraKey);
      
      return db.execute(query, params);
    } else {
      return Promise.resolve({ message: "No fields to update" });
    }
  }
static async removeDeviceId(updatedProducts,email){
return db.execute(
    'UPDATE user_ SET products_list = ? WHERE email = ?',
    [JSON.stringify(updatedProducts), email]
  );
}
static async removeResellerDeviceId(updatedProducts,email){
  return db.execute(
      'UPDATE reseller_user_info SET products_list = ? WHERE email = ?',
      [JSON.stringify(updatedProducts), email]
    );
  }
static async getProductsList(email){
return db.execute(
    'SELECT products_list FROM user_ WHERE email = ?', [email]
  );
}

      static addParametersByAdmin(paraName, paraUnit,paraKey,min=0,max=""){
           return db.execute(
              'INSERT INTO parameters_info (para_name, para_unit,para_key,min,max) VALUES (?,?,?,?,?)',
              [paraName, paraUnit,paraKey,min,max]
            );
      }
        static checkParameterKey(paraKey){
          return db.execute('Select * FROM parameters_info WHERE para_key = ?', [paraKey]);   
        }
        static checkParameterName(paraName, paraUnit){
            return db.execute('Select * FROM parameters_info WHERE para_name = ? AND para_unit=?', [paraName, paraUnit]);   
          }
          static async findRoleId(role) {
            const [rows] = await db.execute(
              'SELECT id FROM user_roles WHERE name = ?', [role]
            );
            return rows.length > 0 ? rows[0].id : null; 
          }
          static async findRole(roleId) {
            const [rows] = await db.execute(
              'SELECT name FROM user_roles WHERE id = ?',
              [roleId]
            );
            return rows.length > 0 ? rows[0].name : null;
          }          
        
          static addRole(email, roleId) {
            return db.execute(
              `UPDATE user_ SET role_id = ? WHERE email = ?`,
              [roleId, email]
            );
          }

          static fetchDevices(){
            return db.execute(`SELECT * FROM id_create_info`)
          }
          static fetchParameters(){
            return db.execute (`SELECT * FROM parameters_info`)
          }
          static addUserByAdmin(email, password, roleId, deviceIds = null) {
            if (!email || !password || !roleId) {
              return Promise.reject(
                new Error("Missing required fields: email, password, or roleId")
              );
            }
          
            if (Array.isArray(deviceIds) && deviceIds.length > 0) {
              const deviceIdsJson = JSON.stringify(deviceIds);
              return db.execute(
                `INSERT INTO user_ (email, password, role_id, products_list) VALUES (?, ?, ?, ?)`,
                [email, password, roleId, deviceIdsJson]
              );
            } else {
              return db.execute(
                `INSERT INTO user_ (email, password, role_id) VALUES (?, ?, ?)`,
                [email, password, roleId]
              );
            }
          }
          
           static async checkDevice (deviceId){
              return db.execute("SELECT * FROM id_create_info WHERE device_id = ? ", [deviceId])
          }
            static async checkDatabase (deviceId){
              return db.execute(`SELECT * FROM ${deviceId}` )
          }
          static countUsers(){
            return db.execute("SELECT COUNT(*) as count FROM user_")
           }
 
           static fetchPaginatedUsers(limit, offset) {
              const safeLimit = parseInt(limit, 10);
              const safeOffset = parseInt(offset, 10);
              const query = `SELECT * FROM user_ LIMIT ${safeLimit} OFFSET ${safeOffset}`;
              return db.execute(query);
            }

           static addReseller(name, email, deviceIds = null,vendorId) {
            if (deviceIds && Array.isArray(deviceIds) && deviceIds.length > 0) {
              const deviceIdsJson = JSON.stringify(deviceIds);
              return db.execute(
                `INSERT INTO reseller_info (vendor_name, email, products_list,vendor_id,created_at) VALUES (?, ?, ?, ?,NOW())`,
                [name, email, deviceIdsJson, vendorId]
              );
            } else {
              return db.execute(
                `INSERT INTO reseller_info (vendor_name, email,vendor_id,created_at) VALUES (?, ?, ?,NOW())`,
                [name, email,vendorId]
              );
            }
          }  
              
          
}