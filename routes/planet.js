const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const mysql = require('mysql');
const db = require('../environment');
const methods = require('../methods/methods');
const pricing = require('../methods/pricing');

router.get('/getPlanetData', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.query.galaxyId;
    const planetId = req.query.planetId;
    const connection = mysql.createConnection({...db, multipleStatements: true});

    const shipQuery = `SELECT sector FROM ships__users WHERE userid=${userData.id} AND galaxyid=${galaxyId}`;

    connection.connect(connectionError => {
        connection.query(shipQuery, (e, result) => {

            if(result.length === 1) {
                // using the current players ships current sector find the planet, this will fail if any of the ids are incorrect, thoguh will work if they manually change
                // the planet id to another in the same sector.. which is fine..
                // need to implement sensors et al
                const planetQuery = `SELECT * FROM universe__planets WHERE galaxyid=${galaxyId} AND sectorid=${result[0].sector} AND id=${planetId}`;

                connection.query(planetQuery, (e, planet) => {
                    connection.destroy();

                    if(planet.length === 1) {

                        materialsData = [...JSON.parse(planet[0].onPlanet)].map(({ id, current, ...data }) => { return { id, current, ...data, price: pricing.getPrice(id, current, planet[0].population) }});

                        const planetaryData = {
                            name: planet[0].name, 
                            distance: planet[0].distance, 
                            solarRadiation: planet[0].solarRadiation,
                            fields: planet[0].fields,
                            population: planet[0].population,
                            data: [ ...materialsData ]
                        }

                        res.status(200).json({ error: false, message: '', data: { ...planetaryData }});
                    } else {
                        res.status(400).json({ error: true, message: 'Planet not accessible...', data: {}});
                    }

                })
            } else {
                connection.destroy();
                res.status(400).json({ error: true, message: 'User presence not found in galaxy...', data: {}});
            }

        })
    })

})

module.exports = router;