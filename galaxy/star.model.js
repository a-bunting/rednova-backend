class Star {

  power;
  size;
  rayDistance;
  numberOfRays;

  constructor() {
    // calculate a rnadom power.
    let one = Math.random() <= 0.5 ? 1 + Math.random() : Math.random();
    let ten = Math.random() <= 0.01 ? Math.random() * 10 : 0;
    let hundred = Math.random() <= 0.001 ? Math.random() * 100 : 0;
    let thousand = Math.random() <= 0.0001 ? Math.random() * 1000 : 0;
    this.power = one + ten + hundred + thousand;
    this.size = Math.max(Math.floor(Math.random() * 100), 30);
    this.rayDistance = Math.max(Math.floor(Math.random() * 360), 50);
    this.numberOfRays = Math.floor(Math.random() * 720);
  }

}

module.exports = Star;