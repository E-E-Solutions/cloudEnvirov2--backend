const db = require("./connection");

module.exports = class Users {
  constructor(name, password, emailId) {
    this.emailId = emailId;
    this.password = password;
    this.name = name;
  }

  // Method to save user details in the database
  save() {
    return new Promise(async (resolve, reject) => {
      try {
        const [rows] = await db.execute("INSERT INTO user_ (email, password, name ) VALUES (?, ?, ?)", [this.emailId, this.password, this.name]);
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
};
