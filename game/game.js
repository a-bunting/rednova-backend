const WebSocket = require('ws');
const methods = require('../methods/methods');

class Game {
        
    // ticks
    tickCounter;
    ticksElapsed = 0;
    tickInterval = 1000;

    clients = new Map();
    
    constructor() {
        this.ticks();
        this.webSocketServer();
    }

    ticks() {
        this.tickCounter = setInterval(() => {
            const time = 5;
            const message = `Time: ${time} - tick!`;
            this.sendWebsockMessage(message);
            this.ticksElapsed++;
        }, this.tickInterval);
    }

    getTimeAlive() {
        return this.tickCounter * this.tickInterval;
    }

    webSocketServer() {
        const wss = new WebSocket.Server({ port: 7072 });

        wss.on('connection', (ws) => {
            const id = methods.generateRandomId(5);
            this.clients.set(ws, { id });
            
            ws.on('open', () => {
                console.log(`Client ${id} has connected.`)
                this.sendWebsockMessage(`User ${id} connected...`);
            });

            ws.on('message', (msg) => {
                const message = JSON.parse(msg);            
                console.log(message);
                this.sendWebsockMessage(`New user connected, ${id}`);
            });
            
            ws.on('close', () => {
                console.log(`Client ${id} has disconnected.`)
                this.clients.delete(ws);
            })
        })
        
        console.log("websockets functioning");
    }

    sendWebsockMessage(msg) {
        [...this.clients.keys()].forEach(client => {
            client.send(msg);
        });
    }
}

module.exports = Game;