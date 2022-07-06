function returnError(message, res) {
    console.log(message);
    res.status(400).json({ error: true, message: message, data: {} })
}

module.exports.returnError = returnError;