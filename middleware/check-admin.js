// check sif a token is attached...
// validate token...
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const db = require('../environment');

// middleware simple returns a function...
module.exports = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const userInfo = jwt.decode(token);

        jwt.verify(token, 'rednova-v2-token-this-is-to-ensure-you-are-safe-trade-well-my-friendly-peoples');
        
        const query = `SELECT COUNT(*) AS cnt FROM users__admin WHERE username="${userInfo.id}" AND email="${userInfo.email}"`;
        const connection = mysql.createConnection(db);

        connection.connect(connectError => {
            connection.query(query, (e, result) => {
                connection.destroy();

                if(result[0].cnt > 0) {
                    next(); // user is an admin
                } else {
                    res.status(401).json({ error: true, data: {}, message: `Authentication Failed - You are not an administrator` })
                }
            })
        })
    } catch (error) {
        res.status(401).json({ error: true, data: {}, message: `Authentication Failed - You are not an administrator: ${error}` })
    }
}
