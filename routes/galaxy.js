const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const mysql = require('mysql');
const db = require('../environment');
const methods = require('../methods/methods');

const Galaxy = require('../galaxy/galaxy.model');

router.get('/getPlayableGalaxyList', checkAuth, (req, res, next) => {
    getSql = "SELECT * FROM universe__galaxies WHERE startTime < NOW() AND endTime > NOW()";
    const connection = mysql.createConnection(db);

    connection.query(getSql, (e, result) => {
        connection.destroy();

        if(result.length > 0) {
            const data = result.map(({depth, height, width, endTime, startPosition, ...returnData}) => { return returnData; });
            res.status(200).json({ error: false, data: data, message: '' })
        } else {
            res.status(200).json({ error: false, data: {}, message: 'No galaxies are current being played' }) 
        }
    })    
})

router.post('/joinGalaxy', checkAuth, (req, res, next) => {
    const galaxyId = req.body.galaxyId;
    const connection = mysql.createConnection(db);
    const galaxyQuery = `SELECT id, name, startPosition FROM universe__galaxies WHERE id=${galaxyId} AND startTime < NOW() AND endTime > NOW()`;

    connection.connect(connectionError => {
        connection.query(galaxyQuery, (e, result) => {
            // only one result should be present, otherwise it couldnt be found or there is an error...
            if(result.length === 1 && !e) {

                const userid = 0;
                const sectorId = 0;
                const insertQuery = `INSERT INTO ships__users (userid, galaxyid, sector) VALUES (${userid}, ${galaxyId}, ${sectorId})`;

            } else {
                res.status(400).json({ error: true, message: `The galaxy could not be found or cannot be played`, data: {} })
            }
        })
    })

})

methods.exports = router;