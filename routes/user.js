const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const db = require('../environment');

const generateToken = (email, id, remainLoggedIn) => {
    return jwt.sign({
        email: email, id: id, 
    }, 'rednova-v2-token-this-is-to-ensure-you-are-safe-trade-well-my-friendly-peoples', { expiresIn: remainLoggedIn ? '7d' : '1h' });
}

/**
 * Logs in a user...
 */
router.get('/login', (req, res, next) => {
    const connection = mysql.createConnection(db);

    // redo this for when it goes live.
    const email = req.body.email ? req.body.email : req.query.email ? req.query.email : 'alex.bunting@gmail.com';
    const password = req.body.password ? req.body.password : req.query.password ? req.query.password : 'pies';
    const remainLoggedIn = req.body.remainLoggedIn ? req.body.remainLoggedIn : req.query.remainLoggedIn ? req.query.remainLoggedIn : '7d';
    
    // hash the password to see what it matches in the db
    connection.connect((error) => {
        if(error) throw error;

        connection.query(`SELECT * FROM users WHERE email='${email}'`, (err, userDetails) => {

            connection.destroy();
            if(userDetails.length !== 1 || err) {
                // return 401, issue logging them in
                res.status(401).json({ error: true, message: `There was an issue logging you in. Please check the credentials you supplied.` })
            } else {                
                // test the password
                bcrypt.compare(password, userDetails[0].password).then(correctPassword => {
                    if(correctPassword) {
                        console.log(`Logged in ${email}`);
                        // successs
                        res.status(200).json({
                            error: false,
                            message: '',
                            data: {
                                token: generateToken(userDetails[0].username, userDetails[0].email, remainLoggedIn),
                                username: userDetails[0].username,
                                email: userDetails[0].email,
                                joined: userDetails[0].joined
                            }
                        })
        
                    } else {        
                        // return 401, issue logging them in
                        res.status(401).json({ error: true, message: `There was an issue logging you in. Please check the credentials you supplied.` })
                    }
                });
            }
        })

    })

})

// basically works...
router.get('/checkAuth', (req, res, next) => {

    try {
        const token = req.headers.authorization.split(" ")[1];

        jwt.verify(token, 'rednova-v2-token-this-is-to-ensure-you-are-safe-trade-well-my-friendly-peoples');
        res.status(200).json({
            error: false, 
            message: '', 
            data: {}
        })   

    } catch(error) {
        res.status(401).json({
            error: true, 
            message: 'Non authenticated user', 
            data: {}
        })

    }

})

module.exports = router;

