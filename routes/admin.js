const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const mysql = require('mysql');
const db = require('../environment');
const methods = require('../methods/methods');

const Galaxy = require('../galaxy/galaxy.model');

router.post('/generateUniverse', (req, res, next) => {
    const width = req.body.w;
    const height = req.body.h;
    const depth = req.body.d;
    const stars = req.body.s;

    const galaxy = new Galaxy(width, height, depth, stars);

    const singlePlanetSystems = galaxy.systems.filter(a => a.planets.length === 1);
    const startPosition = singlePlanetSystems.length > 0 ? singlePlanetSystems[Math.floor(singlePlanetSystems.length * Math.random())].id : singlePlanetSystems[0].id;

    console.log(startPosition);

    // now upload to the database
    let galaxySql = `INSERT INTO universe__galaxies (width, height, depth, startPosition) VALUES (${width}, ${height}, ${depth}, "${startPosition}")`

    const connection = mysql.createConnection({...db, multipleStatements: true});

    connection.connect((connectionError) => {
        connection.query(galaxySql, (sqlError, result) => {

            const galaxyId = result.insertId;
            let systemValues = [];
            let starValues = [];
            let planetValues = [];

            // now add systems...
            for(let i = 0 ; i < galaxy.systems.length ; i++) {
                const system = galaxy.systems[i];
                systemValues.push([galaxyId, system.coordinates.x, system.coordinates.y, system.coordinates.z, system.size, system.id])
                starValues.push([system.id, system.star.power]);

                for(let o = 0 ; o < system.planets.length ; o++) {
                    const planet = system.planets[o];
                    planetValues.push([system.id, planet.name, planet.distance, planet.solarRadiation, `{ "shipsOnPlanet": [], "population": 0 }`])
                }
            }

            const systemSql = `INSERT INTO universe__systems (galaxyid, x, y, z, size, givenname) VALUES ?`;
            const starsSql = `INSERT INTO universe__stars (systemid, power) VALUES ?`;
            const planetsSql = `INSERT INTO universe__planets (systemid, name, distance, solarRadiation, onPlanet) VALUES ?`;

            connection.query(`${systemSql}; ${starsSql}; ${planetsSql}`, [systemValues, starValues, planetValues], (e, r) => {

                connection.destroy();
    
                res.status(200).json({
                    complete: true,
                    res: galaxy
                })
            })



        })
    })


});

module.exports = router;