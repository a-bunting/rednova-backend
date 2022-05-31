const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/check-auth');

require('../galaxy/galaxy.model');

router.get('/generateUniverse', (req, res, next) => {
    const width = req.body.w;
    const height = req.body.h;
    const depth = req.body.d;
    const stars = req.body.s;

    const galaxy = new Galaxy(width, height, depth, stars);

});

module.exports = router;