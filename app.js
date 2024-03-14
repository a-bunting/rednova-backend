const express = require('express');
const Game = require("./game/game");
const bodyParser = require('body-parser');
const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    next();
});

const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const moveRoutes = require('./routes/move');
const galaxyRoutes = require('./routes/galaxy');
const planetRoutes = require('./routes/planet');
const tradeRoutes = require('./routes/trade');
const router = require('./routes/admin');


const game = new Game();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// all the various api calls...

// to shield admin changes from websockets.
// add to the game to any api call so websockets may be used in the routes except for admin
app.use((req, res, next) => { req['game'] = game; next(); })

// admin
app.use("/api/administration", adminRoutes);
// general game api calls
app.use("/api/user", userRoutes);
app.use("/api/move", moveRoutes);
app.use("/api/galaxy", galaxyRoutes);
app.use("/api/planet", planetRoutes);
app.use("/api/trade", tradeRoutes);

module.exports = app;
