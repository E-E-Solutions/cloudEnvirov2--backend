const db = require("../../db/connection");

class FLM {
  constructor(deviceId) {
    this.deviceId = deviceId;
  }

  getLatestData() {
    return new Promise(async (resolve, reject) => {
      try {
        const totalizerColumn = "cumm";

        // Query to get the latest row    
      const latestRowQuery = `
    WITH last_date AS (
        SELECT MAX(DATE(ts_server)) AS max_date FROM ??
    )
    SELECT 
        DATE_FORMAT(MAX(ts_server), '%Y-%m-%d %H:%i:%s') AS ts_server,
        MAX(??) AS final_totalizer,
        ROUND((MAX(??) - MIN(??)), 2) AS daily_flow,
        (SELECT _read 
         FROM ?? 
         WHERE DATE(ts_server) = (SELECT max_date FROM last_date) 
         ORDER BY ts_server DESC 
         LIMIT 1) AS flow
    FROM ??
    WHERE DATE(ts_server) = (SELECT max_date FROM last_date);
`;


        // Fetch the latest row
        const [latestRow] = await db.query(latestRowQuery, [
          this.deviceId,
          totalizerColumn,
          totalizerColumn,
          totalizerColumn,
          this.deviceId,
          this.deviceId 
        ]);

        // Check if latestRow is defined and has data
        if (!latestRow || latestRow.length === 0) {
          return resolve(null); // No data found for latest row
        }
        const latestData = latestRow[0];
        console.log("Latest Data:", latestData);

        // Query to calculate averages for numeric columns
        // const tableInfoQuery = `
        //     SELECT COLUMN_NAME
        //     FROM INFORMATION_SCHEMA.COLUMNS
        //     WHERE TABLE_NAME = ? AND DATA_TYPE = 'varchar'
        // `;

        // // Get the numeric columns
        // const [columns] = await db.query(tableInfoQuery, [this.deviceId]);

        // // Check if columns exist
        // if (!columns || columns.length === 0) {
        //     return resolve({ latestData, dailyAverages: {} }); // No numeric columns
        // }

        // const avgColumns = columns
        //     .map(
        //         (col) =>
        //             `AVG(CAST(${col.COLUMN_NAME} AS DECIMAL(10,2))) AS avg_${col.COLUMN_NAME}`
        //     )
        //     .join(", ");

        // // If there are numeric columns, calculate averages
        // if (avgColumns) {
        //     const avgQuery = `
        //         SELECT
        //             DATE_FORMAT(MAX(ts_server), '%Y-%m-%d') AS timeStamp,
        //             MAX(${totalizerColumn}) AS final_totalizer,
        //             ROUND((MAX(${totalizerColumn}) - MIN(${totalizerColumn})), 2) AS daily_flow,
        //             ${avgColumns}
        //         FROM ??
        //         WHERE DATE(ts_server) = DATE(?)
        //     `;

        //     // Fetch the averages for the day of the latest data point
        //     const [avgResult] = await db.query(avgQuery, [
        //         this.deviceId,
        //         latestData.ts_server,
        //     ]);

        //     // Check if avgResult has data
        //     if (!avgResult || avgResult.length === 0) {
        //         return resolve({ latestData, dailyAverages: {} }); // No averages found
        //     }

        // Combine latest data with average values
        const result = {
          latestData: [latestData],
          dailyAverages: {},
        };

        resolve(result);
        // } else {
        //     // No numeric columns found, return just the latest row
        //     resolve({ latestData, dailyAverages: {} });
        // }
      } catch (er) {
        console.error("Error in getLatestData:", er);
        reject(er);
      }
    });
  }

