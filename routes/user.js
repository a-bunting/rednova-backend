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
    }, process.env.SALT, { expiresIn: remainLoggedIn ? '7d' : '1h' });
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

    const sql = `   SELECT 
                        ships__logs.sectorid, GROUP_CONCAT(DISTINCT universe__planets.id SEPARATOR ',') as ids, GROUP_CONCAT(DISTINCT universe__planets.name SEPARATOR ',') as names, 
                        universe__systems.x, universe__systems.y, universe__systems.z, 
                        GROUP_CONCAT(DISTINCT universe__warp.sectorA SEPARATOR ',') as warpA, GROUP_CONCAT(DISTINCT universe__warp.sectorB SEPARATOR ',') as warpB
                    FROM ships__logs
                    LEFT JOIN universe__planets ON universe__planets.sectorid = ships__logs.sectorid
                    LEFT JOIN universe__systems ON universe__systems.sectorid = ships__logs.sectorid
                    LEFT JOIN universe__warp ON universe__warp.sectorA = ships__logs.sectorid OR universe__warp.sectorB = ships__logs.sectorid
                    WHERE ships__logs.userid = ${userData.id} AND ships__logs.galaxyid = ${galaxyId}
                    GROUP BY ships__logs.sectorid`;

    db.query(sql, (e, result) => {
        if(!e) {
            let log = [];

            // build the planet array
            for(let i = 0 ; i < result.length ; i++) {
                let planets = [];
                let warpRoutes = [];

                if(result[i].ids !== null) {
                    const planetIds = result[i].ids.split(',');
                    const planetNames = result[i].names.split(',');

                    for(let o = 0 ; o < planetIds.length ; o++) {
                        planets.push({ id: planetIds[o], name: planetNames[o]});
                    }
                }

                if(result[i].warpA !== null) {
                    warpRoutes = [...new Set(result[i].warpA.split(',').map(Number).concat(result[i].warpB.split(',').map(Number)))];
                }

                console.log(result[i].sectorid, warpRoutes);

                // and push to the log
                log.push({ sectorid: result[i].sectorid, planets, coordinates: { x: result[i].x, y: result[i].y, z: result[i].z }, warp: warpRoutes });
            }
            // return to user
            res.status(200).json({ error: false, message: '', data: { planetLog: log } })
        } else {
            res.status(400).json({ error: true, message: 'Error querying the database...', data: {}})
        }
    })
})

ipList = [];

router.post('/register', (req, res, next) => {
    const username = req.body['username'];
    const password = req.body['password'];
    const email = req.body['email'];

    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress 

    const ipListIndex = ipList.findIndex(a => a.ip === ip);

    if(username && password && email) {
        if(ipListIndex === -1) {
            // not created within 10 secs and username, password and email are all good...
            // accounttype of 1 is anonymous and 0 is normal
            const accountType = email.split('@')[1] === 'sn.org' ? 1 : 0;

            // bcrypt stuff
            const saltRounds = 10;
            
            bcrypt.hash(password, saltRounds, (err, hashPass) => {
                const query = `INSERT INTO users (email, password, username, accountType) VALUES ('${email}', '${hashPass}', '${username}', ${accountType})`;
    
                db.query(query, (e, result) => {
                    if(!e) {
                        // on success disallow this person from making a new account within 10 seconds...
                        const timeout = setTimeout(() => {
                            const ipListIndex = ipList.findIndex(a => a.ip === ip);
            
                            if(ipListIndex !== -1) {
                                clearInterval(ipList[ipListIndex])
                                ipList.splice(ipListIndex, 1);
                            }
                        }, 10000);
            
                        const newLoginBlock = { interval : timeout, ip: ip };
                        ipList.push(newLoginBlock);
            
                        res.status(200).json({ error: false, message: '', data: {}});
                    } else {
                        res.status(200).json({ error: true, message: 'There was an error inserting your data into the database.', data: {}})   
                    }
                })
            });


        } else {
            // user can only create a new anonymous account every 10 seconds max
            timeLeft = Math.ceil((ipList[ipListIndex].interval._idleStart + ipList[ipListIndex].interval._idleTimeout) / 1000);
            res.status(200).json({ error: true, message: 'A new user can only be created every 10 seconds.', data: { timeLeft }})   
        }
    } else {
        res.status(200).json({ error: true, message: 'Not all required data has been provided.', data: {}})   
    }

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

