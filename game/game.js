const WebSocket = require('ws');
const methods = require('../methods/methods');
const mysql = require('mysql');
const db = require('../environment');

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
            connection.query(getGalaxies, (e, galaxies) => {
                if(e) console.log(`Error getting servers: ${e}`);

                connection.destroy();

                // loop over each server setting up a tick cycle for each
                for(let i = 0 ; i < galaxies.length ; i++) {                    
                    let serverObject = {
                        id: galaxies[i].id, 
                        name: galaxies[i].name, 
                        size: { width: galaxies[i].width, height: galaxies[i].height, depth: galaxies[i].depth },
                        tickPeriod: galaxies[i].tickPeriod, 
                        startingTurns: galaxies[i].startTurns, 
                        time: { start: galaxies[i].timeStartUnix, end: galaxies[i].timeEndUnix, sinceStart: galaxies[i].tDiff }
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
            })
        })
    }

    tick(galaxyId) {
        const server = this.servers.find(server => server.id === galaxyId);
        const message = { type: 'tick', message: '', data: { quantity: 1, timeUntilNextTick: server.tickPeriod }};
        this.sendWebsockMessage(message, galaxyId);
    }
    
    getTimeAlive() {
        return this.tickCounter * this.tickInterval;
    }
    


    clients = [];
    wss;

    webSocketServer() {
        this.wss = new WebSocket.Server({ port: 7072 });

        this.wss.on('connection', (ws) => {
            const id = methods.generateRandomId(5);
            this.clients.push({socket: ws, data: { id: id, subscribed: false, email: '', username: '', galaxyId: -1 }});
            
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

    sendWebsockMessage(msg, galaxyId) {
        this.clients.forEach(client => {
            if(!client.data.subscribed) return;
            if(galaxyId) {
                // send only to this galaxy
                if(client.data.galaxyId === galaxyId) {
                    client.socket.send(JSON.stringify(msg));
                }
            } else {
                // send to all galaxies...
                client.socket.send(JSON.stringify(msg));
            }
        });
    }
}

module.exports = Game;