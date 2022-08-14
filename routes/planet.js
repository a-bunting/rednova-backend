const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const db = require('../database');
const methods = require('../methods/methods');
const pricing = require('../methods/pricing');
const ship = require('../methods/game-functions');

router.get('/getPlanetData', checkAuth, (req, res, next) => {

    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.query.galaxyId;
    const planetId = req.query.planetId;

    const shipQuery = `SELECT sector FROM ships__users WHERE userid=${userData.id} AND galaxyid=${galaxyId}`;

    db.query(shipQuery, (e, result) => {

        if(result.length === 1) {
            // using the current players ships current sector find the planet, this will fail if any of the ids are incorrect, thoguh will work if they manually change
            // the planet id to another in the same sector.. which is fine..
            // need to implement sensors et al
            const planetQuery = `
                SELECT 
                    universe__planets.name, universe__planets.owner, universe__planets.owner, universe__planets.trading, universe__planets.planetindex, universe__planets.distance, universe__planets.solarRadiation, universe__planets.fields, universe__planets.population, universe__planets.onPlanet,
                    universe__planetsgoods.goodid, universe__planetsgoods.quantity, 
                    users.username
                FROM universe__planets 
                LEFT JOIN universe__planetsgoods ON universe__planets.sectorid = universe__planetsgoods.sectorid AND universe__planetsgoods.galaxyid=${galaxyId} AND universe__planets.planetindex = universe__planetsgoods.planetid
                LEFT JOIN users ON users.id = universe__planets.owner
                WHERE universe__planets.galaxyid=${galaxyId} 
                AND universe__planets.sectorid=${result[0].sector} 
                AND universe__planets.id=${planetId}
                `;

            db.query(planetQuery, (e, planet) => {

                if(planet.length !== 0) {

                    let buildingsData = planet[0].owner === userData.id ? [...JSON.parse(planet[0].onPlanet)].map(({ id, quantity, ...data }) => { return { id, quantity, ...data, price: pricing.getBuildingPrice(id) }}) : [];
                    let goodsData = planet[0].owner === userData.id || planet[0].trading === 1 ? planet.map(({ goodid, quantity, ...data }) => { return { id: goodid, name: pricing.getNameFromId(+goodid), quantity: quantity, price: pricing.getPrice(goodid, quantity, planet[0].population) } }) : [];

                    const planetaryData = {
                        name: planet[0].name, 
                        planetindex: planet[0].planetindex,
                        distance: planet[0].distance, 
                        solarRadiation: planet[0].solarRadiation,
                        fields: planet[0].fields,
                        population: planet[0].population,
                        goods: [ ...goodsData ],
                        buildings: [ ...buildingsData ],
                        owner: { currentUser: planet[0].owner === userData.id ? true : false, username: planet[0].username ? planet[0].username : 'Unclaimed Planet' },
                        trading: planet[0].trading
                    }

                    res.status(200).json({ error: false, message: '', data: { ...planetaryData }});
                } else {
                    res.status(400).json({ error: true, message: 'Planet not accessible...', data: {}});
                }

            })
        } else {
            res.status(400).json({ error: true, message: 'User presence not found in galaxy...', data: {}});
        }
    })
})