  static getLastAvgDataByDays(deviceId, days, average) {
    return new Promise(async (resolve, reject) => {
      try {
        const latestRowQuery = "SELECT * FROM ?? ORDER BY _id DESC LIMIT 1";

        // Fetch the latest row
        const latestRow = await db.query(latestRowQuery, [deviceId]);

        if (latestRow.length > 0) {
          const latestData = latestRow[0];

          console.log({ latestData });

          // Dynamically construct the query to calculate averages for all numeric columns
          const tableInfoQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = ? AND DATA_TYPE = 'varchar'
              `;

          // Get the numeric columns
          const columns = await db.query(tableInfoQuery, [deviceId]);
          console.log(columns[0]);
          const avgColumns = columns[0]
            .map(
              (col) =>
                `AVG(CAST(${col.COLUMN_NAME} AS DECIMAL(10,2))) AS ${col.COLUMN_NAME}`
            )
            .join(", ");

          console.log(avgColumns);

          if (avgColumns) {
            if (average.includes("min")) {
              average = +average.toString().split("_")[0];
              console.log({ average });
              const avgQuery = `SELECT DATE(ts_server) AS day, DATE_FORMAT(ts_server, '%Y-%m-%d %H:%i:00') AS time_interval, ${avgColumns} FROM ?? WHERE ts_server >= NOW() - INTERVAL ? DAY GROUP BY day, FLOOR(MINUTE(ts_server) / ?), HOUR(ts_server) ORDER BY day, time_interval;`;
              // Fetch the averages for the day of the latest data point
              const avgResult = await db.query(avgQuery, [
                deviceId,
                days,
                average,
              ]);
              console.log({ avgValue: avgResult[0] });
              resolve({ avgData: avgResult[0] });
            } else if (average.includes("daily")) {
              const avgQuery = `SELECT DATE(ts_server) AS day,  ${avgColumns} FROM ?? WHERE ts_server >= NOW() - INTERVAL ? DAY GROUP BY day ORDER BY day;`;
              // Fetch the averages for the day of the latest data point
              const avgResult = await db.query(avgQuery, [deviceId, days]);
              console.log({ avgValue: avgResult[0] });
              resolve({ avgData: avgResult[0] });
            } else if (average.includes("month")) {
              const avgQuery = `SELECT  DATE_FORMAT(ts_server, '%Y-%m') AS month, ${avgColumns} FROM ?? WHERE ts_server >= NOW() - INTERVAL ? DAY GROUP BY year(ts_server), month(ts_server) ORDER BY month;`;
              // Fetch the averages for the day of the latest data point
              const avgResult = await db.query(avgQuery, [deviceId, days]);
              console.log({ avgValue: avgResult[0] });
              resolve({ avgData: avgResult[0] });
            }
          } else {
            // No numeric columns found, return just the latest row
            resolve({ avgData: {} });
          }
        } else {
          resolve(null); // No data found
        }
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }

 static getLastDataByDuration(deviceId, duration) {
  return new Promise(async (resolve, reject) => {
    try {
      const latestRowQuery = "SELECT * FROM ?? ORDER BY _id DESC LIMIT 1";
      const latestRow = await db.query(latestRowQuery, [deviceId]);

      if (latestRow.length > 0) {
        const totalizerColumn = "cumm";
        const intervalUnit = duration.includes("month") ? "MONTH" : "DAY";
        const groupByFormat = "%Y-%m-%d"; // Keep grouping by day in both cases
        const periodValue = Number(duration.split("_")[0]);

        const avgQuery = `
          WITH latest_date AS (
            SELECT MAX(DATE(ts_server)) AS max_date FROM ??
          ),
          daily_data AS (
            SELECT  
              DATE(ts_server) AS day,
              DATE_FORMAT(ts_server, '${groupByFormat}') AS timeStamp,
              MIN(${totalizerColumn}) AS initial_totalizer,
              MAX(${totalizerColumn}) AS final_totalizer,
              ROUND((MAX(${totalizerColumn}) - MIN(${totalizerColumn})), 2) AS daily_flow
            FROM ??
            WHERE ts_server BETWEEN 
              (SELECT max_date - INTERVAL ? ${intervalUnit} FROM latest_date) AND 
              (SELECT max_date + INTERVAL 1 DAY - INTERVAL 1 SECOND FROM latest_date)
            GROUP BY day
          ),
          flow_data AS (
            SELECT 
              DATE(ts_server) AS day,
              _read AS flow
            FROM ??
            WHERE _id IN (
              SELECT MAX(_id)
              FROM ??
              WHERE ts_server BETWEEN 
                (SELECT max_date - INTERVAL ? ${intervalUnit} FROM latest_date) AND 
                (SELECT max_date + INTERVAL 1 DAY - INTERVAL 1 SECOND FROM latest_date)
              GROUP BY DATE(ts_server)
            )
          )
          SELECT 
            d.timeStamp,
            d.initial_totalizer,
            d.final_totalizer,
            d.daily_flow,
            f.flow
          FROM daily_data d
          LEFT JOIN flow_data f ON d.day = f.day
          ORDER BY d.timeStamp;
        `;

        const avgResult = await db.query(avgQuery, [
          deviceId, // for latest_date
          deviceId, // for daily_data
          periodValue,
          deviceId, // for flow_data
          deviceId, // for subquery in flow_data
          periodValue,
        ]);

        resolve({ data: avgResult[0] });
      } else {
        resolve(null);
      }
    } catch (er) {
      console.error("Query Error:", er);
      reject(er);
    }
  });
}

  static getLastAvgDataByCustomDuration(deviceId, from, to, average) {
  return new Promise(async (resolve, reject) => {
    try {
      const latestRowQuery = "SELECT * FROM ?? ORDER BY _id DESC LIMIT 1";
      const latestRow = await db.query(latestRowQuery, [deviceId]);

      if (latestRow.length > 0) {
        const totalizerColumn = "cumm";

        if (average === "daily") {
          const query = `
            SELECT 
              DATE(ts_server) AS timeStamp,
              MIN(${totalizerColumn}) AS initial_totalizer,
              MAX(${totalizerColumn}) AS final_totalizer,
              ROUND((MAX(${totalizerColumn}) - MIN(${totalizerColumn})), 2) AS daily_flow,
              (
                SELECT _read
                FROM ?? sub
                WHERE DATE(sub.ts_server) = DATE(main.ts_server)
                ORDER BY sub.ts_server DESC
                LIMIT 1
              ) AS flow
            FROM ?? main
            WHERE ts_server BETWEEN ? AND ?
            GROUP BY DATE(ts_server)
            ORDER BY timeStamp;
          `;

          const dailyResult = await db.query(query, [deviceId, deviceId, from, to]);
          resolve({ data: dailyResult[0] });

        } else if (average === "monthly") {
          const query = `
            SELECT 
              DATE_FORMAT(ts_server, '%Y-%m') AS timeStamp,
              MIN(${totalizerColumn}) AS initial_totalizer,
              MAX(${totalizerColumn}) AS final_totalizer,
              ROUND((MAX(${totalizerColumn}) - MIN(${totalizerColumn})), 2) AS monthly_flow,
              (
                SELECT _read
                FROM ?? sub
                WHERE DATE_FORMAT(sub.ts_server, '%Y-%m') = DATE_FORMAT(main.ts_server, '%Y-%m')
                ORDER BY sub.ts_server DESC
                LIMIT 1
              ) AS flow
            FROM ?? main
            WHERE ts_server BETWEEN ? AND ?
            GROUP BY DATE_FORMAT(ts_server, '%Y-%m')
            ORDER BY timeStamp;
          `;

          const monthlyResult = await db.query(query, [deviceId, deviceId, from, to]);
          resolve({ data: monthlyResult[0] });

              } else {
                resolve({ data: {} });
              }
            } else {
              resolve(null); // No data found
            }
          } catch (er) {
            console.log(er);
            reject(er);
          }
        });
      }


  static getDataPoints(deviceId, year) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          "SELECT DATE(ts_server) AS date, COUNT(*) AS data_points FROM ?? WHERE YEAR(ts_server) = ? GROUP BY DATE(ts_server) ORDER BY date",
          [deviceId, year]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
  static getMaxDataPointValue(deviceId, year) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          "SELECT MAX(daily_data_points) AS max_data_points FROM (SELECT DATE(ts_server) AS date, COUNT(*) AS daily_data_points FROM ?? WHERE YEAR(ts_server) = ? GROUP BY DATE(ts_server)) AS daily_counts",
          [deviceId, year]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
  static getDataAvailabilityYears(deviceId) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          "SELECT DISTINCT YEAR(ts_server) AS year FROM ?? ORDER BY year",
          [deviceId]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }

  static getDataPoints(deviceId, year) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          "SELECT DATE(ts_server) AS date, COUNT(*) AS data_points FROM ?? WHERE YEAR(ts_server) = ? GROUP BY DATE(ts_server) ORDER BY date",
          [deviceId, year]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
  static getMaxDataPointValue(deviceId, year) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          "SELECT MAX(daily_data_points) AS max_data_points FROM (SELECT DATE(ts_server) AS date, COUNT(*) AS daily_data_points FROM ?? WHERE YEAR(ts_server) = ? GROUP BY DATE(ts_server)) AS daily_counts",
          [deviceId, year]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
  static getDataAvailabilityYears(deviceId) {
    return new Promise((resolve, reject) => {
      try {
        const row = db.query(
          "SELECT DISTINCT YEAR(ts_server) AS year FROM ?? ORDER BY year",
          [deviceId]
        );
        resolve(row);
      } catch (er) {
        console.log(er);
        reject(er);
      }
    });
  }
}

module.exports = FLM;
