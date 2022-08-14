const db = require('../database');

/**
 * All this does is update the logs database when the user enters a new sector.
 * Will not add duplicates.
 * @param {*} userid 
 * @param {*} sectorId 
 * @param {*} galaxyid 
 */
function setUserVisitedSector(userid, sectorId, galaxyid) {
    const sql = `INSERT INTO ships__logs (userid, galaxyid, sectorid) VALUES (${userid}, ${galaxyid}, ${sectorId})`;

    db.query(sql, (e, r) => {        
        if(e) { return false; }
        return true;
    })
}

module.exports.setUserVisitedSector = setUserVisitedSector;