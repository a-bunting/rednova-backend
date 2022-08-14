const mysql = require('mysql');

// const mysqlConnectionData = {
//     host: 'sql134.main-hosting.eu', 
//     user: 'u656701484_rednovaadmin',
//     password: 'r3dN0V4**!',
//     database: 'u656701484_rednova'
// };

const mysqlPool = mysql.createPool({
    connectionLimit: 1, 
    host: 'sql134.main-hosting.eu', 
    user: 'u656701484_rednovaadmin',
    password: 'r3dN0V4**!',
    database: 'u656701484_rednova', 
    multipleStatements: true
})

// module.exports = mysqlConnectionData;
module.exports = mysqlPool;