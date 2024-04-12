const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env.sh') });
const { Connection } = require('./connection');
const cs304 = require('./cs304');

const mongoUri = cs304.getMongoUri();
//const counter = require('./counter-utils.js')

// REPLACE WITH YOUR OWN USERNAME ("og102", for example)
const myDBName = "wave";


/**
* This function inserts an event/user into the specified collection.
* @param {db} The database to edit.
* @param {coll} The collection to add document to—either event or users.
* @param {dict} Dict with values you want to add to collection
* @returns the result after the pet is added to the collection.
*/
function add(db, coll, dict) {
let result = db.collection(coll).insertOne(dict);
//counter.incr(counters, collectionName);
return result;
}


/**
* This function deletes all documents in a given collection
* @param {db} The database to read from.
* @param {namePet} The name of the pet to be searched.
* @returns the document after searching the collection by pet name.
*/
function resetDB(db, coll) {
return db.collection(coll).deleteMany({});
}

/**
* This function deletes a user, which is specified by their id, from a collection.
* @param {db} The database to delete from.
* @param {namePet} The name of the user to delete.
*/
function deleteUser(db, userId) {
db.collection('users').deleteOne({userId: userId });
}


/**
* This is the main function, and is where functions are called and tested. It will also log results returned by functions.
*/
async function main() {
const db = await Connection.open(mongoUri, myDBName);

await resetDB(db, 'users')
await resetDB(db, 'events')
await add(db, 'users', {name: "Maria del Granado", userId:1, wellesleyEmail: 'md103@wellesley.edu', friends: [2,3,4]
, rsvp:[123,102], hosting: [123]});
await add(db, 'users', {name: "Arya Wu",userId:2, wellesleyEmail: 'zw102@wellesley.edu', friends: [1,3,4], rsvp:[123,102], hosting: [102]});
await add(db, 'users', {name: "Bella Steedly", userId:3, wellesleyEmail: 'bs102@wellesley.edu', friends: [1,2,4], rsvp:[102,17], hosting: [17]});
await add(db, 'users', {name: "Ella Boodell",userId:4, wellesleyEmail: 'eb115@wellesley.edu', friends: [1,2,3], rsvp:[102], hosting: []});

await Connection.open(mongoUri, myDBName);
await add(db, 'events', {eventName: "Latinx Culture Show", eventId: 123, idOrganizer:1, location: 'Casenove Hall', date: '2024-08-15',
startTime:'1:00 AM', endTime:'2:00 PM',image: ['https://ttn-media.s3.amazonaws.com/2019/09/24195005/Latinx-Online-678x381.png'], tags: ['music', 'culture', 'fun', 'latino'],
attendees: [1,2], venmo: '', gcal:'', spotify:''});


await add(db, 'events', {eventName: "Patriot's Day Picnic", eventId: 102, idOrganizer:2,location: 'Munger Meadows', date: '2024-05-15',
startTime:'11:30 AM', endTime:'2:00 PM', image: ['https://media.wired.com/photos/5cae8365eaad993a02ff5d1c/master/pass/bostonmarathon-947031426.jpg'], tags: ['food', 'MarMon', 'picnic', 'latino'],
attendees: [1, 2,3,4], venmo: '', gcal:'', spotify:''});

await add(db, 'events', {eventName: "Marshamaglow", eventId: 17, idOrganizer:3,location: 'Lulu Firepit', date: '2024-04-16',
startTime:'7:00 PM', endTime:'9:00 PM', image: ['https://media.wired.com/photos/5cae8365eaad993a02ff5d1c/master/pass/bostonmarathon-947031426.jpg'], tags: ['snacks', 'photography', 'fun', 'friends'],
attendees: [3], venmo: '', gcal:'', spotify:''});

await Connection.close();
}
main();