router.post('/buyResources', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.body.galaxyId;
    const planetId = req.body.planetId;
    const sectorId = req.body.sectorId;
    const goodsToBuy = req.body.goods;

    // get your ship from the db for the necessary currency and space stuff.
    const sql = `SELECT money, hull, storage, sector FROM ships__users WHERE userid=${userData.id} AND galaxyid=${galaxyId} ; 

                 SELECT universe__planets.population, universe__planetsgoods.quantity, universe__planetsgoods.id
                 FROM universe__planets 
                 LEFT JOIN universe__planetsgoods 
                    ON universe__planetsgoods.planetid = universe__planets.planetindex 
                    AND universe__planetsgoods.galaxyid = ${galaxyId}
                    AND universe__planets.sectorid = universe__planetsgoods.sectorid
                    AND universe__planetsgoods.goodid=${goodsToBuy.id}
                 WHERE universe__planets.galaxyid=${galaxyId} 
                 AND universe__planets.sectorid=${sectorId} 
                 AND universe__planets.id=${planetId}`;

    db.query(sql, (e, result) => {
        if(e) console.log(`Error: ${e}`);

        const shipContents = result[0][0].storage ? JSON.parse(result[0][0].storage) : [];
        const goodsAvailable = result[1][0].quantity;
        const price = pricing.getPrice(goodsToBuy.id, goodsAvailable, result[1][0].population).buy;

        const goodsQuantityTotalOnShip = shipContents.reduce((total, b) => total + b.quantity, 0);
        const storageCapacity = ship.getHullCapacity(result[0][0].hull);

        // if there arent enough goods available, buy the max!
        let quantityToBuy = goodsToBuy.quantity < goodsAvailable ? goodsToBuy.quantity : goodsAvailable;
        let totalCost = quantityToBuy * price;
        
        // check if this can be done, and if not, quit with response.!
        if(result[0][0].sector !== sectorId)  { 
            res.status(200).json({ error: true, message: 'you are not in the same sector as that planet.', data: {}}); 
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
                res.status(200).json({ error: true, message: `you have no more space on your ship!`, data: {}});
            } else {
                // if the good doesnt exist on the ship it needsto be created, otherwise it needs to be updated.
                let indexInShipJson = shipContents.findIndex(a => a.id === goodsToBuy.id);
                const quantityToSet = indexInShipJson === -1 ? `JSON_OBJECT( 'id', ${goodsToBuy.id}, 'name', '${pricing.getNameFromId(goodsToBuy.id)}', 'quantity', ${quantityToBuy} )` : shipContents[indexInShipJson].quantity + quantityToBuy;
                const fieldToSet = indexInShipJson === -1 ? '' : '.quantity';
                
                indexInShipJson = indexInShipJson === -1 ? shipContents.length : indexInShipJson;
    
                // it can go ahead!
                const updateQuery = `
                    UPDATE universe__planetsgoods SET quantity = quantity - ${quantityToBuy} WHERE id=${result[1][0].id} ; 
                    UPDATE ships__users SET money = money - ${totalCost}, storage = JSON_SET(storage, '$[${indexInShipJson}]${fieldToSet}', ${quantityToSet}) WHERE galaxyid=${galaxyId} AND userid=${userData.id}
                `;
                                    
                db.query(updateQuery, (e, updated) => {    
                    if(!e) res.status(200).json({ error: false, message: '', data: { quantity: quantityToBuy, total: totalCost}});
                    else res.status(400).json({ error: true, message: `Update did not work: ${updateQuery}:${e}`, data: {}});
                })
            }
        }
    })
})

router.post('/sellResources', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.body.galaxyId;
    const planetId = req.body.planetId;
    const sectorId = req.body.sectorId;
    const goodsToSell = req.body.goods;

    // get your ship from the db for the necessary currency and space stuff.
    const sql = `SELECT storage, sector FROM ships__users WHERE userid=${userData.id} AND galaxyid=${galaxyId} ; 
                            
                SELECT universe__planets.population, universe__planets.planetindex, universe__planetsgoods.quantity, universe__planetsgoods.id
                FROM universe__planets 
                LEFT JOIN universe__planetsgoods 
                    ON universe__planetsgoods.planetid = universe__planets.planetindex 
                    AND universe__planetsgoods.galaxyid = ${galaxyId}
                    AND universe__planets.sectorid = universe__planetsgoods.sectorid
                    AND universe__planetsgoods.goodid=${goodsToSell.id}
                WHERE universe__planets.galaxyid=${galaxyId} 
                AND universe__planets.sectorid=${sectorId} 
                AND universe__planets.id=${planetId}`;

    db.query(sql, (e, result) => {
        if(e) console.log(`Error: ${e}`);

        // check if this can be done, and if not, quit with response.
        if(result[0][0].sector !== sectorId)  { 
            res.status(200).json({ error: true, message: 'you are not in the same sector as that planet.', data: {}}); 
        } else {
            const shipContents = JSON.parse(result[0][0].storage);
                
            // get the id of the good in the storage arrays
            const goodOfTypeOnShip = shipContents.findIndex(a => a.id === goodsToSell.id);

            // selling goods so find how many are available
            const goodsAvailable = shipContents[goodOfTypeOnShip].quantity;

            // price based upon planetary conditions, not ship conditions
            const price = pricing.getPrice(goodsToSell.id, result[1][0].quantity, result[1][0].population).sell;

            // if there arent enough goods available, sell the max!
            let quantityToSell = goodsToSell.quantity < goodsAvailable ? goodsToSell.quantity : goodsAvailable;
            let totalCost = quantityToSell * price;

            if(quantityToSell > 0) {

                // it can go ahead!
                let updateQuery = `
                    UPDATE ships__users SET money = money + ${totalCost}, storage = JSON_SET(storage, '$[${goodOfTypeOnShip}].quantity', ${shipContents[goodOfTypeOnShip].quantity - quantityToSell}) WHERE galaxyid=${galaxyId} AND userid=${userData.id} ;
                `;
                
                // if the good doesnt exist on the planet it needs to be created, otherwise it needs to be updated.
                // unlikey right now... but do this to allow for rare items not added at creation.
                let goodsExist = result[1][0].id !== null ? true : false;
                // select the query
                if(goodsExist) updateQuery += `UPDATE universe__planetsgoods SET quantity = quantity + ${quantityToSell} WHERE id=${result[1][0].id}`;
                else updateQuery += `INSERT INTO universe__planetsgood (goodid, galaxyid, sectorid, planetid, quantity) VALUES (${goodsToSell.id}, ${galaxyId},${sectorId}, ${result[1][0].planetindex}, ${quantityToSell})`;

                db.query(updateQuery, (e, updated) => {    
                    if(!e) res.status(200).json({ error: false, message: '', data: { quantity: quantityToSell, total: totalCost}});
                    else res.status(400).json({ error: true, message: `Update did not work: ${updateQuery}:${e}`, data: {}});
                })
            } else {
                res.status(200).json({ error: true, message: `you have no goods of that type to sell`, data: {}});
            }
        }
    })
})

