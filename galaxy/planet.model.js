import { Star } from "./star.model";

export class Planet {

  distance; // in astronomical units
  solarRadiation; // in solar constants

  constructor(star, lastPlanet, index) {
    this.distance = Math.random() * (index + 1) + lastPlanet;
    this.solarRadiation = star.power / Math.pow(this.distance, 2);
  }

}
