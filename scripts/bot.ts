import { ethers } from 'ethers';
import Futures from '../artifacts/contracts/Futures.sol/Futures.json';
import sqlite3 from 'sqlite3';

const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545/'); // Local RPC url.
const contractAddress = '0x9d136eEa063eDE5418A6BC7bEafF009bBb6CFa70'; // This is the local deployed address. Change this after new deployment
const privateKey = process.env.PRIVATE_KEY || '';

// Instantiate the smart contract
const futures = new ethers.Contract(contractAddress, Futures.abi, provider);

// Configure the bot's account
const wallet = new ethers.Wallet(privateKey, provider);
const botContractWithSigner = futures.connect(wallet);

let db: sqlite3.Database;
const openDBPromise = new Promise(
    (resolve, reject) => {
        db = new sqlite3.Database('./events.db', err => {
            if (err) reject(err);
            else resolve(db);
        });
    }
);


// Function to monitor active bets
async function monitorActiveBets() {
    await openDBPromise;
    const query = 'SELECT betId, closingTime FROM events';
    db.all(query, async (err, rows) => {
        for (const row of rows) {
            const bet = row as any;
            const currentTime = Math.floor(Date.now() / 1000);

            if (currentTime >= bet.closingTime) {
                try {
                    const transaction = await botContractWithSigner.closeBet(bet.betId);
                    await transaction.wait();

                    console.log(`Bet ${bet.betId} closed.`);
                } catch (error) {
                    console.error(`Error closing bet ${bet.betId}:`, error);
                }
            }
        }
    });
}

// Start monitoring active bets
monitorActiveBets();
