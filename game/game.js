const WebSocket = require('ws');
const methods = require('../methods/methods');

class Game {
        
    // ticks
    tickCounter;
    ticksElapsed = 0;
    tickInterval = 1000;

    
    constructor() {
        this.ticks();
        this.webSocketServer();
    }
    
    ticks() {
        this.tickCounter = setInterval(() => {
            const time = 5;
            const message = { type: 'tick', message: '', data: { quantity: 1 }};
            this.sendWebsockMessage(message);
        }, this.tickInterval);
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
            this.clients.push({socket: ws, data: { id }});
            console.log(`Client ${id} has connected.`)

            ws.on('message', (msg) => {
                const message = JSON.parse(msg);         
                console.log(message);
            });

            ws.on('close', () => {
                console.log(`Client ${id} has disconnected`);
                this.clients = this.clients.filter(client => client.socket !== ws);
            })

        })
    }

    sendWebsockMessage(msg) {
        this.clients.forEach(client => {
            console.log(JSON.parse(JSON.stringify(msg)));
            client.socket.send(JSON.stringify(msg));
        });
    }
}

module.exports = Game;