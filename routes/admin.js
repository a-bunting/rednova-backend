const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const mysql = require('mysql');
const db = require('../environment');
const methods = require('../methods/methods');
const errors = require('../methods/errors');

const Galaxy = require('../galaxy/galaxy.model');

router.post('/generateUniverse', checkAuth, checkAdmin, (req, res, next) => {
    const width = req.body.w;
    const height = req.body.h;
    const depth = req.body.d;
    const stars = req.body.s;
    const galaxyName = req.body.name;

    const galaxy = new Galaxy(width, height, depth, stars);

    galaxy.systems = galaxy.systems.map(({ ...data }, i) => { return { ...data, index: i }}); // add the index to it...
    const singlePlanetSystems = galaxy.systems.filter(a => a.planets.length === 1);
    const startPosition = singlePlanetSystems.length > 0 ? singlePlanetSystems[Math.floor(singlePlanetSystems.length * Math.random())].index : singlePlanetSystems[0].index;

    // now upload to the database
    let galaxySql = `INSERT INTO universe__galaxies (name, sectors, width, height, depth, endTime) VALUES ("${galaxyName}", ${galaxy.systems.length}, ${width}, ${height}, ${depth}, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)) ; SELECT id, name, startTime FROM universe__galaxies WHERE id = LAST_INSERT_ID()`;

    const connection = mysql.createConnection({...db, multipleStatements: true});

    connection.connect((connectionError) => {
        if(connectionError) errors.returnError(`Database connection failure`);

        connection.query(galaxySql, (e, result) => {
            if(e) errors.returnError(`Database query failure: ${galaxySql}`);

            const galaxyId = result[0].insertId;
            let systemValues = [];
            let planetValues = [];

            // now add systems...
            for(let i = 0 ; i < galaxy.systems.length ; i++) {
                const system = galaxy.systems[i];
                systemValues.push([i+1, galaxyId, system.coordinates.x, system.coordinates.y, system.coordinates.z, system.size, system.id, system.star.power])

                for(let o = 0 ; o < system.planets.length ; o++) {
                    const planet = system.planets[o];
                    planetValues.push([galaxyId, i+1, planet.name, planet.population, planet.distance, planet.solarRadiation, planet.fields, JSON.stringify(planet.products)])
                }
            }

            const systemSql = `INSERT INTO universe__systems (sectorid, galaxyid, x, y, z, size, givenname, starPower) VALUES ?`;
            const planetsSql = `INSERT INTO universe__planets (galaxyid, sectorid, name, population, distance, solarRadiation, fields, onPlanet) VALUES ?`;

            connection.query(`${systemSql} ; ${planetsSql}`, [systemValues, planetValues], (e, r) => {
                if(e) errors.returnError(`Database query failure: ${systemSql}; ${planetsSql}`);

                // get the id of the starting planet and update the galaxies database
                //const startPositionIdQuery = `SELECT id FROM universe__systems WHERE galaxyid=${galaxyId} AND sectorid="${startPosition}"`;

                //connection.query(startPositionIdQuery, (e, idRes) => {
                //    if(e) errors.returnError(`Database query failure: ${startPositionIdQuery}`);
                    // update the galaxy start position with this id...
                    console.log(startPosition);
                    const galaxyUpdate = `UPDATE universe__galaxies SET startPosition=${startPosition} WHERE id=${galaxyId}`;

                    connection.query(galaxyUpdate, (e, r) => {
                        if(e) errors.returnError(`Database query failure: ${galaxyUpdate}`);
                        // return all the systems now, this is so the id of the system can be appended to the correct planets
                        const systemQuery = `SELECT id, sectorid, givenname FROM universe__systems WHERE galaxyid=${galaxyId}`;
                        
                        connection.query(systemQuery, (e, systemsResult) => {
                            if(e) errors.returnError(`Database query failure: ${systemQuery}`);
                            // create a big update query to update the planets in one query...
                            let updateQuery = "";
                        
                            for(let i = 0 ; i < systemsResult.length ; i++) {
                                updateQuery += ` WHEN name LIKE "${systemsResult[i].givenname}%" THEN ${systemsResult[i].id}`;
                            }

                            // const updatePlanetQuery = `UPDATE universe__planets SET sectorid= CASE ${updateQuery} end WHERE galaxyid=${galaxyId}`;

                            // finally append all the system ids into the planets
                            // connection.query(updatePlanetQuery, (e, r) => {
                                if(e) console.log(e);

                                let warpInsertValues = [];

                                // finally finally add in warp routes...
                                for(let i = 0 ; i < galaxy.systems.length ; i++) {
                                    const system = galaxy.systems[i];
                                    const systemId = systemsResult.filter(a => a.givenname === system.id)[0].sectorid;

                                    for(let o = 0 ; o < system.warpRoutes.length ; o++) {
                                        const toSystemId = systemsResult.filter(a => a.givenname === system.warpRoutes[o].id)[0].sectorid;
                                        // check if this route exists the other way around...
                                        const exists = warpInsertValues.findIndex(a => a[1] === toSystemId && a[2] === systemId);
                                        // if this doesnt exist then fine, add it...
                                        if(exists === -1) warpInsertValues.push([galaxyId, systemId, toSystemId]);
                                    }
                                }

                                const warpRouteInsert = "INSERT INTO universe__warp (galaxyId, sectorA, sectorB) VALUES ?";

                                connection.query(warpRouteInsert, [warpInsertValues], (e, r) => {
                                    connection.destroy();
                                    if(e) console.log(e);
                                    // return the success
                                    res.status(201).json({ error: false, message: '', data: { id: galaxyId, name: galaxyName, startTime: result[1][0].startTime } })
                                })
                            // })
                        })
                    })
                //})
            })
        })
    })
});

router.get('/getGalaxyList', checkAuth, checkAdmin, (req, res, next) => {
    getSql = "SELECT * FROM universe__galaxies";
    const connection = mysql.createConnection(db);

    connection.query(getSql, (e, result) => {
        connection.destroy();

        if(result.length > 0) {
            const data = result.map(({depth, height, width, endTime, startPosition, ...returnData}) => { return returnData; });
            res.status(200).json({ error: false, data: data, message: '' })
        } else {
            res.status(200).json({ error: false, data: {}, message: 'No Galaxies are current being played' }) 
        }
    })
});

router.post('/deleteGalaxy', checkAuth, checkAdmin, (req, res, next) => {
    const galaxyId = req.body.galaxyId;
    const connection = mysql.createConnection({...db, multipleStatements: true});
    const sql = `   DELETE FROM universe__galaxies WHERE id=${galaxyId} ; 
                    DELETE FROM universe__systems WHERE galaxyid=${galaxyId} ;
                    DELETE FROM universe__planets WHERE galaxyid=${galaxyId} ; 
                    DELETE FROM universe__warp WHERE galaxyid=${galaxyId}`;

    connection.query(sql, (e, r) => {
        connection.destroy();
        if(!e) {
            res.status(204).json({ error: false, message: `Galaxy ${galaxyId} was deleted`, data: {} })
        } else {
            res.status(400).json({ error: true, message: `Galaxy ${galaxyId} was not deleted: Error ${e}`, data: {} })
        }
    })
})

module.exports = router;