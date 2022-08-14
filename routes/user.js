const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const jwt = require('jsonwebtoken');
const db = require('../database');
const checkAdmin = require('../middleware/check-admin');
const methods = require('../methods/methods');

const generateToken = (email, id, username, remainLoggedIn) => {
    return jwt.sign({
        email: email, id: id, username: username
    }, 'rednova-v2-token-this-is-to-ensure-you-are-safe-trade-well-my-friendly-peoples', { expiresIn: remainLoggedIn ? '7d' : '1h' });
}

/**
 * Logs in a user...
 */
router.get('/login', (req, res, next) => {

    // redo this for when it goes live.
    const email = req.body.email ? req.body.email : req.query.email ? req.query.email : 'alex.bunting@gmail.com';
    const password = req.body.password ? req.body.password : req.query.password ? req.query.password : 'pies';
    const remainLoggedIn = req.body.remainLoggedIn ? req.body.remainLoggedIn : req.query.remainLoggedIn ? req.query.remainLoggedIn : '7d';
    
    // hash the password to see what it matches in the db
    // get the user data to test if the password is true, and also get the admin details...
    db.query(`SELECT * FROM users WHERE email='${email}' ; SELECT COUNT(*) as cnt FROM users__admin WHERE email="${email}"`, (err, userDetails) => {
        if(userDetails[0].length !== 1 || err) {
            // return 401, issue logging them in
            res.status(401).json({ error: true, message: `There was an issue logging you in. Please check the credentials you supplied.` })
        } else {                
            // test the password
            bcrypt.compare(password, userDetails[0][0].password).then(correctPassword => {
                if(correctPassword) {
                    const userData = {
                        token: generateToken(userDetails[0][0].email, userDetails[0][0].id, userDetails[0][0].username, remainLoggedIn),
                        username: userDetails[0][0].username,
                        email: userDetails[0][0].email,
                        joined: userDetails[0][0].joined, 
                        admin: userDetails[1][0].cnt === 1
                    };

                    // successs
                    res.status(200).json({ error: false, message: '', data: { ...userData } })
                } else {        
                    // return 401, issue logging them in
                    res.status(200).json({ error: true, message: `There was an issue logging you in. Please check the credentials you supplied.` })
                }
            });
        }
    })
})

router.get('/getNavLog', (req, res, next) => {
    const galaxyId = req.query.galaxyId;
    const userData = methods.getUserDataFromToken(req);

    const sql = `   SELECT ships__logs.sectorid, GROUP_CONCAT(DISTINCT universe__planets.id SEPARATOR ',') as ids, GROUP_CONCAT(DISTINCT universe__planets.name SEPARATOR ',') as names
                    FROM ships__logs
                    LEFT JOIN universe__planets ON universe__planets.sectorid = ships__logs.sectorid
                    WHERE ships__logs.userid = ${userData.id} AND ships__logs.galaxyid = ${galaxyId}
                    GROUP BY ships__logs.sectorid`;

    db.query(sql, (e, result) => {
        if(!e) {
            let log = [];

            // build the planet array
            for(let i = 0 ; i < result.length ; i++) {
                let planets = [];

                if(result[i].ids !== null) {
                    const planetIds = result[i].ids.split(',');
                    const planetNames = result[i].names.split(',');

                    for(let o = 0 ; o < planetIds.length ; o++) {
                        planets.push({ id: planetIds[o], name: planetNames[o]});
                    }
                }
                // and push to the log
                log.push({ sectorid: result[i].sectorid, planets });
            }
            // return to user
            res.status(200).json({ error: false, message: '', data: { planetLog: log } })
        } else {
            res.status(400).json({ error: true, message: 'Error querying the database...', data: {}})
        }
    })
})

// basically works...
router.get('/checkAuth', checkAuth, (req, res, next) => {
    res.status(200).json({ error: false, message: '', data: { }})   
})

// check if the user is an admin
router.get('/checkAdmin', checkAdmin, (req, res, next) => {
    res.status(200).json({ error: false, message: '', data: { admin: true } })   
})

module.exports = router;

