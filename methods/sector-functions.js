const { connect } = require('mongoose');
const mysql = require('mysql');
const db = require('../environment');
const methods = require('../methods/methods');

/**
 * All this does is update the logs database when the user enters a new sector.
 * Will not add duplicates.
 * @param {*} userid 
 * @param {*} sectorId 
 * @param {*} galaxyid 
 */
function setUserVisitedSector(userid, sectorId, galaxyid) {
    const connection = mysql.createConnection(db);
    const sql = `INSERT INTO ships__logs (userid, galaxyid, sectorid) VALUES (${userid}, ${galaxyid}, ${sectorId})`;

    connection.connect(connErr => {
        connection.query(sql, (e, r) => {
            connection.destroy();
            
            if(e) { return false; }
            return true;
        })
    })
}

module.exports.setUserVisitedSector = setUserVisitedSector;