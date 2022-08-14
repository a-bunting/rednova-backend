const WebSocket = require('ws');
const methods = require('../methods/methods');
const mysql = require('mysql');
const db = require('../environment');
const pricing = require('../methods/pricing');

class Game {
        
    // ticks
    servers = [];
    timeoutServerStarts = [];
    tickCounter = [];
    ticksElapsed = 0;
    tickInterval = 60000;

    constructor() {
        this.setUpServers();
        this.webSocketServer();
    }

    setUpServers() {
        const connection = mysql.createConnection(db);
        const getGalaxies = `SELECT id, name, width, height, depth, tickPeriod, startTurns, TIMESTAMPDIFF(SECOND, startTime, CURRENT_TIMESTAMP()) AS tDiff, UNIX_TIMESTAMP(startTime) as timeStartUnix, UNIX_TIMESTAMP(endTime) as timeEndUnix  FROM universe__galaxies WHERE startTime < NOW() AND endTime > NOW()`;

        connection.connect(connectionError => {
            if(connectionError) console.log(`Error connecting to MySQL to retrive servers: ${connectionError}`);
            connection.query(getGalaxies, (e, galaxies) => {
                if(e) console.log(`Error getting servers: ${e}`);

                connection.destroy();

                // loop over each server setting up a tick cycle for each
                for(let i = 0 ; i < galaxies.length ; i++) {   
                    
                    this.createServer(
                        galaxies[i].id, 
                        galaxies[i].name, 
                        galaxies[i].width, galaxies[i].height, galaxies[i].depth,
                        galaxies[i].tickPeriod, 
                        galaxies[i].startTurns, 
                        galaxies[i].timeStartUnix, galaxies[i].timeEndUnix
                    );
                }
            })
        })
    }

    createServer(galaxyId, galaxyName, w, h, d, tickPeriod, startTurns, timeStart, timeEnd, ) {

        const currentDateTime = Math.floor(new Date().getTime() / 1000);
        const tDiff = currentDateTime - timeStart;

        let serverObject = {
            id: galaxyId, 
            name: galaxyName, 
            size: { width: w, height: h, depth: d },
            tickPeriod: tickPeriod, 
            startingTurns: startTurns, 
            time: { start: timeStart, end: timeEnd, sinceStart: tDiff }
        }

        // push onto the server array
        this.servers.push(serverObject);

         // now get the remainer of the time for a tick
         const initialTickTime = serverObject.tickPeriod - (serverObject.time.sinceStart % serverObject.tickPeriod);

         console.log(`Server for galaxy ${serverObject.id} (${serverObject.name}) has a first tick in ${initialTickTime}`);

         setTimeout(() => {
             this.tick(serverObject.id);
             console.log(`Server for galaxy ${serverObject.id} is now on a ticktimer of ${serverObject.tickPeriod}s - there will be no more logs from this server...`);
             // once the first timeout occurs, thats the first tick ended and the server can proceed with a tick per tick interval
             const serverInterval = setInterval(() => {
                 this.tick(serverObject.id);
             }, serverObject.tickPeriod * 1000)  
         }, initialTickTime * 1000);
    }

    destroyServer(galaxyId) {
        const galaxy = this.servers.findIndex(a => a.id === galaxyId);
        this.servers.splice(galaxy, 1);
        console.log(`Destroyed galaxy number ${galaxyId}`);
    }

    /**
     * PROCESSES THE DIFFERENT ELEMENTS OF A TICK
     * Does not yet
     * -- Deal with the IGB
     * -- Destroy population if the amount needed ot sustain them is not present
     * @param {*} galaxyId 
     */
    tick(galaxyId) {
        console.log(`Tick on Galaxy ${galaxyId}`);
        this.tickSendUserMessage(galaxyId); // works
        this.tickUpdatePlanets(galaxyId);   // works
        this.tickupUpdatePopulation(galaxyId);// untested
    }

    /**
     * Updates the population on each planet
     * With a 1 min turn rate, it will go from 50000 to 100 mill pop in 30 days ish
     * every 3 days the population will double on its own
     * @param {*} galaxyId 
     */
    tickupUpdatePopulation(galaxyId) {
        const connection = mysql.createConnection(db);
        const sql = `UPDATE universe__planets SET population = population * 1.00016 WHERE galaxyid=${galaxyId}`;
        
        connection.connect(conErr => {
            connection.query(sql, (e, r) => {
                connection.destroy();
                // return true if it passes.
                if(!e) return true;
                else return false;
            })
        })
    }

    tickIGB(galaxyId) {
        // for later
    }

