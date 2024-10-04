const db = require("./connection");
const crypto = require("crypto");

module.exports = class Users {
  constructor(firmName, password, emailId, productsList, contactNo, address) {
    this.emailId = emailId;
    this.password = password;
    this.name = firmName;
    this.firmName = firmName;
    this.productsList = productsList;
    this.contactNo = contactNo;
    this.address = address;
  }

  // Method to save user details in the database
  save() {
    return new Promise(async (resolve, reject) => {
      try {
        // Log the values before executing the query
        console.log({
          name: this.name,
          emailId: this.emailId,
          password: this.password,
          productsList: this.productsList,
          address: this.address,
          contactNo: this.contactNo,
          firmName: this.firmName,
        });

        // Execute the SQL query
        const [rows] = await db.execute(
          "INSERT INTO user_ (name, email, password, products_list, address, contact, salutation, firm_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            this.name,
            this.emailId,
            this.password,
            JSON.stringify(this.productsList),
            this.address,
            this.contactNo,
            "M/S",
            this.firmName || "", // Default to empty string if firmName is null/undefined
          ]
        );
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    });
  }

  static findOne(emailId) {
    return db.execute("SELECT * FROM user_ WHERE email = ?", [emailId]);
  }

  static findAll() {
    return db.execute("SELECT * FROM user_");
  }

  static changePassword(emailId, oldPassword, newPassword) {
    return db.execute("UPDATE user_ SET password = ? WHERE email = ? AND password = ?", [newPassword, emailId, oldPassword]);
  }
  static forgetPassword(emailId, newPassword) {
    return db.execute("UPDATE user_ SET password = ? WHERE email = ? ", [newPassword, emailId]);
  }

  static async getProducts(emailId) {
    const existingProducts = await db.execute("SELECT * FROM user_ WHERE email = ?", [emailId]);
    return existingProducts[0][0].products_list;
  }
  static async addProduct(emailId, productsList) {
    return db.execute("UPDATE user_ SET products_list = ? WHERE email = ?", [JSON.stringify(productsList), emailId]);
  }

  static async verifyOtp(emailId, otp) {
    const response = await db.execute("SELECT * FROM `cloud_enviro_otp` WHERE email = ?", [emailId]);
    const { expires_at, otp: existingOtp } = response[0][0];
    const expiringTime = new Date(expires_at).getTime();
    const currentTime = Date.now();
    if (currentTime > expiringTime) {
      // Delete data in cloud_enviro_otp if it otp expires !
      await db.execute("DELETE FROM `cloud_enviro_otp` WHERE `email` = ?;", [emailId]);
      return { success: false, message: "OTP has expired." };
    }

    if (otp.toString() !== existingOtp.toString()) {
      return { success: false, message: "Invalid OTP." };
    }

    // Delete email and otp if it verifies successfully!
    await db.execute("DELETE FROM `cloud_enviro_otp` WHERE `email` = ?;", [emailId]);
    return { success: true, message: "OTP verified successfully." };
  }

  static async generateOtp(emailId) {
    const otp = crypto.randomInt(1000, 10000).toString();
    const expiresAtUnix = Date.now() + 10 * 60 * 1000;
    const dateTime = new Date(expiresAtUnix);
    const expiresAt =
      dateTime.getFullYear() +
      "-" +
      (+dateTime.getMonth() + +1) +
      "-" +
      dateTime.getDate() +
      " " +
      dateTime.getHours() +
      ":" +
      dateTime.getMinutes() +
      ":" +
      dateTime.getSeconds();
    const emailExists = await db.execute("SELECT * FROM `cloud_enviro_otp` WHERE email = ?", [emailId]);
    if (emailExists[0][0]) {
      const [response] = await db.execute("UPDATE `cloud_enviro_otp` SET `expires_at`= ? , `otp`= ? WHERE email= ?", [expiresAt, otp, emailId]);

      if (response.affectedRows === 0) {
        return { success: false, msg: "Not Created" };
      }
      return { success: true, msg: "Created", otp: otp };
    } else {
      const [response] = await db.execute("INSERT INTO `cloud_enviro_otp` (`_id`, `email`, `expires_at`, `otp`) VALUES (NULL, ?, ?, ?);", [
        emailId,
        expiresAt,
        otp,
      ]);

      if (response.affectedRows === 0) {
        return { success: false, msg: "Not Created" };
      }
      return { success: true, msg: "Created", otp: otp };
    }
  }
};
