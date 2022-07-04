const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const mysql = require('mysql');
const db = require('../environment');
const methods = require('../methods/methods');
const pricing = require('../methods/pricing');
const ship = require('../methods/ship-functions');

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

router.post('/buyResources', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.body.galaxyId;
    const planetId = req.body.planetId;
    const goodsToBuy = req.body.goods;
    const connection = mysql.createConnection({...db, multipleStatements: true});

    // get your ship from the db for the necessary currency and space stuff.
    const sql = `SELECT money, hull, storage, sector FROM ships__users WHERE userid=${userData.id} AND galaxyid=${galaxyId} ; 
                 SELECT population, onPlanet, sectorid FROM universe__planets WHERE galaxyid=${galaxyId} AND id=${planetId}`;

    connection.connect(connectionError => {
        connection.query(sql, (e, result) => {
            if(e) console.log(`Error: ${e}`);

            const planetaryGoods = JSON.parse(result[1][0].onPlanet);
            const shipContents = JSON.parse(result[0][0].storage);

            const goodOfTypeOnPlanet = planetaryGoods.findIndex(a => a.id === goodsToBuy.id);
            const goodsAvailable = planetaryGoods[goodOfTypeOnPlanet].current;
            const price = pricing.getPrice(goodsToBuy.id, planetaryGoods[goodOfTypeOnPlanet].current, result[1][0].population).buy;

            const goodsQuantityTotalOnShip = shipContents.reduce((total, b) => total + b.quantity, 0);
            const storageCapacity = ship.getHullCapacity(result[0][0].hull);

            // if there arent enough goods available, buy the max!
            let quantityToBuy = goodsToBuy.quantity < goodsAvailable ? goodsToBuy.quantity : goodsAvailable;
            let totalCost = quantityToBuy * price;
            
            // check if this can be done, and if not, quit with response.!
            if(result[0][0].sector !== result[1][0].sectorid)  { 
                res.status(200).json({ error: true, message: 'You are not in the same sector as that planet.', data: {}}); 
            } else {
               
                // if we dont have the storage capacity, buy the maximum amount...
                if((storageCapacity - goodsQuantityTotalOnShip - quantityToBuy) <= 0) {
                    quantityToBuy = storageCapacity - goodsQuantityTotalOnShip > 0 ? storageCapacity - goodsQuantityTotalOnShip : 0; // update the quantity
                    totalCost = quantityToBuy * price;  // update the price
                }

                // if we dont have the money, then buy the max for the money.
                if(result[0][0].money < totalCost) { 
                    quantityToBuy = Math.floor(result[0][0].money / price);
                    totalCost = quantityToBuy * price;
                }

                if(quantityToBuy === 0) {
                    res.status(200).json({ error: true, message: `You have no more space on your ship!`, data: {}});
                } else {
                    // if the good doesnt exist on the ship it needsto be created, otherwise it needs to be updated.
                    let indexInShipJson = shipContents.findIndex(a => a.id === goodsToBuy.id);
                    const quantityToSet = indexInShipJson === -1 ? `JSON_OBJECT( 'id', '${goodsToBuy.id}', 'name', '${pricing.getNameFromId(goodsToBuy.id)}', 'quantity', ${quantityToBuy} )` : shipContents[indexInShipJson].quantity + quantityToBuy;
                    const fieldToSet = indexInShipJson === -1 ? '' : '.quantity';
                    
                    indexInShipJson = indexInShipJson === -1 ? shipContents.length : indexInShipJson;
        
                    // it can go ahead!
                    const updateQuery = `
                        UPDATE universe__planets SET onPlanet = JSON_SET(onPlanet, '$[${goodOfTypeOnPlanet}].current', ${planetaryGoods[goodOfTypeOnPlanet].current - quantityToBuy}) WHERE id=${planetId} ; 
                        UPDATE ships__users SET money = money - ${totalCost}, storage = JSON_SET(storage, '$[${indexInShipJson}]${fieldToSet}', ${quantityToSet}) WHERE galaxyid=${galaxyId} AND userid=${userData.id}
                    `;
                                            
                    connection.query(updateQuery, (e, updated) => {
                        connection.destroy(); // for now
        
                        if(!e) res.status(200).json({ error: false, message: '', data: { quantity: quantityToBuy, total: totalCost}});
                        else res.status(400).json({ error: true, message: `Update did not work: ${updateQuery}:${e}`, data: {}});
                    })
                }

            }
        })
    })
})