    /**
     * Updates the planets money and resources
     * @param {*} galaxyId 
     */
    tickUpdatePlanets(galaxyId) {

        const connection = mysql.createConnection({...db, multipleStatements: true});
        const planetQuery = `   SELECT sectorid, planetindex, population, distance, solarRadiation, onPlanet, currency
                                FROM universe__planets 
                                WHERE galaxyid=${galaxyId}`;

        connection.connect(conErr => {
            connection.query(planetQuery, (e, planets) => {
                
                const goods = pricing.getGoodsObject();

                // the empoty arrays which will do the query...
                let massGoodsArray = [];
                let massPlanetInterest = [];

                // loop over each planet...
                for(let i = 0 ; i < planets.length ; i++) {
                    const planet = { ...planets[i], buildings: JSON.parse(planets[i].onPlanet) };
                    
                    // do the goods
                    for(let o = 0 ; o < goods.length ; o++) {
                        if(goods[o].type === `goods`) {
                            const addition = goods[o].tick(planet);
                            // the match and the set arrays...
                            massGoodsArray.push([goods[o].id, galaxyId, planet.sectorid, planet.planetindex, Math.floor(addition ? addition : 0)]);
                        }
                    }

                    // planetary interest
                    const newMoney = Math.ceil((planet.population / 100000000) * (0.00048 + 1)) * planet.currency;
                    massPlanetInterest.push([galaxyId, planet.sectorid, planet.planetindex, newMoney]);
                }

                // update query
                const updateGoodsSql = `INSERT INTO universe__planetsgoods (goodid, galaxyid, sectorid, planetid, quantity) VALUES ? ON DUPLICATE KEY UPDATE quantity = IF(quantity + VALUES(quantity) < 0, 0, quantity + VALUES(quantity));
                                        INSERT INTO universe__planets (galaxyid, sectorid, planetindex, currency) VALUES ? ON DUPLICATE KEY UPDATE currency = VALUES(currency)`;

                // and update...
                connection.query(updateGoodsSql, [massGoodsArray, massPlanetInterest], (e, r) => {
                    connection.destroy();

                    if(!e) return true;
                    return false;
                })
             })
        })
    }

    getServer(galaxyId) {
        const galaxy = this.servers.find(a => a.id === +galaxyId);
        return galaxy;
    }

    /**
     * Sends users within a galaxy a message to let them know a tick has taken place
     * @param {*} galaxyId 
     */
    tickSendUserMessage(galaxyId) {
        const server = this.servers.find(server => server.id === galaxyId);
        const message = { type: 'tick', message: '', data: { quantity: 1, timeUntilNextTick: server.tickPeriod }};
        this.sendWebsockMessage(message, galaxyId);
    }

    clients = [];
    wss;

    webSocketServer() {
        this.wss = new WebSocket.Server({ port: 7072 });

        this.wss.on('connection', (ws) => {
            const id = methods.generateRandomId(5);
            this.clients.push({socket: ws, data: { id: id, subscribed: false, email: '', username: '', galaxyId: -1, sector: -1  }});
            
            ws.on('message', (msg) => {
                const message = JSON.parse(msg);     
                
                if(message.type === `sub`) {
                    // this may be initial user data to add to the client.
                    let user = this.clients.find(client => client.data.id === id);
                    // chekc if user is found and not already subscribed.
                    if(user && user.data.subscribed === false) {
                        console.log(`${message.username} has connected.`)
                        user.data.subscribed = true;
                        user.data.email = message.email;
                        user.data.username = message.username;
                        user.data.galaxyId = +message.galaxyId;

                        const serverObject = this.servers.find(a => a.id === user.data.galaxyId);

                        if(!serverObject) {
                            // galaxy not found, send user back to main page.
                            this.sendWebsockMessage(JSON.stringify(
                                { type: 'criticalServerFailure', message: 'Galaxy not found...', data: { } }
                            ), user.data.galaxyId, user);
                        } else {
                            // galaxy found and can be subscribed to
                            const initialTickTime = serverObject.tickPeriod - (serverObject.time.sinceStart % serverObject.tickPeriod);
                            const initialMessage = { type: 'subscribed', message: '', data: { timeUntilNextTick: initialTickTime } };
                            this.sendWebsockMessage(JSON.stringify(initialMessage), user.data.galaxyId, user);
                        }
                    }
                } else console.log(`Message from ${message.username}: ${msg}`);
            });

            ws.on('close', () => {
                console.log(`Client ${id} has disconnected`);
                const clientId = this.clients.findIndex(client => client.data.id === id);

                if(clientId !== -1) {
                    this.clients[clientId].socket.close();
                    this.clients.splice(clientId, 1);
                }
            })

        })
    }
    
    /**
     * Returns the sector that a user is in
     * @param {string} email 
     * @param {number} galaxyid 
     * @param {number} sector 
     */
    setUsersSector(email, galaxyid, sector) {
        const user = this.clients.find(a => (a.data.email === email && a.data.galaxyId === +galaxyid));
        if(user) user.data.sector = sector;
    }

    /**
     * Sends a message either to all players on all galaxies, all players on a galaxy or to players in a single sector of a single galaxy
     * @param {JSON} msg 
     * @param {number} galaxyId 
     * @param {number} sectorId 
     */
    sendWebsockMessage(msg, galaxyId, sectorId) {

        this.clients.forEach(client => {
            if(!client.data.subscribed) return;
            if(galaxyId) {
                // send only to this galaxy
                if(client.data.galaxyId === galaxyId) {
                    if(sectorId) {
                        // only send to a specific sectors occupants
                        // data on trades on planets for example
                        if(client.data.sector === +sectorId) {
                            client.socket.send(JSON.stringify(msg));
                        }
                    } else {
                        client.socket.send(JSON.stringify(msg));
                    }
                }
            } else {
                // send to all galaxies and all players...
                client.socket.send(JSON.stringify(msg));
            }
        });
    }
}

module.exports = Game;