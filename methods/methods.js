const jwt = require('jsonwebtoken');

/**
 * Generates a rnadom ID
 * @returns
 */
function generateRandomId(characterCount = 7, randomWords = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    let newCode = '';
    // generate an id
    for(let i = 0 ; i < characterCount ; i++) {
        let randomNumber = Math.floor(Math.random() * randomWords.length)
        newCode += randomWords.charAt(randomNumber);
    }
  return newCode;
}

/**
 * Generate a sci fi name for the system
 * @param {*} orderInSystem 
 * @param {*} systemName 
 * @param {*} number 
 * @param {*} romanNumerals 
 * @param {*} wordCount 
 * @param {*} numberCount 
 * @param {*} includeOrderInName 
 * @returns 
 */
function generateRandomSciFiName(orderInSystem, systemName = [], number = true, romanNumerals = true, wordCount = 2, numberCount = 3, includeOrderInName = true) {
    const wordList = [
        ['Proxima', 'Alpha', 'Beta', 'Gamma', 'EO', 'IO', 'Wolf', 'Stellar', 'Sol', 'Icarus', 'Jenova', 'Terra', 'Azati', 'Ulysses'],
        ['Centaui', 'Prime', 'Candidate', 'Firma', 'Homeworld']
    ];

    let planetName = systemName;

    // do the words first...
    if(systemName.length === 0) {
        for(let i = 0 ; i < wordCount ; i++) { 
          planetName.push(wordList[i][Math.floor(wordList[i].length * Math.random())]); 
        }
        // if the sector has a number in its number
        if(number) planetName.push(generateRandomId(numberCount, '0123456789'));
    }

    // if it needs a planetary order...
    if(includeOrderInName) { romanNumerals ? planetName.push(romanize(orderInSystem + 1)) : planetName.push(orderInSystem + 1); }

    // return the name
    return planetName.join(' ');
}

/**
 * Gets the header info from a request and decodes the token to return the user id.
 * @param {*} req
 * @returns
 */
function getUserDataFromToken(req) {
    // decode the token to get the userid without having the user send it.
    const token = req.headers.authorization.split(" ")[1];
    const userData = jwt.decode(token);
    return userData;
}

/**
 * Convert a number to roman numerals
 * https://stackoverflow.com/questions/9083037/convert-a-number-into-a-roman-numeral-in-javascript - taken from here.
 * @param {*} num 
 * @returns 
 */
function romanize (num) {
    if (isNaN(num))
        return NaN;
    var digits = String(+num).split(""),
        key = ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM",
               "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
               "","I","II","III","IV","V","VI","VII","VIII","IX"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}

module.exports.generateRandomId = generateRandomId;
module.exports.getUserDataFromToken = getUserDataFromToken;
module.exports.generateRandomSciFiName = generateRandomSciFiName;
