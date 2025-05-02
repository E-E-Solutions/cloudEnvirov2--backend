const db = require("../db/connection");

module.exports = class Image {
  constructor(email) {
    this.email = email;
  }
 
static async findByEmail (emailId){
  return db.execute("SELECT * FROM image_device_info WHERE email = ? ", [emailId])
}
static async findAllDeviceIds(emailId,imageId){
  return db.execute("SELECT * FROM image_device_info WHERE email = ? AND image_id = ? ", [emailId,imageId])
}
static async findDeviceId(emailId,deviceId){
  return db.execute("Select * FROM image_device_info WHERE email = ?  AND device_id = ?", [emailId,deviceId])
}
static async addDeviceId (emailId, imageId, deviceId, top, left){
      return db.execute(`INSERT INTO image_device_info (email,image_id,device_id,y,x)VALUES(?,?,?,?,?) `,[emailId,imageId,deviceId,top,left])
  }
  static async checkDevice ( deviceId){
    return db.execute("SELECT * FROM id_create_info WHERE device_id = ? ", [deviceId])
}
static async duplicateDeviceId (emailId,deviceId, ){
  return db.execute(`SELECT * FROM image_device_info WHERE email = ? AND device_id = ? `, [emailId,deviceId])
}
static async duplicateLocationCheck (imageId,left,top ){
  return db.execute('SELECT * FROM image_device_info WHERE image_id = ? AND x = ? AND y = ?', [imageId, left,top]);
}
 static removeDeviceId(emailId,deviceId){
    return db.execute('DELETE FROM image_device_info WHERE email = ? AND device_id = ?', [emailId,deviceId]);   
  }
  static checkImageId(imageId){
    return db.execute('Select * FROM image_info WHERE image_id = ? ', [imageId]);   
  }
  static findAllImageDetails(emailId){
    return db.execute('Select * FROM image_info WHERE email = ? ', [emailId]);   
  }
  static async addImage(emailId,imageId, imageName, filePath){
  return db.execute(
    'INSERT INTO image_info (email,image_id, image_name, image_path) VALUES (?,?, ?, ?)',
    [emailId,imageId, imageName, filePath]
  );
}
static updateDevicePositionAndId(emailId, oldDeviceId, newDeviceId, imageId, top, left) {
  const query = `
    UPDATE image_device_info 
    SET device_id = ?, y = ?, x = ?
    WHERE email = ? AND device_id = ? AND image_id = ?
  `;
  return db.execute(query, [newDeviceId, top, left, emailId, oldDeviceId, imageId]);
}

}