router.post('/buildBuilding', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.body.galaxyId;
    const sectorId = req.body.sectorId;
    const planetIndex = req.body.planetIndex;
    const building = req.body.building;

    const sql = `
                    SELECT sector, money FROM ships__users WHERE userid=${userData.id} AND galaxyid=${galaxyId};
                    SELECT onPlanet, fields FROM universe__planets 
                    WHERE galaxyid=${galaxyId} AND sectorid=${sectorId} AND planetindex=${planetIndex} AND owner=${userData.id}  
                `;

    db.query(sql, (e, result) => {

        // check the user is in the right sector
        if(result[0][0].sector === sectorId) {
            // we are in the right sector so lets get the amount of cash from the planet
            const buildingObj = pricing.getGoodsObject().find(a => a.id === building.id);

            // ideally buy as many as requested...
            let cost = buildingObj.cost * building.quantity;
            let quantityToBuy = building.quantity;

            // if they dont have enough money, just buy as many as they can...
            if(cost > result[0][0].money) { quantityToBuy = Math.floor(result[0][0].money / buildingObj.cost); }

            const buildings = JSON.parse(result[1][0].onPlanet);
            const indexOnPlanetJson = buildings.findIndex(a => a.id === building.id);
            let freeSpaceOnPlanet = result[1][0].fields;

            // get the number of buildings.
            buildings.map(a => freeSpaceOnPlanet -= a.quantity);

            // if there is not enough space then build the max.
            if(freeSpaceOnPlanet < quantityToBuy) { quantityToBuy = freeSpaceOnPlanet; }

            // calculate final copst
            cost = quantityToBuy * buildingObj.cost;

            if(quantityToBuy > 0) {
                // buy them
                // JSON UPDATE QUERY UGGGGGHHHHHHH!
                const totalBuildings = +buildings.find(a => a.id === buildingObj.id).quantity + +quantityToBuy;
                const multiQuery = `
                    UPDATE universe__planets SET onPlanet = JSON_SET(onPlanet, '$[${indexOnPlanetJson}].quantity', '${totalBuildings}') WHERE galaxyid=${galaxyId} AND sectorid=${sectorId} AND planetindex=${planetIndex};
                    UPDATE ships__users SET money = money - ${cost} WHERE galaxyid=${galaxyId} AND userid=${userData.id}
                `;

                db.query(multiQuery, (e, r) => {
                    if(!e) res.status(200).json({ error: false, message: '', data: { quantity: quantityToBuy, total: cost }});
                    else res.status(400).json({ error: true, message: 'A problem with your final query!', data: { }});
                })
            } else {
                res.status(200).json({ error: true, message: 'you have either filled that planet up, or you dont have enough money on your ship to buy any of those!', data: {}});
            }
        } else {
            res.status(200).json({ error: true, message: 'you are not in the correct sector to build on that planet', data: {}});
        }
    })
});

