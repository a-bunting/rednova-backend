const methods = require('../methods/methods');

class Planet {

    distance; // in astronomical units
    solarRadiation; // in solar constants
    name; // the planet name
    fields; // how much space there is to build initially.
    population;

    products;  

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

        this.products = [
            { id: 'farms', name: 'Farms', current: farms, type: 'building' },
            { id: 'factoriesGoods', name: 'Goods Factories', current: factories, type: 'building' },
            { id: 'factoriesConstruction', name: 'Refinerys', current: refineries, type: 'building' },
            { id: 'solarFarms', name: 'Solar Farms', current: solarFarms, type: 'building' },
            { id: 'energy', name: 'Energy', current: Math.floor(Math.random() * this.solarRadiation * 20000000), type: 'good' },
            { id: 'organics', name: 'Organics', current: Math.floor(Math.random() * 20000000), type: 'good' },
            { id: 'goods', name: 'Goods', current: Math.floor(Math.random() * 10000000), type: 'good' }, 
            { id: 'constructionMats', name: 'Construction Materials', current: 0, type: 'good' }
        ]
        
    }

}

module.exports = Planet;