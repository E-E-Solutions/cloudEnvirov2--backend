const db = require("../db/connection");
const crypto = require("crypto");
const { randomInt } = require("../utils/common");

module.exports = class Users {
  constructor(
    firmName,
    password,
    emailId,
    productsList,
    contactNo,
    address,
    roleId,
    isVerified = undefined
  ) {
    this.emailId = emailId;
    this.password = password;
    this.name = firmName;
    this.firmName = firmName;
    this.productsList = productsList;
    this.contactNo = contactNo;
    this.address = address;
    this.roleId = roleId;
    this.isVerified = isVerified;
  }

  // Method to save user details in the database
  save() {
    return new Promise(async (resolve, reject) => {
      try {
        const baseQuery =
          "INSERT INTO user_ (name, email, password, products_list, address, contact, salutation, firm_name,role_id";
        const baseValues = [
          this.name,
          this.emailId,
          this.password,
          JSON.stringify(this.productsList),
          this.address,
          this.contactNo,
          "M/S",
          this.firmName || "",
          this.roleId,
        ];

        // If isVerified is provided, include it in the query
        let finalQuery = baseQuery;
        let finalValues = baseValues;

        if (typeof this.isVerified !== "undefined") {
          finalQuery += ", isVerified";
          finalValues.push(this.isVerified);
        }

        finalQuery +=
          ") VALUES (?, ?, ?, ?, ?, ?, ?, ?,?" +
          (typeof this.isVerified !== "undefined" ? ", ?" : "") +
          ")";

        console.log({
          name: this.name,
          emailId: this.emailId,
          password: this.password,
          productsList: this.productsList,
          address: this.address,
          contactNo: this.contactNo,
          firmName: this.firmName,
          isVerified: this.isVerified,
          roleId: this.roleId,
        });

        const [rows] = await db.execute(finalQuery, finalValues);
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    });
  }

  static findOne(emailId) {
    return db.execute("SELECT * FROM user_ WHERE email = ?", [emailId]);
  }
  static findByEmail(email) {
    return db.query(
      `
      SELECT u.*, r.name AS role
      FROM user_ u
      LEFT JOIN user_roles r ON u.role_id = r.id
      WHERE u.email = ?
    `,
      [email]
    );
  }

  static findByEmail(email) {
    return db.query(
      `
      SELECT u.*, r.name AS role
      FROM user_ u
      LEFT JOIN user_roles r ON u.role_id = r.id
      WHERE u.email = ?
    `,
      [email]
    );
  }
  static findByRole(email, roleId) {
    return db.query(
      `
      SELECT u.*, r.name AS role
      FROM user_ u
      LEFT JOIN user_roles r ON u.role_id = r.id
      WHERE u.email = ? AND u.role_id= ?
    `,
      [email, roleId]
    );
  }
  static async findRoleByEmail(email) {
    const [rows] = await db.execute(
      `SELECT role_id FROM user_ WHERE email = ? LIMIT 1`,
      [email]
    );
    return rows[0];
  }

  static findAll() {
    return db.execute("SELECT * FROM user_");
  }
  static checkUser(email, password) {
    return db.execute(`SELECT * FROM user_ WHERE email = ? AND password = ?`, [
      email,
      password,
    ]);
  }
  static changePassword(emailId, oldPassword, newPassword) {
    return db.execute(
      "UPDATE user_ SET password = ? WHERE email = ? AND password = ?",
      [newPassword, emailId, oldPassword]
    );
  }
  static changeResellerUserPassword(emailId, oldPassword, newPassword) {
    return db.execute(
      "UPDATE user_ SET password = ? WHERE email = ? AND password = ?",
      [newPassword, emailId, oldPassword]
    );
  }
  static forgetPassword(emailId, newPassword) {
    return db.execute("UPDATE user_ SET password = ? WHERE email = ? ", [
      newPassword,
      emailId,
    ]);
  }
  static forgetResellerUserPassword(emailId, newPassword) {
    return db.execute(
      "UPDATE reseller_user_info SET password = ? WHERE email = ? ",
      [newPassword, emailId]
    );
  }
  static logUserActivity(
    userType,
    userEmail,
    action,
    description,
    status,
    email = "",
    input = {}
  ) {
    return db.execute(
      `INSERT INTO user_activity_log (user_type, user_email, action, description, status,email,input, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        userType,
        userEmail,
        action,
        description,
        status,
        email,
        JSON.stringify(input),
      ]
    );
  }

  static async getProducts(emailId) {
    const existingProducts = await db.execute(
      "SELECT * FROM user_ WHERE email = ?",
      [emailId]
    );
    return existingProducts[0][0].products_list;
  }
  static async getResellerUserProducts(emailId) {
    const existingProducts = await db.execute(
      "SELECT * FROM reseller_user_info WHERE email = ?",
      [emailId]
    );
    return existingProducts[0][0].products_list;
  }

  static async addProduct(emailId, productsList) {
    return db.execute("UPDATE user_ SET products_list = ? WHERE email = ?", [
      JSON.stringify(productsList),
      emailId,
    ]);
  }
  static async addResellerProduct(emailId, productsList) {
    return db.execute(
      "UPDATE reseller_info SET products_list = ? WHERE email = ?",
      [JSON.stringify(productsList), emailId]
    );
  }
  static async addResellerUserProduct(emailId, productsList) {
    return db.execute(
      "UPDATE reseller_user_info SET products_list = ? WHERE email = ?",
      [JSON.stringify(productsList), emailId]
    );
  }
  // Users.js (Model)
  static async updateLastLoginForReseller(email) {
    const query = `
    UPDATE reseller_info
    SET last_login = NOW()
    WHERE email = ?
  `;
    return await db.query(query, [email]);
  }
  static async updateLastLoginForResellerUser(email) {
    const query = `
    UPDATE reseller_user_info
    SET last_login = NOW()
    WHERE email = ?
  `;
    return await db.query(query, [email]);
  }

  static async updateFirmInfo(emailId, firmName, firmAddress, contactNo) {
    let query = "UPDATE user_ SET";
    const params = [];
    const fields = [];

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
  static async updateResellerUserFirmInfo(
    emailId,
    firmName,
    firmAddress,
    contactNo
  ) {
    let query = "UPDATE reseller_user_info SET";
    const params = [];
    const fields = [];

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

  static async verifyOtp(emailId, otp) {
    console.log({ emailId, otp });
    const [rows] = await db.execute(
      "SELECT * FROM `cloud_enviro_otp` WHERE email = ?",
      [emailId]
    );

    if (!rows || rows.length === 0) {
      return { success: false, message: "OTP expired" };
    }

    const { expires_at, otp: existingOtp } = rows[0];

    const expiringTime = new Date(expires_at).getTime();
    const currentTime = Date.now();

    if (currentTime > expiringTime) {
      await db.execute("DELETE FROM `cloud_enviro_otp` WHERE `email` = ?", [
        emailId,
      ]);
      return { success: false, message: "OTP has expired." };
    }

    if (otp.toString() !== existingOtp.toString()) {
      return { success: false, message: "Invalid OTP." };
    }

    await db.execute("DELETE FROM `cloud_enviro_otp` WHERE `email` = ?", [
      emailId,
    ]);
    return { success: true, message: "OTP verified successfully." };
  }

  static async generateOtp(emailId) {
    const otp = randomInt(0, 10000).toString().padStart(4, "0");
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
    const emailExists = await db.execute(
      "SELECT * FROM `cloud_enviro_otp` WHERE email = ?",
      [emailId]
    );
    if (emailExists[0][0]) {
      const [response] = await db.execute(
        "UPDATE `cloud_enviro_otp` SET `expires_at`= ? , `otp`= ? WHERE email= ?",
        [expiresAt, otp, emailId]
      );

      if (response.affectedRows === 0) {
        return { success: false, msg: "Not Created" };
      }
      return { success: true, msg: "Created", otp: otp };
    } else {
      const [response] = await db.execute(
        "INSERT INTO `cloud_enviro_otp` (`_id`, `email`, `expires_at`, `otp`) VALUES (NULL, ?, ?, ?);",
        [emailId, expiresAt, otp]
      );

      if (response.affectedRows === 0) {
        return { success: false, msg: "Not Created" };
      }
      return { success: true, msg: "Created", otp: otp };
    }
  }

  static createResellerUser(
    email,
    password,
    firmName,
    contact,
    address,
    vendorId,
    deviceIds
  ) {
    if (deviceIds && Array.isArray(deviceIds) && deviceIds.length > 0) {
      const deviceIdsJson = JSON.stringify(deviceIds);
      return db.execute(
        `INSERT INTO reseller_user_info (email, password, firm_name, contact,address,vendor_id,products_list,created_at,last_login,access_status) VALUES (?, ?, ?, ?, ?, ?,?,NOW(),Now(),true)`,
        [email, password, firmName, contact, address, vendorId, deviceIdsJson]
      );
    }
  }
};
