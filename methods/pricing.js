/**
 * Required goods first, these are goods which require other things such as population or organics.
 * All prices are returned as { sell: , buy: } 
 */
const goods = [
    { 
        goodName: 'organics', type: 'goods',
        cost: 10, max: 50, min: 1, costPerPopulation: 10, 
        price: function(quantity, population) { return goodsPrice(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }
    },
    { 
        goodName: 'goods', type: 'goods',
        cost: 50, max: 160, min: 25, costPerPopulation: 2, 
        price: function(quantity, population) { return goodsPrice(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }
    },
    { 
        goodName: 'energy', type: 'goods',
        cost: 4, max: 15, min: 1, costPerPopulation: 50, 
        price: function(quantity, population) { return goodsPrice(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }
    },
    { 
        goodName: 'constructionMats', type: 'goods',
        cost: 100, max: 300, min: 40, costPerPopulation: 10, 
        price: function(quantity, population) { return goodsPrice(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }
    },
    { 
        goodName: 'solarFarms', type: 'building', cost: 2000000,
        price: function(quantity, population = 0) { return buildingPrice(this.cost) }
    },
    { 
        goodName: 'factoriesGoods', type: 'building', cost: 400000,
        price: function(quantity, population = 0) { return buildingPrice(this.cost) }
    },
    { 
        goodName: 'factoriesConstruction', type: 'building', cost: 5000000,
        price: function(quantity, population = 0) { return buildingPrice(this.cost) }
    },
    { 
        goodName: 'farms', type: 'building', cost: 100000,
        price: function(quantity, population = 0) { return buildingPrice(this.cost) }
    }
]

/**
 * Fnction to call which returns the appropriate price for the good based upon the population and stock.
 * @param {*} stringId 
 * @param {*} quantityInStock 
 * @param {*} populationOfPlanet 
 * @returns 
 */
function getPrice(stringId, quantityInStock, populationOfPlanet) {
    const getGood = goods.find(a => a.goodName === stringId);
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

module.exports.getPrice = getPrice;