router.post('/sellResources', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.body.galaxyId;
    const planetId = req.body.planetId;
    const goodsToSell = req.body.goods;
    const connection = mysql.createConnection({...db, multipleStatements: true});

    // get your ship from the db for the necessary currency and space stuff.
    const sql = `SELECT storage, sector FROM ships__users WHERE userid=${userData.id} AND galaxyid=${galaxyId} ; 
                 SELECT population, onPlanet, sectorid FROM universe__planets WHERE galaxyid=${galaxyId} AND id=${planetId}`;

    connection.connect(connectionError => {
        connection.query(sql, (e, result) => {
            if(e) console.log(`Error: ${e}`);

            // check if this can be done, and if not, quit with response.
            if(result[0][0].sector !== result[1][0].sectorid)  { 
                connection.destroy();
                res.status(200).json({ error: true, message: 'You are not in the same sector as that planet.', data: {}}); 
            } else {
                const planetaryGoods = JSON.parse(result[1][0].onPlanet);
                const shipContents = JSON.parse(result[0][0].storage);
    
                // get the id of the good in the storage arrays
                const goodOfTypeOnShip = shipContents.findIndex(a => a.id === goodsToSell.id);
                const goodOfTypeOnPlanet = planetaryGoods.findIndex(a => a.id === goodsToSell.id);

                // selling goods so find how many are available
                const goodsAvailable = shipContents[goodOfTypeOnShip].quantity;
    
                // price based upon planetary conditions, not ship conditions
                const price = pricing.getPrice(goodsToSell.id, planetaryGoods[goodOfTypeOnPlanet].current, result[1][0].population).sell;
    
                // if there arent enough goods available, sell the max!
                let quantityToSell = goodsToSell.quantity < goodsAvailable ? goodsToSell.quantity : goodsAvailable;
                let totalCost = quantityToSell * price;

                if(quantityToSell > 0) {
    
                    // if the good doesnt exist on the planet it needs to be created, otherwise it needs to be updated.
                    // unlikey right now... but do this to allow for rare items not added at creation.
                    let indexOnPlanet = planetaryGoods.findIndex(a => a.id === goodsToSell.id);
                    const quantityToSet = indexOnPlanet === -1 ? `JSON_OBJECT( 'id', '${goodsToSell.id}', 'name', '${pricing.getNameFromId(goodsToSell.id)}', 'quantity', ${quantityToSell} )` : planetaryGoods[indexOnPlanet].current + quantityToSell;
                    const fieldToSet = indexOnPlanet === -1 ? '' : '.current';
                    
                    indexOnPlanet = indexOnPlanet === -1 ? planetaryGoods.length : indexOnPlanet;
        
                    // it can go ahead!
                    const updateQuery = `
                        UPDATE universe__planets SET onPlanet = JSON_SET(onPlanet, '$[${goodOfTypeOnPlanet}]${fieldToSet}', ${quantityToSet}) WHERE id=${planetId} ; 
                        UPDATE ships__users SET money = money + ${totalCost}, storage = JSON_SET(storage, '$[${goodOfTypeOnShip}].quantity', ${shipContents[goodOfTypeOnShip].quantity - quantityToSell}) WHERE galaxyid=${galaxyId} AND userid=${userData.id}
                    `;
                                            
                    connection.query(updateQuery, (e, updated) => {
                        connection.destroy(); // for now
        
                        if(!e) res.status(200).json({ error: false, message: '', data: { quantity: quantityToSell, total: totalCost}});
                        else res.status(400).json({ error: true, message: `Update did not work: ${updateQuery}:${e}`, data: {}});
                    })
                } else {
                    connection.destroy();
                    res.status(200).json({ error: true, message: `You have no goods of that type to sell`, data: {}});
                }
            }
        })
    })
})

module.exports = router;
