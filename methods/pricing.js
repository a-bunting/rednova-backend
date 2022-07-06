/**
 * Required goods first, these are goods which require other things such as population or organics.
 * All prices are returned as { sell: , buy: } 
 */
const goods = [
    { 
        type: 'goods', name: 'Organics', id: 1,
        cost: 10, max: 50, min: 1, costPerPopulation: 10, 
        price: function(quantity, population) { return goodsPrice(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) },
        tick: function(planet) { 
            const farms = planet.buildings.find(a => a.id === 8).quantity;
            const solarRadiation = planet.solarRadiation;
            const populationRequirements = planet.population * this.costPerPopulation;
            const newGeneration = farms * 5000000 * Math.pow(solarRadiation, 0.25);
            return newGeneration - populationRequirements;
        }
    },
    { 
        type: 'goods', name: 'Goods', id: 2,
        cost: 50, max: 160, min: 25, costPerPopulation: 2, 
        price: function(quantity, population) { return goodsPrice(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }, 
        tick: function(planet) { return 1; }
    },
    { 
        type: 'goods', name: 'Energy', id: 3,
        cost: 4, max: 15, min: 1, costPerPopulation: 50, 
        price: function(quantity, population) { return goodsPrice(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }, 
        tick: function(planet) { return 1; }
    },
    { 
        type: 'goods', name: 'Construction Materials', id: 4,
        cost: 100, max: 300, min: 40, costPerPopulation: 10, 
        price: function(quantity, population) { return goodsPrice(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }, 
        tick: function(planet) { return 1; }
    },
    { 
        type: 'building', cost: 2000000, name: 'Solar Farms', id: 5, 
        price: function(quantity, population = 0) { return buildingPrice(this.cost) }, 
        tick: function(planet) { return 1; }
    },
    { 
        type: 'building', cost: 400000, name: 'Factories', id: 6, 
        price: function(quantity, population = 0) { return buildingPrice(this.cost) }, 
        tick: function(planet) { return 1; }
    },
    { 
        type: 'building', cost: 5000000, name: 'Plants', id: 7, 
        price: function(quantity, population = 0) { return buildingPrice(this.cost) }, 
        tick: function(planet) { return 1; }
    },
    { 
        type: 'building', cost: 100000, name: 'Farms', id: 8,
        price: function(quantity, population = 0) { return buildingPrice(this.cost) }, 
        tick: function(planet) { return 1; }
    }
]

function getNameFromId(id) { return goods.find(a => a.id === id).name; }

/**
 * Fnction to call which returns the appropriate price for the good based upon the population and stock.
 * @param {*} stringId 
 * @param {*} quantityInStock 
 * @param {*} populationOfPlanet 
 * @returns 
 */
function getPrice(id, quantityInStock, populationOfPlanet) {
    const getGood = goods.find(a => a.id === id);
    if(!getGood) return undefined;

    switch(getGood.type) {
        case 'goods': return getGood.price(quantityInStock, populationOfPlanet); break;
        case 'building': return getGood.price(quantityInStock); break;
        default: return undefined;
    }

    
}

function buildingPrice(basePrice) {
    return basePrice;
}

function goodsPrice(basePrice, quantity, population, costPerPopulation, max, min) {
    const surplus = quantity - (costPerPopulation * population);
    const organicDeficitPerPopulation = surplus / population;
    const low = basePrice - Math.sqrt(0.5 * organicDeficitPerPopulation);
    const high = (basePrice - 1) * Math.exp(-0.1 * organicDeficitPerPopulation);

    // no deficit or suplus, so return the base price...
    return {
        sell: surplus === 0 ? costPerPopulation : surplus > 0 ? low > min ? low : min : high < max ? high : max, 
        buy: (surplus === 0 ? costPerPopulation - 0.5 : surplus > 0 ? (low > min ? low : min) : (high < max ? high : max)) - 0.5
    };
}

function getGoodsObject() {
    return goods;
}

module.exports.getNameFromId = getNameFromId;
module.exports.getPrice = getPrice;
module.exports.getGoodsObject = getGoodsObject;
