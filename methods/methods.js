const jwt = require('jsonwebtoken');

/**
 * Generates a rnadom ID
 * @returns
 */
function generateRandomId(characterCount = 7) {
    const randomWords = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let newCode = '';
    // generate an id
    for(let i = 0 ; i < characterCount ; i++) {
        let randomNumber = Math.floor(Math.random() * randomWords.length)
        newCode += randomWords.charAt(randomNumber);
    }
  return newCode;
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

module.exports.generateRandomId = generateRandomId;
module.exports.getUserDataFromToken = getUserDataFromToken;
