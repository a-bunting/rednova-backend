// check sif a token is attached...
// validate token...
const jwt = require('jsonwebtoken');

// middleware simple returns a function...
module.exports = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        jwt.verify(token, 'rednova-v2-token-this-is-to-ensure-you-are-safe-trade-well-my-friendly-peoples');
        next();
    } catch (error) {
        res.status(401).json({
            message: `Authentication Failed - No Token: ${error}`
        })
    }
}
