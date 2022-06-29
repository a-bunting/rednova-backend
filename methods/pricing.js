/**
 * Required goods first, these are goods which require other things such as population or organics.
 * All prices are returned as { sell: , buy: } 
 */
const goods = [
    { 
        goodName: 'organics', 
        cost: 10, max: 50, min: 1, costPerPopulation: 10, 
        price: function(quantity, population) { return price(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }
    },
    { 
        goodName: 'goods', 
        cost: 50, max: 160, min: 25, costPerPopulation: 2, 
        price: function(quantity, population) { return price(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }
    },
    { 
        goodName: 'energy', 
        cost: 4, max: 15, min: 1, costPerPopulation: 50, 
        price: function(quantity, population) { return price(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }
    },
    { 
        goodName: 'constructionMats', 
        cost: 100, max: 300, min: 40, costPerPopulation: 10, 
        price: function(quantity, population) { return price(this.cost, quantity, population, this.costPerPopulation, this.max, this.min) }
    }
]

function getPrice(stringId, quantityInStock, populationOfPlanet) {
    const getGood = goods.find(a => a.goodName === stringId);

    if(getGood) return getGood.price(quantityInStock, populationOfPlanet); 
    return undefined;
}

function price(basePrice, quantity, population, costPerPopulation, max, min) {
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