const express = require('express');
const Game = require("./game/game");
const bodyParser = require('body-parser');

const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const moveRoutes = require('./routes/move');
const galaxyRoutes = require('./routes/galaxy');
const planetRoutes = require('./routes/planet');
const router = require('./routes/admin');

const app = express();
const game = new Game();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
})


// all the various api calls...
// admin
app.use("/api/administration", adminRoutes);

// add to the game to any api call so websockets may be used in the routes except for admin
// to shield admin changes from websockets.
app.use((req, res, next) => { req['game'] = game; next(); })

// general game api calls
app.use("/api/user", userRoutes);
app.use("/api/move", moveRoutes);
app.use("/api/galaxy", galaxyRoutes);
app.use("/api/planet", planetRoutes);

module.exports = app;
