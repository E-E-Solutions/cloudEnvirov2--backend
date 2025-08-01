const db = require("../db/connection");
module.exports = class SuperAdmin {
  static getAllParameters = () => {
    return new Promise((resolve, reject) => {
      try {
        const rows = db.query("SELECT * FROM parameters_info");
        resolve(rows);
      } catch (error) {
        console.error("Error fetching parameters:", error);
        reject(error);
      }
    });
  };
  static getTableStructure = (deviceId) => {
    return new Promise((resolve, reject) => {
      try {
        const rows = db.query(`SHOW COLUMNS FROM ${deviceId}`);
        resolve(rows);
      } catch (error) {
        console.error("Error fetching table structure:", error);
        reject(error);
      }
    });
  };

  static getExisting = async (deviceId)=> {
     return await db.execute(
        `SHOW COLUMNS FROM \`${deviceId}\``
      );
    }
  
  static setTableStructure = async (deviceId, columnName, type,size,after) => {
    try {
  
      const query = `ALTER TABLE \`${deviceId}\` ADD COLUMN \`${columnName}\` ${type.toUpperCase()}(${
              size
            }) AFTER \`${after}\``;
      const [result] = await db.query(query);
      return [result];
    } catch (error) {
      console.error("Error updating table structure:", error);
      throw error;
    }
  };
  static async checkColumns(deviceId, column) {
    try {
      const sql = `SELECT * FROM \`${deviceId}\` WHERE ${column}`;
      return db.execute(sql);
    } catch (error) {
      console.error("Error checking empty columns:", error);
      throw error;
    }
  }
static async changePositions(deviceId,col,type,after) {
  try {
    const [rows] = await db.execute(`ALTER TABLE ${deviceId} CHANGE ${col} ${col} ${type} AFTER ${after}`);
    return rows;
  } catch (error) {
    console.error("Error extracting column positions:", error);
    throw error;
  }
}


  static async DeleteTableColumns(deviceId, columns) {
    try {
     let result =[]
      for(const col of columns){
      const sql = `ALTER TABLE \`${deviceId}\` DROP COLUMN ${col}`;

      [result] = await db.query(sql);
      }
      return result;
    } catch (error) {
      console.error("Error updating table structure:", error);
      throw error;
    }
  }

  static async alterColumns(deviceId, columns) {
    try {
      const alterStatements = columns.map((col) => {
        const { columnName, newColumnName, type, size } = col;
        if (!columnName || !type || !size) {
          throw new Error(
            "Each column must include columnName, type, and size"
          );
        }

        const safeType = type.toUpperCase();
        const sizePart = ["VARCHAR", "CHAR", "INT", "DECIMAL"].includes(
          safeType
        )
          ? `(${size})`
          : "";
        if (newColumnName) {
          return `CHANGE ${columnName} \`${newColumnName}\` ${safeType}${sizePart}`;
        }
        return `MODIFY ${columnName} ${safeType}${sizePart}`;
      });

      const alterQuery = `ALTER TABLE \`${deviceId}\` ${alterStatements.join(
        ", "
      )}`;
      const [result] = await db.query(alterQuery);
      return result;
    } catch (error) {
      console.error("Error in alterColumnSize:", error);
      throw error;
    }
  }
};
