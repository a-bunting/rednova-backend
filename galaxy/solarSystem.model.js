const Planet = require('../galaxy/planet.model');
const Star = require('../galaxy/star.model');
const methods = require('../methods/methods');

class SolarSystem {

  star;
  planets = [];
  warpRoutes = [];

  id;
  coordinates;

  size;

  constructor(x, y, z) {
    this.coordinates = { x, y, z };
    // sort planets out...
    let extraPlanets = Math.random() < 0.2 ? 5 : 1;
    let planetCount = Math.abs(Math.floor(Math.random() * (5 + extraPlanets) - 1));
    
    this.id = methods.generateRandomSciFiName(0, [], planetCount > 1, false, 2, 3, false);
    this.size = Math.floor(Math.random() * 2) + 1;

    // create a star for the system...
    this.star = new Star()

    for(let i = 0 ; i < planetCount ; i++) {
      let lastPlanetDistance = this.planets.length > 0 ? this.planets[this.planets.length - 1].distance : 0;
      this.planets.push(new Planet(this.star, lastPlanetDistance, i, this.id, planetCount > 1));
    }
  }

}

module.exports = SolarSystem;
