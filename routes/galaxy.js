const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const mysql = require('mysql');
const db = require('../environment');
const methods = require('../methods/methods');
const sectorFunctions = require('../methods/sector-functions');
const gameFunctions = require('../methods/game-functions');

const Galaxy = require('../galaxy/galaxy.model');
const { database } = require('../environment');
const { query } = require('express');
const { engine } = require('express/lib/application');

router.get('/getPlayableGalaxyList', (req, res, next) => {
    getSql = "SELECT *, TIMESTAMPDIFF(SECOND, startTime, CURRENT_TIMESTAMP()) AS tDiff FROM universe__galaxies WHERE startTime < NOW() AND endTime > NOW()";
    const connection = mysql.createConnection(db);
    const userData = methods.getUserDataFromToken(req);

    connection.query(getSql, (e, data) => {
        
        if(data.length > 0) {

            const userGalaxiesQuery = `SELECT galaxyid, dateJoined, turnsUsed, points, TIMESTAMPDIFF(SECOND, dateJoined, CURRENT_TIMESTAMP()) AS tDiff FROM users__galaxies WHERE userid=${userData.id}`;

            connection.query(userGalaxiesQuery, (e, userQueryResult) => {
                connection.destroy();
                
                // collate the data...
                // const data = result.map(({depth, height, width, endTime, startPosition, ...returnData }) => { return { ...returnData, member: false, points: 0, turns: 0 }; });

                for(let i = 0 ; i < data.length ; i++) {
                    
                    data[i] = { ...data[i], member: false, points: 0, turns: 0 };

                    for(let o = 0 ; o < userQueryResult.length ; o++) {
                        if(data[i].id === userQueryResult[o].galaxyid) {
                            data[i].member = true;
                            data[i].points = userQueryResult[o].points;
                            data[i].turns = (Math.floor(userQueryResult[o].tDiff / data[i].tickPeriod) - userQueryResult[o].turnsUsed) + data[i].startTurns;
                        }
                    }
                }

                // then strip out the rest of the un needed data
                const returnData = data.map(({ depth, height, width, endTime, startPosition, tDiff, startTurns, ...returnData }) => { return { ...returnData }; });

                // and return that data...
                res.status(200).json({ error: false, data: { galaxyList: returnData }, message: '' })
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
                const insertQuery = `INSERT INTO ships__users (userid, galaxyid, sector, money) VALUES (${userid}, ${galaxyId}, ${sectorId}, 9999999999)`;

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

    if(!req.query.galaxyId) {
        res.status(400).json({ error: true, message: 'GalaxyId or User Data incorrect', data: {}});
    }

    const connection = mysql.createConnection({...db, multipleStatements: true});    
    const checkUserExistsInGalaxyQuery = `SELECT * FROM ships__users WHERE galaxyid=${galaxyId} AND userid=${userData.id}`;
    
    connection.connect(connectionError => {
        connection.query(checkUserExistsInGalaxyQuery, (e, result) => {
            if(e) console.log(`Error: ${e}`);

            if(result.length === 1) {
                // one result exists for this user and so they exist in the galaxy with this ship
                const shipId = result[0].shipid;
                const sector = result[0].sector;

                // now get the galaxy data for the current sector..
                const sectorQuery = `   SELECT * FROM universe__systems WHERE sectorid=${sector} ; 
                                        SELECT universe__planets.*, users.username AS ownerName FROM universe__planets LEFT JOIN users ON universe__planets.owner = users.id WHERE sectorid=${sector} AND galaxyid=${galaxyId} ; 
                                        SELECT * FROM universe__warp WHERE sectorA=${sector} OR sectorB=${sector} AND galaxyId=${galaxyId} ; 
                                        SELECT tickPeriod, UNIX_TIMESTAMP(startTime) as startTime, startTurns, TIMESTAMPDIFF(SECOND, startTime, CURRENT_TIMESTAMP()) AS tDiff, sectors, startPosition FROM universe__galaxies WHERE id=${galaxyId} ;
                                        SELECT dateJoined, turnsUsed, TIMESTAMPDIFF(SECOND, dateJoined, CURRENT_TIMESTAMP()) AS tDiff FROM users__galaxies WHERE userid=${userData.id} AND galaxyid=${galaxyId} ;
                                        SELECT ships__users.userid, users.username FROM ships__users LEFT JOIN users ON users.id = ships__users.userid WHERE ships__users.sector=${sector} AND ships__users.galaxyid=${galaxyId}`;

                connection.query(sectorQuery, (e, galaxyResult) => {
                    if(e) console.log(`Error: ${e}`)
                    connection.destroy();

                    // const turnsAvailable = calculateAvailableTurns(galaxyResult[3][0].tickPeriod, galaxyResult[3][0].startTurns, galaxyResult[4][0].tDiff, galaxyResult[4][0].turnsUsed);
                    const server = req.game.getServer(galaxyId);
                    const turnsAvailable = gameFunctions.getUserTurns(server, galaxyResult[4][0].tDiff, galaxyResult[4][0].turnsUsed);

                    const galaxy = galaxyResult[0].map(({ id, galaxyid, ...data}) => { return { ...data }})[0];
                    const ship = result.map(({ galaxyid, userid, ...data}) => { return { ...data }})[0];

                    const data = {
                        server: { 
                            nextTurn: galaxyResult[3][0].tickPeriod - (galaxyResult[3][0].tDiff % galaxyResult[3][0].tickPeriod),
                            tickDuration: galaxyResult[3][0].tickPeriod,
                            startSector: galaxyResult[3][0].startPosition, 
                            sectors: galaxyResult[3][0].sectors
                        },
                        ship: { ...ship }, 
                        user: {
                            turns: turnsAvailable
                        },
                        system: {
                            ...galaxy,
                            ships: [
                                ...galaxyResult[5]
                            ],
                            planets: [
                                ...galaxyResult[1].map(({ systemid, sectorid, galaxyid, owner, population, solarRadiation, onPlanet, currency, fields, ...data}) => { return { ...data }})
                            ],
                            warp: [
                                ...galaxyResult[2].map(({ id, galaxyId, sectorA, sectorB, ...data}) => { return { ...data, destination: sectorA === sector ? sectorB : sectorA  }})
                            ]
                        }
                    }

                    // this is async but it doesnt impact the rest of the flow so no need to wait for it to finish
                    sectorFunctions.setUserVisitedSector(userData.id, sector, galaxyId);
                    // set the users sector...
                    req.game.setUsersSector(userData.email, galaxyId, data.ship.sector);
                    // alert other uer sin the same sector to their arrival...
                    req.game.sendWebsockMessage({
                        type: 'moveToSector', message: '', data: { userid: userData.id, username: userData.username }
                    }, galaxyId, data.ship.sector);
                    // return
                    res.status(200).json({ error: false, message: '', data: data });
                })
            }
        })
    })
})


router.post('/moveTo', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const destination = req.body.destinationId;
    const galaxyId = req.body.galaxyId;
    const method = req.body.movestyle ?? '';
    const engines = req.body.engines ?? 1;
    const warpCost = 1;

    // check the route exists , 
    // check the user is eligable to use the route from their current location
    // check the user has enough turns
    const connection = mysql.createConnection({...db, multipleStatements: true});
    const sectorQuery = `SELECT sector FROM ships__users WHERE userid=${userData.id} AND galaxyid=${galaxyId}`;

    connection.connect(connectionError => {
        if(connectionError) console.log(connectionError);
        connection.query(sectorQuery, (e, queryResult) => {
            if(e) console.log(`Error: ${e}`);

            const currentSector = queryResult[0].sector;
            let multiQuery = `SELECT universe__galaxies.tickPeriod, universe__galaxies.startTurns, users__galaxies.turnsUsed, TIMESTAMPDIFF(SECOND, users__galaxies.dateJoined, CURRENT_TIMESTAMP()) AS tDiff FROM universe__galaxies LEFT JOIN users__galaxies ON universe__galaxies.id = users__galaxies.galaxyId AND users__galaxies.galaxyId = ${galaxyId} WHERE universe__galaxies.id = ${galaxyId} AND users__galaxies.userid = ${userData.id} `;
            
            // if its a warp move, check that route exists...
            if(method === `warp`) {
                multiQuery += ` ; SELECT COUNT(*) AS cnt FROM universe__warp WHERE galaxyId = ${galaxyId} AND ((sectorA = ${currentSector} AND sectorB = ${destination}) OR (sectorA = ${destination} AND sectorB = ${currentSector}))`;
            } else {
                multiQuery += ` ; SELECT SQRT(POWER(ABS(a.x - b.x), 2) + POWER(ABS(a.y - b.y), 2) + POWER(ABS(a.z - b.z), 2)) as distance FROM universe__systems as a LEFT JOIN universe__systems as b ON b.galaxyid = a.galaxyid AND b.sectorid=${destination} WHERE a.sectorid=${currentSector} AND a.galaxyid=${galaxyId}`;
            }

            connection.query(multiQuery, (e, data) => {
                if(data[0].length === 1 && data[1].length === 1) {

                    const travelCost = method === `warp` ? warpCost : distanceCost(data[1][0].distance, engines);
                    const turns = calculateAvailableTurns(data[0][0].tickPeriod, data[0][0].startTurns, data[0][0].tDiff, data[0][0].turnsUsed);

                    if(turns >= travelCost) {
                        // user has the eligability and the turns to warp, so do it!
                        const updateQuery = `
                            UPDATE ships__users SET sector=${destination} WHERE galaxyid=${galaxyId} AND userid=${userData.id} ; 
                            UPDATE users__galaxies SET turnsUsed=turnsUsed+${travelCost} WHERE userid=${userData.id} AND galaxyid=${galaxyId}
                        `;

                        connection.query(updateQuery, (e, upd) => {
                            connection.destroy();
                            if(!e) {
                                 // set the users sector...
                                req.game.setUsersSector(userData.email, galaxyId, destination);
                                // and alerts other sin the sector...
                                req.game.sendWebsockMessage({
                                    type: 'moveToSector', message: '', data: { userid: userData.id, username: userData.username }
                                }, galaxyId, destination);
                                // send response
                                res.status(200).json({ error: false, message: '', data: {} })
                            }
                        })
                    } else {
                        connection.destroy();
                        res.status(400).json({ error: true, message: 'You cannot afford that route...', data: { required: travelCost, current: turns} })
                    }
                } else {
                    connection.destroy();
                    res.status(400).json({ error: true, message: 'Route does not exist', data: {} })
                }
            })
        })
    })
})

router.get('/distanceToSector', checkAuth, (req, res, next) => {
    const galaxyId = req.query.galaxyId;
    const from = req.query.from;
    const to = req.query.to;
    const engineSize = req.query.engine ?? 1;

    if(from === to) res.status(200).json({ error: true, message: 'You are already in that sector!', data: {}});

    const connection = mysql.createConnection(db);
    const sql = `SELECT SQRT(POWER(ABS(a.x - b.x), 2) + POWER(ABS(a.y - b.y), 2) + POWER(ABS(a.z - b.z), 2)) as distance
                FROM universe__systems as a 
                LEFT JOIN universe__systems as b ON b.galaxyid = a.galaxyid AND b.sectorid=${to}
                WHERE a.sectorid=${from} AND a.galaxyid=${galaxyId}`;

    connection.connect(connectionError => {
        connection.query(sql, (e, distance) => {
            connection.destroy();
            if(!e) {
                if(distance[0].distance !== null) {
                    res.status(200).json({ error: false, message: '', data: { distance: distanceCost(distance[0].distance, engineSize) }})
                } else {
                    res.status(400).json({ error: true, message: `Error: Sectors do not exist...`, data: {}});
                }
            } else {
                res.status(400).json({ error: true, message: `Error: ${e}`, data: {}});
            }
        })
    })
})

function distanceCost(distance, engineSize = 1) {
    const maxTurns = 209.95 - (engineSize * 4.975);
    const distanceModifier = distance;
    const distanceTurns = maxTurns * Math.exp(-distanceModifier / 5);
    return Math.floor(distanceTurns);
}

/**
 * 
 * @param {*} turnRate 
 * @param {*} initialTurns 
 * @param {*} secsSinceGalaxyStart 
 * @param {*} secsSinceJoin 
 * @param {*} turnsUsed 
 * @returns 
 */
function calculateAvailableTurns(turnRate, initialTurns, secsSinceJoin, turnsUsed) {
    const surplus = secsSinceJoin % turnRate;
    const total = (secsSinceJoin - surplus) / turnRate;

    return initialTurns + total - turnsUsed;
}

module.exports = router;