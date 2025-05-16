// Create a MySQL connection pool
const mysql2 = require("mysql2");

const pool = mysql2.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "admin_dev",
  connectionLimit: 10,
});

pool.getConnection((err)=>{
  if(err){
    console.log("database error")
  } else{
    console.log("connected")
  }
})

// const pool = mysql2.createPool({
//   host: "172.26.0.15",
//   user: "dbmasteruser",
//   password: "`gxLPy*Gxl4xlfxtbMM(,O}%Ddas)Tpn",
//   database: "admin_dev",
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

module.exports = pool.promise();
