const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');
const checkAdmin = require('../middleware/check-admin');
const db = require('../database');
const methods = require('../methods/methods');
const pricing = require('../methods/pricing');
const gameFunctions = require('../methods/game-functions');

function verifyTradeRoute(route) {

    return true;
}

router.post('/addTradeRoute', checkAuth, (req, res, next) => {

    const userData = methods.getUserDataFromToken(req);
    const traderoute = req.body.tradeRoute;
    const tradeRouteId = req.body.tradeRouteId;
    const galaxyId = req.body.galaxyId;

    if(!verifyTradeRoute(traderoute)) {
        res.status(200).json({ error: true, message: 'Trade Route is Invalid...', data: {}});
        return;
    }

    const sql = `INSERT INTO trade__route (${tradeRouteId ? 'id, ' : ''}galaxyid, userid, name) VALUES (${tradeRouteId ? tradeRouteId + ', ' : ''}${galaxyId}, ${userData.id}, '${traderoute.name}') ON DUPLICATE KEY UPDATE name = VALUES(name)`;

    db.query(sql, (e, result) => {
        if(!e) {
            
            // route was successfully entered, so now get the id and enter the data ito the stages section...
            const stagesSql = `INSERT INTO trade__stages (routeid, stage, action, detail) VALUES ? ON DUPLICATE KEY UPDATE detail = VALUES(detail), action = VALUES(action)`;

            let insert = [];
            
            for(let i = 0 ; i < traderoute.stages.length ; i++) {
                const stage = traderoute.stages[i];
                const actionNumeric = stage.action === 'move' ? 0 : stage.action === 'buy' ? 1 : 2;
                let actionDetails = {};
                
                switch(stage.action) {
                    case 'move': 
                        actionDetails = `{ "destination": ${stage.destination}, "moveType": "${stage.moveType}", "cost": ${stage.cost} }`;
                        break;
                    default: 
                        actionDetails = `{ "goodsType": ${stage.goodsType}, "planetId": ${stage.planetId}, "quantity": ${stage.quantity}, "cost": 1 }`;
                        break; // buy or sell
                }
                    
                insert.push([tradeRouteId ? tradeRouteId : result.insertId, i, actionNumeric, actionDetails]);
            }
                
            db.query(stagesSql, [insert], (e, stageResult) => {
                if(!e) {
                    res.status(200).json({ error: false, message: '', data: { id: tradeRouteId ?? result.insertId }});
                } else {
                    console.log(e);
                    res.status(400).json({ error: true, message: 'Error Adding or Update Stages', data: {}});
                }
            })

        } else res.status(400).json({ error: true, message: `Error Querying Database: SQL ${sql}`, data: {}});
    })
        
})

router.post('/deleteTradeRoute', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const tradeRouteId = req.body.tradeRouteId;

    // dete the trade route first...
    const sql = `DELETE FROM trade__route WHERE id=${tradeRouteId} AND userid=${userData.id}`;

    db.query(sql, (e, result) => {
        // if there is no error and there as one line deleted...
        if(!e && result.affectedRows === 1) {
            const stageDelete = `DELETE FROM trade__stages WHERE routeid=${tradeRouteId}`;
            // try and delet the stages...
            db.query(stageDelete, (e, r) => {
                if(!e) {
                    res.status(200).json({ error: false, message: '', data: {}});
                } else {
                    res.status(200).json({ error: true, message: 'Error Deleting Stages', data: {}})
                } 
            })
        } else res.status(200).json({ error: true, message: 'Error Deleting Row', data: {}})
    })        
})

