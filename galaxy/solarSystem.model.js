import { Planet } from "./planet.model";
import { Star } from "./star.model";

export class SolarSystem {

  star;
  planets = [];
  warpRoutes = [];

  id;
  coordinates;

  size;

  constructor(x, y, z) {
    this.coordinates = { x, y, z };
    this.id = '' + (Math.random() * 100000); // temp
    this.size = Math.floor(Math.random() * 2) + 1;

    // create a star for the system...
    this.star = new Star()

    // sort planets out...
    let extraPlanets = Math.random() < 0.2 ? 5 : 1;
    let planetCount = Math.abs(Math.floor(Math.random() * (5 + extraPlanets) - 1));

    for(let i = 0 ; i < planetCount ; i++) {
      let lastPlanetDistance = this.planets.length > 0 ? this.planets[this.planets.length - 1].distance : 0;
      this.planets.push(new Planet(this.star, lastPlanetDistance, i));
    }
  }

}
