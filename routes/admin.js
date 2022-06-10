const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const mysql = require('mysql');
const db = require('../environment');
const methods = require('../methods/methods');

const Galaxy = require('../galaxy/galaxy.model');

router.post('/generateUniverse', checkAuth, (req, res, next) => {
    const width = req.body.w;
    const height = req.body.h;
    const depth = req.body.d;
    const stars = req.body.s;

    const galaxy = new Galaxy(width, height, depth, stars);

    const singlePlanetSystems = galaxy.systems.filter(a => a.planets.length === 1);
    const startPosition = singlePlanetSystems.length > 0 ? singlePlanetSystems[Math.floor(singlePlanetSystems.length * Math.random())].id : singlePlanetSystems[0].id;
    const galaxyName = `Not yet Implemented: ${methods.generateRandomId(5)}`;

    // now upload to the database
    let galaxySql = `INSERT INTO universe__galaxies (name, width, height, depth, startPosition) VALUES ("${galaxyName}", ${width}, ${height}, ${depth}, "${startPosition}") ; SELECT id, name, startTime FROM universe__galaxies WHERE id = LAST_INSERT_ID()`;

    const connection = mysql.createConnection({...db, multipleStatements: true});

    connection.connect((connectionError) => {
        connection.query(galaxySql, (sqlError, result) => {


            if(!sqlError) {
                const galaxyId = result[0].insertId;
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
                        error: false,
                        message: '',
                        data: { galaxy: galaxy, id: galaxyId, name: galaxyName, startTime: result[1][0].startTime }
                    })
                })
            } else {
                res.status(400).json({
                    error: true, 
                    message: `An error occurred: ${sqlError}`,
                    data: {}
                })
            }
        })
    })


});

router.get('/getGalaxyList', checkAuth, (req, res, next) => {

    getSql = "SELECT * FROM universe__galaxies";

    const connection = mysql.createConnection(db);

    connection.query(getSql, (e, result) => {

        connection.destroy();

        if(result.length > 0) {

            const data = result.map(({depth, height, width, endTime, startPosition, ...returnData}) => { return returnData; });

            res.status(200).json({
                error: false, 
                data: data, 
                message: ''
            })
        } else {
            res.status(200).json({
                error: false, 
                data: {}, 
                message: 'No Galaxies are current being played'
            }) 
        }

    })

});

module.exports = router;