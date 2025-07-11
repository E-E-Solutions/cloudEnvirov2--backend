const db = require("../../db/connection");

class GWR {
  constructor(deviceId) {
    this.deviceId = deviceId;
  }

  getLatestData() {
    return new Promise(async (resolve, reject) => {
        try {
            // Query to get the latest row
            const latestRowQuery = "SELECT * FROM ?? ORDER BY id DESC LIMIT 1";

            // Fetch the latest row
            const latestRow = await db.query(latestRowQuery, [this.deviceId]);
            
            if (latestRow[0].length > 0) {
                const latestData = latestRow[0];
                console.log({latestData})
                const latestDate=new Date(latestData[0].date).toISOString().split("T")[0]

                console.log({latestDate})

                // Query to calculate the average for the 'read' column on the same day as the latest row
                const avgQuery = `
                    SELECT AVG(CAST(\`read\` AS DECIMAL(10,2))) AS water_level
                    FROM ??
                    WHERE DATE(date) = ?
                `;

                // Fetch the average for the day of the latest data point
                const avgResult = await db.query(avgQuery, [
                    this.deviceId,
                    latestDate,
                ]);

                // Combine latest data with average values
                const result = {
                    latestData,
                    dailyAverages: avgResult[0],
                };

                console.log({result})

                resolve(result);
            } else {
                resolve(null); // No data found
            }
        } catch (er) {
            console.log(er);
            reject(er);
        }
    });
}


