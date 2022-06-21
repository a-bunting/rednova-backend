const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const mysql = require('mysql');
const db = require('../environment');
const methods = require('../methods/methods');

const Galaxy = require('../galaxy/galaxy.model');

router.get('/getPlayableGalaxyList', (req, res, next) => {
    getSql = "SELECT * FROM universe__galaxies WHERE startTime < NOW() AND endTime > NOW()";
    const connection = mysql.createConnection(db);
    const userData = methods.getUserDataFromToken(req);

    connection.query(getSql, (e, result) => {
        
        if(result.length > 0) {

            const userGalaxiesQuery = `SELECT galaxyid FROM users__galaxies WHERE userid=${userData.id}`;

            connection.query(userGalaxiesQuery, (e, userQueryResult) => {
                connection.destroy();
                
                // collate the data...
                const data = result.map(({depth, height, width, endTime, startPosition, ...returnData }) => { return { ...returnData, member: false }; });

                for(let i = 0 ; i < data.length ; i++) {
                    for(let o = 0 ; o < userQueryResult.length ; o++) {
                        if(data[i].id === userQueryResult[o].galaxyid) {
                            data[i].member = true;
                        }
                    }
                }
                // and return that data...
                res.status(200).json({ error: false, data: { galaxyList: data }, message: '' })
            })
        } else {
            // else no playable galaxies as of yet
            connection.destroy();
            res.status(200).json({ error: false, data: {}, message: 'No galaxies are current being played' }) 
        }
        
    })    
});

router.post('/joinGalaxy', checkAuth, (req, res, next) => {
    const galaxyId = req.body.galaxyId;
    const connection = mysql.createConnection({...db, multipleStatements: true});
    const userData = methods.getUserDataFromToken(req);
    const galaxyQuery = `SELECT name, startPosition FROM universe__galaxies WHERE id=${galaxyId} AND startTime < NOW() AND endTime > NOW() ; SELECT COUNT(*) AS cnt FROM users__galaxies WHERE galaxyid=${galaxyId} AND userid=${userData.id}`;

    connection.connect(connectionError => {
        connection.query(galaxyQuery, (e, result) => {
            if(e) console.log(e);
            // only one result should be present, otherwise it couldnt be found or there is an error...
            if(result[0].length === 1 && result[1][0].cnt === 0 && !e) {

                const userid = userData.id;
                const sectorId = result[0][0].startPosition;
                const insertQuery = `INSERT INTO ships__users (userid, galaxyid, sector) VALUES (${userid}, ${galaxyId}, ${sectorId})`;

                connection.query(insertQuery, (e, insertResult) => {
                    if(!e) {
                        // finally add ot the galaxy database...
                        const galaxyQuery = `INSERT INTO users__galaxies (userid, galaxyid, shipid) VALUES (${userData.id}, ${galaxyId}, ${insertResult.insertId})`;

                        connection.query(galaxyQuery, (e, r) => {
                            connection.destroy();
                            
                            if(!e) {
                                res.status(200).json({ error: false, message: '', data: { galaxyId: galaxyId, startPosition: sectorId } })
                            } else {
                                res.status(400).json({ error: true, message: `Error joining galaxy: ${e}`, data: {}});
                            }

                        })

                    } else {
                        connection.destroy();
                        res.status(400).json({ error: true, message: `Error: ${e}`, data: {} })
                    }
                })

            } else {
                connection.destroy();
                res.status(400).json({ error: true, message: `The galaxy could not be found or cannot be played`, data: {} })
            }
        })
    })

});

router.get('/getUserGalaxyData', checkAuth, (req, res, next) => {
    const galaxyId = req.query.galaxyId;
    const userData = methods.getUserDataFromToken(req);
    const checkUserExistsInGalaxyQuery = `SELECT * FROM ships__users WHERE galaxyid=${galaxyId} AND userid=${userData.id}`;

    const connection = mysql.createConnection({...db, multipleStatements: true});
    
    connection.connect(connectionError => {
        connection.query(checkUserExistsInGalaxyQuery, (e, result) => {
            if(e) console.log(`Error: ${e}`);

            if(result.length === 1) {
                // one result exists for this user and so they exist in the galaxy with this ship
                const shipId = result[0].shipid;
                const sector = result[0].sector;
                
                // now get the galaxy data for the current sector..
                const sectorQuery = `   SELECT * FROM universe__systems WHERE id=${sector} ; 
                                        SELECT * FROM universe__planets WHERE systemid=${sector} AND galaxyid=${galaxyId} ; 
                                        SELECT * FROM universe__warp WHERE sectorA=${sector} OR sectorB=${sector} AND galaxyId=${galaxyId}`;

                connection.query(sectorQuery, (e, galaxyResult) => {
                    if(e) console.log(`Error: ${e}`)
                    connection.destroy();

                    // const data = result.map(({depth, height, width, endTime, startPosition, ...returnData }) => { return { ...returnData, member: false }; });


                    const galaxy = galaxyResult[0].map(({ id, galaxyid, ...data}) => { return { ...data }})[0];
                    const ship = result.map(({ id, galaxyid, userid, ...data}) => { return { ...data }})[0];

                    const data = {
                        ship: { ...ship }, 
                        system: {
                            ...galaxy,
                            sectorId: sector,
                            planets: [
                                ...galaxyResult[1].map(({ id, systemid, galaxyid, ...data}) => { return { ...data }})
                            ],
                            warp: [
                                ...galaxyResult[2].map(({ id, galaxyId, sectorA, sectorB, ...data}) => { return { ...data, destination: sectorA === sector ? sectorB : sectorA  }})
                            ]
                        }
                    }

                    res.status(200).json({ error: false, message: '', data: data });
                })
            }
        })
    })
})

module.exports = router;