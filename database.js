const mysql = require('mysql');

const mysqlPool = mysql.createPool({
  host: process.env.DB_SERVER,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 1,
  multipleStatements: true
})

module.exports = mysqlPool;
