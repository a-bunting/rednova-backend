const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const db = require('../database');
const methods = require('../methods/methods');
const errors = require('../methods/errors');
const pricing = require('../methods/pricing');

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
    let galaxySql = `INSERT INTO universe__galaxies (name, sectors, width, height, depth, endTime) VALUES ("${galaxyName}", ${galaxy.systems.length}, ${width}, ${height}, ${depth}, DATE_ADD(CURRENT_TIMESTAMP(), INTERVAL 1 MONTH)) ; SELECT id, name, startTime, endTime FROM universe__galaxies WHERE id = LAST_INSERT_ID()`;

    db.query(galaxySql, (e, result) => {
        if(e) errors.returnError(`Database query failure: ${galaxySql}`);

        const galaxyId = result[0].insertId;
        let systemValues = [];
        let planetBuildingValues = [];
        let planetGoodValues = [];

        // now add systems...
        for(let i = 0 ; i < galaxy.systems.length ; i++) {
            const system = galaxy.systems[i];
            systemValues.push([i+1, galaxyId, system.coordinates.x, system.coordinates.y, system.coordinates.z, system.size, system.id, system.star.power])

            for(let o = 0 ; o < system.planets.length ; o++) {
                const planet = system.planets[o];

                for(let s = 0 ; s < planet.products.length ; s++) {
                    planetGoodValues.push([planet.products[s].id, galaxyId, i+1, o+1, planet.products[s].quantity]);
                }
                planetBuildingValues.push([galaxyId, i+1, o+1, planet.name, planet.population, planet.distance, planet.solarRadiation, planet.fields, JSON.stringify(planet.buildings)])
            }
        }

        const systemSql = `INSERT INTO universe__systems (sectorid, galaxyid, x, y, z, size, givenname, starPower) VALUES ?`;
        const planetsSql = `INSERT INTO universe__planets (galaxyid, sectorid, planetindex, name, population, distance, solarRadiation, fields, onPlanet) VALUES ?`;
        const planetGoodSql = `INSERT INTO universe__planetsgoods (goodid, galaxyid, sectorid, planetid, quantity) VALUES ?`;

        db.query(`${systemSql} ; ${planetsSql} ; ${planetGoodSql}`, [systemValues, planetBuildingValues, planetGoodValues], (e, r) => {
            if(e) errors.returnError(`Database query failure: ${systemSql}; ${planetsSql} ; ${planetGoodSql}`, res);

            // get the id of the starting planet and update the galaxies database
                // update the galaxy start position with this id...
                const galaxyUpdate = `UPDATE universe__galaxies SET startPosition=${startPosition} WHERE id=${galaxyId}`;

                db.query(galaxyUpdate, (e, r) => {
                    if(e) errors.returnError(`Database query failure: ${galaxyUpdate}`);
                    // return all the systems now, this is so the id of the system can be appended to the correct planets
                    const systemQuery = `SELECT id, sectorid, givenname FROM universe__systems WHERE galaxyid=${galaxyId}`;
                    
                    db.query(systemQuery, (e, systemsResult) => {
                        if(e) errors.returnError(`Database query failure: ${systemQuery}`);
                        // create a big update query to update the planets in one query...
                        let updateQuery = "";
                    
                        for(let i = 0 ; i < systemsResult.length ; i++) {
                            updateQuery += ` WHEN name LIKE "${systemsResult[i].givenname}%" THEN ${systemsResult[i].id}`;
                        }

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

                            db.query(warpRouteInsert, [warpInsertValues], (e, r) => {
                                if(e) console.log(e);
                                // create the backend tick server
                                // UNTESTED
                                req.game.createServer(galaxyId, galaxyName, width, height, depth, 300, 1000, result[1][0].startTime, result[1][0].endTime);
                                // return the success
                                res.status(201).json({ error: false, message: '', data: { id: galaxyId, name: galaxyName, startTime: result[1][0].startTime } })
                            })
                    })
                })
        })
    })
})

router.get('/getGalaxyList', checkAuth, checkAdmin, (req, res, next) => {
    getSql = "SELECT * FROM universe__galaxies";

    db.query(getSql, (e, result) => {
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
    const sql = `   DELETE FROM universe__galaxies WHERE id=${galaxyId} ; 
                    DELETE FROM universe__systems WHERE galaxyid=${galaxyId} ;
                    DELETE FROM universe__planets WHERE galaxyid=${galaxyId} ; 
                    DELETE FROM universe__warp WHERE galaxyid=${galaxyId} ; 
                    DELETE FROM universe__planetsgoods WHERE galaxyid=${galaxyId} ;
                    DELETE FROM ships__users WHERE galaxyid=${galaxyId}`;

    db.query(sql, (e, r) => {
        if(!e) {
            req.game.destroyServer(galaxyId);
            res.status(204).json({ error: false, message: `Galaxy ${galaxyId} was deleted`, data: {} })
        } else {
            res.status(400).json({ error: true, message: `Galaxy ${galaxyId} was not deleted: Error ${e}`, data: {} })
        }
    })
})

module.exports = router;