  static getLastAvgDataByDays(deviceId, days, average) {
    return new Promise(async (resolve, reject) => {
      try {
        const latestRowQuery = "SELECT * FROM ?? ORDER BY id DESC LIMIT 1";

        // Fetch the latest row
        const latestRow = await db.query(latestRowQuery, [deviceId]);

        if (latestRow.length > 0) {
          const latestData = latestRow[0];
          console.log({ latestData });

          // Assuming the only float column is named 'read'
          const avgColumn = "AVG(CAST(read AS DECIMAL(10,2))) AS water_level";

          if (average.includes("min")) {
            average = +average.toString().split("_")[0];
            console.log({ average });

            const avgQuery = `
            SELECT 
                DATE(date) AS day, 
                DATE_FORMAT(CONCAT(date, ' ', time), '%Y-%m-%d %H:%i:00') AS time_interval, 
                ${avgColumn} 
            FROM ?? 
            WHERE CONCAT(date, ' ', time) >= NOW() - INTERVAL ? DAY 
            GROUP BY day, FLOOR(MINUTE(date) / ?), HOUR(time) 
            ORDER BY day, time_interval;
            `;

            // Fetch the averages for the day of the latest data point
            const avgResult = await db.query(avgQuery, [
              deviceId,
              days,
              average,
            ]);
            console.log({ avgValue: avgResult[0] });
            resolve({ avgData: avgResult[0] });
          } else if (average.includes("daily")) {
            const avgQuery = `SELECT DATE(date) AS day,  ${avgColumns} FROM ?? WHERE DATE(date) >= CURDATE() - INTERVAL ? DAY GROUP BY day ORDER BY day;`;
            // Fetch the averages for the day of the latest data point
            const avgResult = await db.query(avgQuery, [deviceId, days]);
            console.log({ avgValue: avgResult[0] });
            resolve({ avgData: avgResult[0] });
          } else if (average.includes("month")) {
            const avgQuery = `SELECT  DATE_FORMAT(date, '%Y-%m') AS month, ${avgColumns} FROM ?? WHERE Date(date) >= CURDATE() - INTERVAL ? DAY GROUP BY YEAR(date), MONTH(date) ORDER BY month;`;
            // Fetch the averages for the day of the latest data point
            const avgResult = await db.query(avgQuery, [deviceId, days]);
            console.log({ avgValue: avgResult[0] });
            resolve({ avgData: avgResult[0] });
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
        const latestRowQuery = "SELECT * FROM ?? ORDER BY id DESC LIMIT 1";

        // Fetch the latest row
        const latestRow = await db.query(latestRowQuery, [deviceId]);

        if (latestRow.length > 0) {
          const latestData = latestRow[0];

          // console.log({ latestData });

          // Dynamically construct the query to calculate averages for all numeric columns
          const tableInfoQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = ? AND DATA_TYPE = 'float'
              `;

          // Get the numeric columns
          const columns = await db.query(tableInfoQuery, [deviceId]);
          // console.log(columns[0]);
          // Assuming the only float column is named 'read'
          const avgColumns = "AVG(CAST(\`read\` AS DECIMAL(10,2))) AS water_level";

          // console.log(avgColumns);

          if (avgColumns) {
            if (duration.includes("day")) {
              duration = duration.split("_")[0];
              const avgQuery = `WITH last_date AS (
                        SELECT MAX(DATE(date)) AS max_date FROM ??
                    ) 
                    SELECT 
                        DATE_FORMAT(CONCAT(date, ' ', time), '%Y-%m-%d, %H:00') AS timeStamp, 
                        ${avgColumns} 
                    FROM ?? 
                    WHERE CONCAT(date, ' ', time) BETWEEN (
                        SELECT max_date - INTERVAL ? DAY FROM last_date
                    ) AND (
                        SELECT max_date + INTERVAL 1 DAY - INTERVAL 1 SECOND FROM last_date
                    ) 
                    GROUP BY timeStamp 
                    ORDER BY timeStamp;
                    `;
              // Fetch the averages for the day of the latest data point
              const avgResult = await db.query(avgQuery, [
                deviceId,
                deviceId,
                Number(duration) - 1,
              ]);
              // console.log({ avgValue: avgResult[0] });
              resolve({ data: avgResult[0] });
            } else if (duration.includes("month")) {
              duration = duration.split("_")[0];
              const avgQuery = `WITH last_date AS (
                    SELECT MAX(DATE(date)) AS max_date FROM ??
                ) 
                SELECT 
                    DATE_FORMAT(date, '%Y-%m-%d') AS timeStamp, 
                    ${avgColumns} 
                FROM ?? 
                WHERE DATE(date) BETWEEN (
                    SELECT max_date - INTERVAL ? MONTH FROM last_date
                ) AND (
                    SELECT max_date + INTERVAL 1 DAY - INTERVAL 1 SECOND FROM last_date
                ) 
                GROUP BY DATE_FORMAT(date, '%Y-%m-%d') 
                ORDER BY timeStamp;
                `;
              // Fetch the averages for the day of the latest data point
              const avgResult = await db.query(avgQuery, [
                deviceId,
                deviceId,
                duration,
              ]);
              // console.log({ avgValue: avgResult[0] });
              resolve({ data: avgResult[0] });
            }
          } else {
            // No numeric columns found, return just the latest row
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

  static getLastAvgDataByCustomDuration(deviceId, from, to, average) {
    return new Promise(async (resolve, reject) => {
        try {
            const latestRowQuery = "SELECT * FROM ?? ORDER BY id DESC LIMIT 1";

            // Fetch the latest row
            const latestRow = await db.query(latestRowQuery, [deviceId]);

            if (latestRow.length > 0) {
                const latestData = latestRow[0];
                  const toDate = new Date(to);
                  toDate.setDate(toDate.getDate() + 1);
                  const toPlusOne = toDate.toISOString().slice(0, 19).replace('T', ' '); // format 'YYYY-MM-DD HH:mm:ss'

                if (average === "no_average") {
                    const query = `SELECT * FROM ?? WHERE CONCAT(date, ' ', time) BETWEEN ? AND ? ORDER BY CONCAT(date, ' ', time);`;
                    // Fetch the data between the specified range
                    const data = await db.query(query, [
                        deviceId,
                        from,
                        toPlusOne
                    ]);
                    
                    resolve({ data:data[0] });
                }

                const avgColumns = "AVG(CAST(\`read\` AS DECIMAL(10,2))) AS water_level";

                if (avgColumns) {
                    if (average.includes("hourly")) {
                        const avgQuery = `
                            SELECT DATE_FORMAT(CONCAT(date, ' ', time), '%Y-%m-%d, %H:00') AS timeStamp, ${avgColumns} 
                            FROM ?? 
                            WHERE CONCAT(date, ' ', time) BETWEEN ? AND ? 
                            GROUP BY timeStamp 
                            ORDER BY timeStamp;
                        `;
                        const avgResult = await db.query(avgQuery, [
                            deviceId,
                            from,
                            toPlusOne
                        ]);
                        resolve({ data: avgResult[0] });
                    } else if (average.includes("daily")) {
                        const avgQuery = `
                            SELECT DATE_FORMAT(date, '%Y-%m-%d') AS timeStamp, ${avgColumns} 
                            FROM ?? 
                            WHERE CONCAT(date, ' ', time) BETWEEN ? AND ? 
                            GROUP BY DATE_FORMAT(date, '%Y-%m-%d') 
                            ORDER BY timeStamp;
                        `;
                        const avgResult = await db.query(avgQuery, [
                            deviceId,
                            from,
                            toPlusOne
                        ]);
                        resolve({ data: avgResult[0] });
                    }
                } else {
                    // No numeric columns found, return just the latest row
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
          `SELECT 
                DATE(date) AS date, 
                COUNT(*) AS data_points 
            FROM ?? 
            WHERE YEAR(date) = ? 
            GROUP BY DATE(date) 
            ORDER BY date;
            `,
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
          `SELECT 
                MAX(daily_data_points) AS max_data_points 
            FROM (
                SELECT 
                    DATE(date) AS date, 
                    COUNT(*) AS daily_data_points 
                FROM ?? 
                WHERE YEAR(date) = ? 
                GROUP BY DATE(date)
            ) AS daily_counts;
            `,
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
          "SELECT DISTINCT YEAR(date) AS year FROM ?? ORDER BY year",
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

module.exports = GWR;
