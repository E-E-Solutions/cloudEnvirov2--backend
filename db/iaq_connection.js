// Create a MySQL connection pool
const mysql2 = require("mysql2");

const pool = mysql2.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "db_iaq",
  connectionLimit: 10,
});

// const pool = mysql2.createPool({
//   host: "172.26.0.15",
//   user: "dbmasteruser",
//   password: "`gxLPy*Gxl4xlfxtbMM(,O}%Ddas)Tpn",
//   database: "db_iaq",
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

module.exports = pool.promise();
