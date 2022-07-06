const methods = require('../methods/methods');
const pricing = require('../methods/pricing');

class Planet {

    distance; // in astronomical units
    solarRadiation; // in solar constants
    name; // the planet name
    fields; // how much space there is to build initially.
    population;

    products;  
    buildings;

    constructor(star, lastPlanet, index, systemName, planetNumberInName) {
        this.distance = Math.random() * (index + 1) + lastPlanet;
        this.solarRadiation = star.power / Math.pow(this.distance, 2);
        this.name = methods.generateRandomSciFiName(index, systemName.split(' '), true, true, 2, 3, planetNumberInName);
        this.fields = 400 * this.distance * ((Math.random() / 2) + 0.5);

        // eventually in a game organics will only be enough to satisfy a constant population
        // need to ensure when the algorithms are decided that the population starst low enough that
        // organics are a viable trading tool.
        const minPopulation = 5000;
        const maxPopulation = 500000;
        this.population = minPopulation + Math.floor(Math.random() * (maxPopulation - minPopulation));
        
        // buildings in total should not surpass the total fields available...
        const maxFieldUsage = 0.4 * this.fields * (this.population / maxPopulation);
        const factories     = Math.floor(Math.random() * 0.10  * maxFieldUsage);
        const refineries    = Math.floor(Math.random() * 0.003 * maxFieldUsage);
        const farms         = Math.floor(Math.random() * 0.83  * maxFieldUsage);
        const solarFarms    = Math.floor(Math.random() * 0.05  * maxFieldUsage);

        this.buildings = [
            { id: 8, name: pricing.getNameFromId(8), quantity: farms },
            { id: 6, name: pricing.getNameFromId(6), quantity: factories },
            { id: 7, name: pricing.getNameFromId(7), quantity: refineries },
            { id: 5, name: pricing.getNameFromId(5), quantity: solarFarms },
        ];
          
        this.products = [
            { id: 2, name: pricing.getNameFromId(2), quantity: Math.floor(Math.random() * this.solarRadiation * 20000000) },
            { id: 1, name: pricing.getNameFromId(1), quantity: Math.floor(Math.random() * 20000000) },
            { id: 3, name: pricing.getNameFromId(3), quantity: Math.floor(Math.random() * 10000000) }, 
            { id: 4, name: pricing.getNameFromId(4), quantity: 0 }
        ]
        
    }

}

module.exports = Planet;