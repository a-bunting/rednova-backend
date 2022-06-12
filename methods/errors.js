function returnError(message) {
    console.log(message);
    res.status(400).json({ error: true, message: message, data: {} })
}
