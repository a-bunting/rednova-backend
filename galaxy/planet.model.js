const methods = require('../methods/methods');

class Planet {

  distance; // in astronomical units
  solarRadiation; // in solar constants
  name; // the planet name

  constructor(star, lastPlanet, index, systemName, planetNumberInName) {
    this.distance = Math.random() * (index + 1) + lastPlanet;
    this.solarRadiation = star.power / Math.pow(this.distance, 2);
    this.name = methods.generateRandomSciFiName(index, systemName.split(' '), true, true, 2, 3, planetNumberInName);
  }

}

module.exports = Planet;