router.post('/loadTradeRoute', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const tradeRouteId = req.body.tradeRouteId;
    const galaxyId = req.body.galaxyId;

    const sql = `
        SELECT trade__route.name, trade__route.id as routeid, GROUP_CONCAT(trade__stages.detail SEPARATOR '|') as details, GROUP_CONCAT(trade__stages.action SEPARATOR '|') as actions, GROUP_CONCAT(DISTINCT trade__stages.stage SEPARATOR '|') as stages
        FROM trade__route
        LEFT JOIN trade__stages ON trade__stages.routeid = trade__route.id
        WHERE trade__route.id = ${tradeRouteId} AND trade__route.userid = ${userData.id}
        GROUP BY trade__route.id
    `;

    db.query(sql, (e, result) => {

        // check if a result was found and if so parse it and return it... 
        if(!e) {
            let stageIds = result[0].stages.split('|');
            let details = result[0].details.split('|');
            let actions = result[0].actions.split('|');
            
            // build the trade route...
            let traderoute = { name: result[0].name, cost: 0, stages: [] }

            // adds the stages back in...
            stageIds.forEach((stage, index) => {
                traderoute.stages.push({
                    id: stage,
                    action: actions[index] === '0' ? 'move' : actions[index] === '1' ? 'buy' : 'sell',
                    ...JSON.parse(details[index])
                })
            });

            res.status(200).json({ error: false, message: '', data: { traderoute: traderoute, traderouteid: tradeRouteId }});
        } else if (result.length !== 1) {
            res.status(200).json({ error: true, message: 'Could not find route...', data: {}});
        } else {
            res.status(200).json({ error: true, message: 'Error Querying Database', data: {}});
        }
    })
})

router.get('/getTradeRouteList', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const galaxyId = req.query.galaxyId;

    const sql = `SELECT id, name FROM trade__route WHERE galaxyid=${galaxyId} AND userid=${userData.id}`;

    db.query(sql, (e, r) => {
        if(e) {
            res.status(200).json({ error: true, message: 'Error Querying Database', data: {}});
        } else {
            // if there is no error return the trades list...
            let traderoutes = [];
            for(let i = 0 ; i < r.length ; i++) { traderoutes.push({ id: r[i].id, name: r[i].name }); }

            // return the traderoutes...
            res.status(200).json({ error: false, message: '', data: { routes: traderoutes }});
        }
    })
})

