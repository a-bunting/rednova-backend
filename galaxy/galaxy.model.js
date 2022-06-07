const SolarSystem = require('../galaxy/solarSystem.model.js');

class Galaxy {

  systems = [];

  width;
  height;
  depth;

  constructor(width, height, depth, systemCount) {
    this.width = width;
    this.height = height;
    this.depth = depth;

    this.generate(width, height, depth, systemCount);
  }

  /**
   * Generate a new galaxy
   * normally will be done on restart of the game only but here for testing!
   * @param width
   * @param height
   * @param depth
   * @param systemCount
   */
  generate(width, height, depth, systemCount) {
    // generate a galaxy
    this.systems = this.generateCubeGalaxy(width, height, depth, systemCount);
    this.systems = this.generateWarpRoutes(this.systems);
  }

  sectorsMissed = 0;

  generateCubeGalaxy(width, height, depth, systemCount) {
    // number of stars per sector
    let starsPerSector = systemCount / (width * height * depth);
    let newGalaxy = [];

    for(let w = 0 ; w < width ; w++) {
      for(let h = 0 ; h < height ; h++) {
        for(let d = 0 ; d < depth ; d++) {
          // find the number of systems to generate
          let starDrop = Math.random() > 0.5 ? 1 : -1;
          let systems = starsPerSector - starsPerSector * 0.5 * starDrop * Math.random();
          
          // if there is not one star per system then make sure it will average out...
          if(systems < 1) {
            if(this.sectorsMissed >= 1) {
                systems = 1;
                this.sectorsMissed -= 1;
            } else {
                this.sectorsMissed += systems;
            }
          }
          
          systems = Math.floor(systems);

          // create a number of systems in this sector...
          for(let i = 0 ; i < systems ; i++) {
            let system = new SolarSystem(-0.5 * width + w + Math.random(), -height * 0.5 + h + Math.random(), -depth * 0.5 + d + Math.random());
            newGalaxy.push(system);
          }
        }
      }
    }

    return newGalaxy;
  }

  warpDistance = 2;
  warpRouteProbability = 0.2;

  /**
   * For each of the systems iterate over the other systems and find their distance
   * Once the distance is known filter by all within about 2 on the coordinate scale.
   *
   * Then pick a random quantity of those planets to forge warp routes to.
   *
   * @param galaxy
   */
  generateWarpRoutes(galaxy) {
    // iterate over all the systems in the galaxy...
    for(let i = 0 ; i < galaxy.length ; i++) {
      let routes = [];
      let a = galaxy[i];
      // filter out the far away stars
      let closeSystems = galaxy.filter((b) => {
        let d =
          Math.sqrt(Math.pow(a.coordinates.x - b.coordinates.x, 2) +
                    Math.pow(a.coordinates.y - b.coordinates.y, 2) +
                    Math.pow(a.coordinates.z - b.coordinates.z, 2)
                    )
        return d < this.warpDistance;
      });

      // iterate over all the close systems and, based upon probability, forge a route;
      for(let o = 0 ; o < closeSystems.length ; o++) {
        if(Math.random() < this.warpRouteProbability) {
          routes.push({ id: closeSystems[o].id, x: closeSystems[o].coordinates.x, y: closeSystems[o].coordinates.y, z: closeSystems[o].coordinates.z });
        }
      }

      a.warpRoutes = routes;
    }
    return galaxy;
  }

}

module.exports = Galaxy;