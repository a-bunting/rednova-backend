// check sif a token is attached...
// validate token...
const jwt = require('jsonwebtoken');
const db = require('../database');

// middleware simple returns a function...
module.exports = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const userInfo = jwt.decode(token);

        jwt.verify(token, process.env.SALT);
       
        const query = `SELECT COUNT(*) AS cnt FROM users__admin WHERE username="${userInfo.id}" AND email="${userInfo.email}"`;

        db.query(query, (e, result) => {
            if(result[0].cnt > 0) {
                next(); // user is an admin
            } else {
                res.status(200).json({ error: true, data: {}, message: `Authentication Failed - You are not an administrator` })
            }
        })
    } catch (error) {
        res.status(200).json({ error: true, data: {}, message: `Authentication Failed - You are not an administrator: ${error}` })
    }
}