const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env.sh') });
const { Connection } = require('./connection');
const cs304 = require('./cs304');

const mongoUri = cs304.getMongoUri();
const counter = require('./counter-utils.js')

// REPLACE WITH YOUR OWN USERNAME ("og102", for example)
const myDBName = "wave";


/**
* This is the main function, and is where functions are called and tested. It will also log results returned by functions.
*/
async function main() {
    const db = await Connection.open(mongoUri, myDBName);
    
    const eventsCursor = await db.collection('events').find({});
        const events = await eventsCursor.toArray();
        console.log("Events:");
        console.log(events);
    const usersCursor = await db.collection('users').find({});
        const users = await usersCursor.toArray();
        console.log("Users:");
        console.log(users);

    await Connection.close();
}
main();