import { ethers } from 'ethers';
import sqlite3 from 'sqlite3';
import Futures from '../artifacts/contracts/Futures.sol/Futures.json';

const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/');
const contractAddress = '0x9d136eEa063eDE5418A6BC7bEafF009bBb6CFa70';

// Instantiate the smart contract
const betContract = new ethers.Contract(contractAddress, Futures.abi, provider);

// Connect to the SQLite database
let db: sqlite3.Database;
const openDBPromise = new Promise(
    (resolve, reject) => {
        db = new sqlite3.Database('./events.db', err => {
            if (err) reject(err);
            else resolve(db);
        });
    }
);

// Create the 'events' table if it doesn't exist
const createQuery = `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,    
  isActive BOOLEAN DEFAULT false,
  betId INTEGER,
  userA TEXT,
  side TEXT,
  betAmount INTEGER,
  expirationTime INTEGER,
  closingTime INTEGER,
  userB TEXT,
  winner TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)
`;

// Function to listen and store the events
async function listenAndStoreEvents() {
    // Wait for the connection to be established
    await openDBPromise;

    // Run the create query
    db.run(createQuery);

    // Start listening for events
    betContract.on('BetOpened', (betId, userA, side, betAmount, expirationTime, closingTime) => {
        const query = `INSERT INTO events (betId, userA, side, betAmount, expirationTime, closingTime)
        VALUES (?, ?, ?, ?, ?, ?)`;
        db.run(query, [betId, userA, side, betAmount, expirationTime, closingTime], (err) => {
            if (err) {
                console.error('Error storing event:', err);
            } else {
                console.log('Event BetOpened:', betId);
            }
        });
    });

    betContract.on('BetJoined', (betId, userB) => {
        const query = `
                        UPDATE events
                        SET userB = ?,
                            isActive = ?
                        WHERE betId = ?      
                    `;
        const values = [userB, true, betId];
        db.run(query, values, (err) => {
            if (err) {
                console.error('Error storing event:', err);
            } else {
                console.log('Event BetJoined:', betId);
            }
        });
    });

    betContract.on('BetClosed', (betId, winner) => {
        const query = `
                        UPDATE events
                        SET winner = ?,
                            isActive = ?
                        WHERE betId = ?
                        AND eventName = 'BetOpened'
                    `;

        const values = [winner, false, betId];

        db.run(query, values, (err) => {
            if (err) {
                console.error('Error storing event:', err);
            } else {
                console.log('Event BetClosed:', betId);
            }
        });
    });

    console.log('started listening events');
}

listenAndStoreEvents();
