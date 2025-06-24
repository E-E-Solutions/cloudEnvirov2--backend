const db = require("../../db/connection");

class ENE {
  constructor(deviceId) {
    this.deviceId = deviceId;
  }

  getLatestData() {
    return new Promise(async (resolve, reject) => {
      try {
        // Query to get the latest row
        const latestRowQuery = "SELECT * FROM ?? ORDER BY _id DESC LIMIT 1";

        // Fetch the latest row
        const latestRow = await db.query(latestRowQuery, [this.deviceId]);

        console.log({latestRow, deviceId:this.deviceId})


        if (latestRow[0].length > 0) {
          const latestData = latestRow[0];

          // console.log({ latestData });

          // Dynamically construct the query to calculate averages for all numeric columns
          const tableInfoQuery = `
                  SELECT COLUMN_NAME 
                  FROM INFORMATION_SCHEMA.COLUMNS 
                  WHERE TABLE_NAME = ? AND DATA_TYPE = 'varchar'
                `;

          // Get the numeric columns
          const columns = await db.query(tableInfoQuery, [this.deviceId]);
          // console.log(columns[0]);
          const avgColumns = columns[0]
            .map(
              (col) =>
                `AVG(CAST(${col.COLUMN_NAME} AS DECIMAL(10,2))) AS ${col.COLUMN_NAME}`
            )
            .join(", ");

          // console.log(avgColumns);
          // If there are numeric columns, calculate averages
          if (avgColumns) {
            const avgQuery = `
                    SELECT ${avgColumns}
                    FROM ??
                    WHERE DATE(ts_server) = DATE(?)
                  `;

            // console.log({ avgQuery });

            // Fetch the averages for the day of the latest data point
            const avgResult = await db.query(avgQuery, [
              this.deviceId,
              latestData[0].ts_server,
            ]);

            // console.log({ avgValue: avgResult[0] });

            // Combine latest data with average values
            const result = {
              latestData,
              dailyAverages: avgResult[0],
            };

            // console.log(result);

            resolve(result);
          } else {
            // No numeric columns found, return just the latest row
            resolve({ latestData, dailyAverages: {} });
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

        // Fetch the latest row
        const latestRow = await db.query(latestRowQuery, [deviceId]);

        if (latestRow.length > 0) {
          const latestData = latestRow[0];

          // console.log({ latestData });

          // Dynamically construct the query to calculate averages for all numeric columns
          const tableInfoQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = ? AND DATA_TYPE = 'varchar'
              `;

          // Get the numeric columns
          const columns = await db.query(tableInfoQuery, [deviceId]);
          // console.log(columns[0]);
          const avgColumns = columns[0]
            .map(
              (col) =>
                `AVG(CAST(${col.COLUMN_NAME} AS DECIMAL(10,2))) AS ${col.COLUMN_NAME}`
            )
            .join(", ");

          // console.log(avgColumns);

          if (avgColumns) {
            if (duration.includes("day")) {
              duration = duration.split("_")[0];
              const avgQuery = `WITH last_date AS (SELECT MAX(DATE(ts_server)) AS max_date FROM ??) SELECT DATE_FORMAT(ts_server, '%Y-%m-%d, %H:00') AS timeStamp, ${avgColumns} FROM ?? WHERE ts_server BETWEEN (SELECT max_date - INTERVAL ? DAY FROM last_date) AND (SELECT max_date + INTERVAL 1 DAY - INTERVAL 1 SECOND FROM last_date)  GROUP BY timeStamp ORDER BY timeStamp;`;
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
              const avgQuery = `WITH last_date AS (SELECT MAX(DATE(ts_server)) AS max_date FROM ??) SELECT DATE_FORMAT(ts_server, '%Y-%m-%d') AS timeStamp, ${avgColumns} FROM ?? WHERE ts_server BETWEEN (SELECT max_date - INTERVAL ? MONTH FROM last_date) AND (SELECT max_date + INTERVAL 1 DAY - INTERVAL 1 SECOND FROM last_date) GROUP BY DATE_FORMAT(ts_server, '%Y-%m-%d') ORDER BY timeStamp;`;
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
        const latestRowQuery = "SELECT * FROM ?? ORDER BY _id DESC LIMIT 1";

        // Fetch the latest row
        const latestRow = await db.query(latestRowQuery, [deviceId]);

        if (latestRow.length > 0) {
          const latestData = latestRow[0];

          if (average === "no_average") {
         // Get all column names except ts_server, ts_client, and _id
            const columnsQuery = `
              SELECT COLUMN_NAME 
              FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_NAME = ? 
                AND COLUMN_NAME NOT IN ('ts_server', 'ts_client', '_id')
            `;

            const columnResult = await db.query(columnsQuery, [deviceId]);

            // Build the SELECT list: timeStamp as the first column
            const selectedColumns = columnResult[0]
              .map((col) => `\`${col.COLUMN_NAME}\``)
              .join(", ");

            const query = `
              SELECT ts_client AS timeStamp${selectedColumns ? `, ${selectedColumns}` : ''} 
              FROM ?? 
              WHERE ts_server BETWEEN ? AND ? 
              ORDER BY ts_server;
            `;

          const data = await db.query(query, [deviceId, from, to]);

            // Format timeStamp before returning
            const formatDate = (d) => {
              const date = new Date(d);
              const pad = (n) => n.toString().padStart(2, "0");
              return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
            };

            const formattedData = data[0].map(row => ({
              ...row,
              timeStamp: formatDate(row.timeStamp)
            }));

            return resolve({ data: formattedData });
            // Fetch the averages for the day of the latest data point
           
          }

          // console.log({ latestData });

          // Dynamically construct the query to calculate averages for all numeric columns
          const tableInfoQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = ? AND DATA_TYPE = 'varchar'
              `;

          // Get the numeric columns
          const columns = await db.query(tableInfoQuery, [deviceId]);
          // console.log(columns[0]);
          const avgColumns = columns[0]
            .map(
              (col) =>
                `AVG(CAST(${col.COLUMN_NAME} AS DECIMAL(10,2))) AS ${col.COLUMN_NAME}`
            )
            .join(", ");

          // console.log(avgColumns);

          if (avgColumns) {
            if (average.includes("hourly")) {
              const avgQuery = `SELECT DATE_FORMAT(ts_server, '%Y-%m-%d, %H:00') AS timeStamp, ${avgColumns} FROM ?? WHERE ts_server BETWEEN ? AND ? GROUP BY timeStamp ORDER BY timeStamp;`;
              // Fetch the averages for the day of the latest data point
              const avgResult = await db.query(avgQuery, [deviceId, from, to]);
              // console.log({ avgValue: avgResult[0] });
              resolve({ data: avgResult[0] });
            } else if (average.includes("daily")) {
              const avgQuery = `SELECT DATE_FORMAT(ts_server, '%Y-%m-%d') AS timeStamp, ${avgColumns} FROM ?? WHERE ts_server BETWEEN ? AND ? GROUP BY DATE_FORMAT(ts_server, '%Y-%m-%d') ORDER BY timeStamp;`;
              // Fetch the averages for the day of the latest data point

              console.log(avgQuery);
              const avgResult = await db.query(avgQuery, [deviceId, from, to]);
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

module.exports = ENE;