router.post('/destroyBuilding', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.body.galaxyId;
    const sectorId = req.body.sectorId;
    const planetIndex = req.body.planetIndex;
    const building = req.body.building;

    const sql = `
                    SELECT sector FROM ships__users WHERE userid=${userData.id} AND galaxyid=${galaxyId};
                    SELECT onPlanet, owner FROM universe__planets 
                    WHERE galaxyid=${galaxyId} AND sectorid=${sectorId} AND planetindex=${planetIndex} AND owner=${userData.id}  
                `;

    db.query(sql, (e, result) => {
        // check the user is in the sector...
        if(result[0][0].sector === sectorId) {
            if(result[1][0].owner === userData.id) {
                // whats on the planet
                const planetaryBuildings = JSON.parse(result[1][0].onPlanet);
                const indexOnPlanetJson = planetaryBuildings.findIndex(a => a.id === building.id);
                // get an idividual building cost and * by .8 as thats what the user gets back from selling
                const buildingPrice = pricing.getGoodsObject().find(a => a.id === building.id).cost * .8;
                // if the user is trying to destroy more than they have, max out at how many there are on the planet
                const numberToDestroy = +building.quantity <= +planetaryBuildings[indexOnPlanetJson].quantity ? +building.quantity : +planetaryBuildings[indexOnPlanetJson].quantity;
                const compensation = numberToDestroy * buildingPrice;

                if(numberToDestroy === 0 || indexOnPlanetJson === -1) {
                    res.status(200).json({ error: true, message: 'there are none of that building to destroy.', data: {}});
                } else {

                    const updates = `
                        UPDATE ships__users SET money = money + ${compensation} WHERE userid=${userData.id} AND galaxyid=${galaxyId};
                        UPDATE universe__planets SET onPlanet = JSON_SET(onPlanet, '$[${indexOnPlanetJson}].quantity', '${planetaryBuildings[indexOnPlanetJson].quantity - numberToDestroy}') WHERE galaxyid=${galaxyId} AND sectorid=${sectorId} AND planetindex=${planetIndex};
                    `;

                    db.query(updates, (e, updated) => {
                        res.status(200).json({ error: false, message: '', data: { quantity: numberToDestroy, total: compensation }});
                    })
                }

            } else {
                res.status(200).json({ error: true, message: 'you need to be the owner to build or destroy buildings', data: {}});
            }
        } else {
            res.status(200).json({ error: true, message: 'you are not in the correct sector to build on that planet', data: {}});
        }
    });
});

router.post('/updateTrading', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.body.galaxyId;
    const sectorId = req.body.sectorId;
    const planetIndex = req.body.planetIndex;
    const tradingStatus = req.body.tradingStatus;
    
    // first check the user is eligable to change the trade status ad is in the same sector as hte planet
    const sql = `
        SELECT  ships__users.sector,
                universe__planets.trading, universe__planets.owner
        FROM ships__users 
        LEFT JOIN universe__planets ON universe__planets.owner = ships__users.userid AND universe__planets.galaxyid = ships__users.galaxyid AND ships__users.sector = universe__planets.sectorid     
        WHERE ships__users.userid=${userData.id} 
        AND ships__users.galaxyid=${galaxyId}
        AND ships__users.sector=${sectorId}
        AND universe__planets.planetindex=${planetIndex}
     `;

    db.query(sql, (e, r) => {
        if(e) console.log(`Error: ${e}`);
        
        if(r.length === 1) {
            // the record has been found and this user is able to make changes to this planet
            const updateSql= `UPDATE universe__planets SET trading=${tradingStatus ? 1 : 0} WHERE galaxyid=${galaxyId} AND sectorid=${sectorId} AND planetindex=${planetIndex}`;

            db.query(updateSql, (e, result) => {
                if(result) {
                    if(result['affectedRows'] === 1) {
                        res.status(200).json({ error: false, message: '', data: {} });
                    } else {
                        res.status(200).json({ error: true, message: `trading was already turned ${tradingStatus ? 'on' : 'off'}`, data: { planetAdminAccess: true } });
                    }
                } else {
                    res.status(200).json({ error: true, message: `you are not eligable to edit that planets trading settings.`, data: { planetAdminAccess: false } });
                }
            })
        } else {
            // user not eligable or some data is wrong
            res.status(200).json({ error: true, message: 'you are not eligable to change the trading status of this planet.', data: { planetAdminAccess: false } });
        }
    });
});


module.exports = router;