router.post('/executeTradeRoutes', checkAuth, (req, res, next) => {
    const userData = methods.getUserDataFromToken(req);
    const tradeRouteId = req.body.tradeRouteId;
    const iterations = req.body.iterations;
    const galaxyId = req.body.galaxyId;

    const tradeSql = `
        SELECT trade__route.name, trade__stages.stage, trade__stages.action, trade__stages.detail 
        FROM trade__route 
        LEFT JOIN trade__stages ON trade__route.id = trade__stages.routeid
        WHERE trade__route.id = ${tradeRouteId} AND trade__route.userid = ${userData.id} AND trade__route.galaxyid = ${galaxyId} ;
        SELECT dateJoined, turnsUsed, TIMESTAMPDIFF(SECOND, dateJoined, CURRENT_TIMESTAMP()) AS tDiff FROM users__galaxies WHERE userid=${userData.id} AND galaxyid=${galaxyId} ;
        SELECT money, hull, storage, sector FROM ships__users WHERE userid = ${userData.id} AND galaxyid = ${galaxyId}   
    `;

    db.query(tradeSql, (e, result) => {
        if(!e) {

            const server = req.game.getServer(galaxyId);
            let turns = gameFunctions.getUserTurns(server, result[1][0].tDiff, result[1][0].turnsUsed);
            const stages = [];
            
            let planetsData = '';

            for(let i = 0 ; i < result[0].length ; i++) {
                const stage = { stage: result[0][i].stage, action: result[0][i].action === 0 ? 'move' : result[0][i].action === 1 ? 'buy' : 'sell', ...JSON.parse(result[0][i].detail) };
                stages.push(stage);
                // what planets do we need info on...
                if(stage.action !== 'move') planetsData += ('' + stage.planetId + (result[0].length === i + 1 ? '' : ', '));
            }

            const sql = `
                SELECT universe__planets.id, universe__planets.sectorid, universe__planets.planetindex, universe__planets.owner, universe__planets.name, universe__planets.trading, universe__planets.population, GROUP_CONCAT(universe__planetsgoods.goodId SEPARATOR ',') as goodId, GROUP_CONCAT(universe__planetsgoods.quantity SEPARATOR ',') as quantity
                FROM universe__planets
                LEFT JOIN universe__planetsgoods ON universe__planets.sectorid = universe__planetsgoods.sectorid AND universe__planets.planetindex = universe__planetsgoods.planetid
                WHERE universe__planets.id IN (${planetsData})
                GROUP BY universe__planets.id
            `;
                
            db.query(sql, (e, planetaryData) => {
                if(!e) {

                    // format the planet data better.
                    let planetData = [];

                    for(let i = 0 ; i < planetaryData.length ; i++) {

                        // split the goods and quantities from the returns arrays...
                        let goodSplit = planetaryData[i].goodId.split(',');
                        let quantitySplit = planetaryData[i].quantity.split(',');
                        let goods = [];

                        // build an array
                        goodSplit.map((a, index) => goods.push({ id: a, quantity: +quantitySplit[index] }));

                        // create the objects
                        let newPlanet = {
                            id: planetaryData[i].id, 
                            sectorid: planetaryData[i].sectorid, 
                            index: planetaryData[i].planetindex,
                            owner: planetaryData[i].owner, 
                            name: planetaryData[i].name, 
                            trading: planetaryData[i].trading, 
                            population: planetaryData[i].population, 
                            goods: goods
                        }

                        planetData.push(newPlanet);

                    }

                    let ship = {
                        money: result[2][0].money, 
                        hull: result[2][0].hull, 
                        hullCapacity: gameFunctions.getHullCapacity(result[2][0].hull),
                        sector: result[2][0].sector, 
                        storage: result[2][0].storage ? JSON.parse(result[2][0].storage) : []
                    }

                    let turnsUsed = 0;
                    let returnLog = [];
                    let iterationsRun = 0;
                    let currentSector = ship.sector;

                    // now run the trade route x times...
                    for(let o = 0 ; o < iterations ; o++) {
                        for(let i = 0 ; i < stages.length ; i++) {
                            let log = [];

                            // run the stage if possible...
                            switch(stages[i].action) {
                                case 'move':
                                    // check we arent already int hat sector and if we are do nothing
                                    if(currentSector !== stages[i].destination) {
                                        // check they can afford the move..
                                        if(turns >= stages[i].cost) {
                                            log.push({ success: true, action: 'move', from: currentSector, to: stages[i].destination, method: stages[i].moveType, turns: stages[i].cost });
                                            ship.sector = stages[i].destination;
                                            currentSector = stages[i].destination;
                                            turnsUsed += stages[i].cost;
                                            turns -= stages[i].cost;
                                        } else {
                                            // push an error letting the user know there arent enough turns for this.
                                            // end the rest of the process.
                                            log.push({ success: false, action: 'move', from: currentSector, to: stages[i].destination, method: stages[i].moveType, turns: stages[i].cost, error: 'Not enough turns available.' });
                                        }
                                    } else {
                                        log.push({ success: true, action: 'move', from: currentSector, to: stages[i].destination, method: 'none', turns: 0 });
                                    }
                                    break;
                                case 'buy':
                                    const planetToBuyFrom = planetData.find(a => +a.id === +stages[i].planetId);

                                    // check we are in the same sector as the planet...
                                    if(currentSector === planetToBuyFrom.sectorid) {
                                        // check the planet is either owned by the user or has trading enabled...
                                        if(planetToBuyFrom.owner === userData.id || planetToBuyFrom.trading === 1) {
                                            // check if the planet has the goods to sell...
                                            let good = planetToBuyFrom.goods.find(a => +a.id === +stages[i].goodsType);
                                            let shipGoods = ship.storage.find(a => +a.id === +good.id);

                                            // if the goods dont exist on either the ship or the planet then add it.
                                            if(!shipGoods) { ship.storage.push({ id: +stages[i].goodsType, name: pricing.getNameFromId(+stages[i].goodsType), quantity: 0 }); shipGoods = ship.storage[ship.storage.length -1]; console.log('a'); };
                                            if(!good) { planetToBuyFrom.goods.push({ id: +stages[i].goodsType, quantity: 0 }); good = planetToBuyFrom.goods[planetToBuyFrom.goods.length -1]; console.log('b'); };

                                            // get the quantity and price of the goods...
                                            // how much space is there on the ship
                                            let goodsOnShip = 0; 
                                            ship.storage.map(a => goodsOnShip += a.quantity);
                                            let spaceAvailableOnShip = ship.hullCapacity - goodsOnShip;

                                            let quantityOfGoodsToBuy = +stages[i].quantity === -1 ? +good.quantity >= +spaceAvailableOnShip ? +spaceAvailableOnShip : +good.quantity : +spaceAvailableOnShip >= +stages[i].quantity ? +stages[i].quantity : +spaceAvailableOnShip;
                                            const priceOfGoods = pricing.getPrice(good.id, +good.quantity, planetToBuyFrom.population);

                                            // how much the player needs to pay...
                                            let monetaryCost = Math.floor(quantityOfGoodsToBuy * priceOfGoods.buy);

                                            if(monetaryCost >= ship.money) {
                                                // not enough for all the goods so recalculate based on what they do have...
                                                quantityOfGoodsToBuy = Math.floor(playerMoney / priceOfGoods);
                                                monetaryCost = Math.floor(quantityOfGoodsToBuy * priceOfGoods);
                                            }

                                            // add to the planet and take fromt he player
                                            shipGoods.quantity += quantityOfGoodsToBuy
                                            good.quantity -= quantityOfGoodsToBuy;

                                            ship.money -= Math.abs(monetaryCost);
                                            turnsUsed += stages[i].cost;
                                            turns -= stages[i].cost;
                                            log.push({ success: true, action: 'buy', from: planetToBuyFrom.name, good: +good.id, quantity: quantityOfGoodsToBuy, cost: monetaryCost, turns: 1 });

                                        } else {
                                            log.push({ success: false, action: 'buy', from: planetToBuyFrom.name, error: 'You are not able to trade with this planet.' })
                                        }
                                    } else {
                                        log.push({ success: false, action: 'buy', from: planetToBuyFrom.name, error: 'Ship and planet are not in the same sector as each other.' })
                                    }
                                    break;
                                    
                                case 'sell':
                                    const planetToSellTo = planetData.find(a => +a.id === +stages[i].planetId);
                                    // check we are in the same sector as the planet...
                                    if(currentSector === planetToSellTo.sectorid) {
                                        // check the planet is either owned by the user or has trading enabled...
                                        if(planetToSellTo.owner === userData.id || planetToSellTo.trading === 1) {
                                            // check if the ship has the goods to sell, and if not, sell the max up to that point...
                                            let good = ship.storage.find(a => +a.id === +stages[i].goodsType);
                                            let planetGoods = planetToSellTo.goods.find(a => +a.id === +stages[i].goodsType);

                                            // if the goods dont exist on either the ship or the planet then add it.
                                            if(!good) { ship.storage.push({ id: +stages[i].goodsType, name: pricing.getNameFromId(+stages[i].goodsType), quantity: 0 }); good = ship.storage[ship.storage.length -1]; console.log('c'); };
                                            if(!planetGoods) { planetToSellTo.goods.push({ id: +stages[i].goodsType, quantity: 0 }); planetGoods = planetToSellTo.goods[planetToSellTo.goods.length -1]; console.log('d'); };

                                            // this is the quantity and price of goods.
                                            const quantityOfGoodsToSell = +stages[i].quantity === -1 ? +good.quantity : +stages[i].quantity >= +good.quantity ? +good.quantity : +stages[i].quantity;
                                            const priceOfGoods = pricing.getPrice(+good.id, planetGoods.quantity, planetToSellTo.population).buy;

                                            // this is how much the player will get
                                            const cost = Math.floor(priceOfGoods * quantityOfGoodsToSell);

                                            // add to the planet and take fromt he player
                                            good.quantity -= quantityOfGoodsToSell;
                                            planetGoods.quantity += quantityOfGoodsToSell;

                                            // add to the players cahs pile...
                                            ship.money += Math.abs(cost);
                                            turnsUsed += stages[i].cost;
                                            turns -= stages[i].cost;
                                            log.push({ success: true, action: 'sell', from: planetToSellTo.name, good: +good.id, quantity: quantityOfGoodsToSell, cost: cost, turns: 1 });
                                        } else {
                                            log.push({ success: false, action: 'sell', from: planetToSellTo.name, error: 'You are not able to trade with this planet.' })
                                        }
                                    } else {
                                        log.push({ success: false, action: 'sell', from: planetToSellTo.name, error: 'Ship and planet are not in the same sector as each other.' })
                                    }
                                    break;
                            }
                            // push to the return log...                                    
                            returnLog.push(...log);
                            if(!returnLog[returnLog.length-1].success) break;
                        }
                        // if there is an error then stop, else continue running.
                        if(!returnLog[returnLog.length-1].success) break;
                        iterationsRun++;
                    }
                    
                    // whenever the same planet is traded twice in a row with a different good, this can
                    // be done in one turn, so run through the stages again and just check and balance...
                    for(let i = 0 ; i < stages.length - 1 ; i++) {
                        if(stages[i].action !== 'move' && stages[i+1] !== 'move') {
                            // if the goods types are different and the planetids are the same then take a turn off..
                            if(stages[i].goodsType !== stages[i+1].goodsType && stages[i].planetId === stages[i+1].planetId) {
                                turnsUsed--;
                                i++;
                            }
                        }
                    }
                    
                    let values = []; 

                    // build the new planet update data...
                    for(let i = 0 ; i < planetData.length ; i++) {
                        for(let o = 0 ; o < planetData[i].goods.length ; o++) {
                            const data = planetData[i].goods[o];
                            values.push([+data.id, +galaxyId, planetaryData[i].sectorid, planetData[i].index, data.quantity]);
                        }
                    }

                    // console.log(ship, ...planetData);
                    // NOW reupload everything back to the database and return the log to the user...
                    const updateShip = `UPDATE ships__users SET money = ${ship.money}, sector = ${ship.sector}, storage = '${JSON.stringify(ship.storage)}' WHERE userid = ${userData.id} AND galaxyid = ${galaxyId}`;
                    const updatePlanetData = `INSERT INTO universe__planetsgoods (goodid, galaxyid, sectorid, planetid, quantity) VALUES ? ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`;
                    const updateUsers = `UPDATE users__galaxies SET turnsUsed = turnsUsed + ${+turnsUsed} WHERE userid = ${userData.id} AND galaxyid = ${galaxyId}`;

                    db.query(`${updateShip} ; ${updatePlanetData} ; ${updateUsers}`, [values], (e, r) => {
                        // also needs to ensure the player has a display and data for the new sector they might be in...
                        if(!e) {
                            res.status(200).json({ error: false, message: '', data: { routeName: result[0][0].name, log: returnLog, turns: +turnsUsed, iterations: +iterationsRun }});
                        } else {
                            res.status(200).json({ error: true, message: 'Unable to query database(A4)', data: {}});
                        }
                    })
                } else res.status(400).json({ error: true, message: 'Error Querying Database (A2)', data: {}});
            })

        } else res.status(400).json({ error: true, message: 'Error Querying Database (A1)', data: {}});
    })
});

module.exports = router;