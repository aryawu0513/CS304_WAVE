const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env.sh') });
const { Connection } = require('./connection');
const cs304 = require('./cs304');

const mongoUri = cs304.getMongoUri();
const counter = require('./counter-utils.js')

// REPLACE WITH YOUR OWN USERNAME ("og102", for example)
const myDBName = "wave";
/**
* This function inserts an event/user into the specified collection.
* @param {db} The database to edit.
* @param {coll} The collection to add document to—either event or users.
* @param {dict} Dict with values you want to add to collection
* @returns the result after the pet is added to the collection.
*/
async function add(db, coll, dict) {
    const id = await counter.incr(db.collection('counters'), coll);
    // update userId if adding user
    if (coll == "users"){
        dict.userId = id;
    }
    else {
        dict.eventId = id;
    }
    let result = db.collection(coll).insertOne(dict);
    return result;
}


/**
* This function deletes all documents in a given collection
* @param {db} The database to read from.
* @param {coll} The name of the collection
*/
function resetDB(db, coll) {
return db.collection(coll).deleteMany({});
}

/**
* This function deletes a user, which is specified by their id, from a collection.
* @param {db} The database to delete from.
* @param {userId} The name of the user to delete.
*/
function deleteUser(db, userId) {
db.collection('users').deleteOne({userId: userId });
}


/**
* This is the main function, and is where functions are called and tested. It will also log results returned by functions.
*/
async function main() {
    const db = await Connection.open(mongoUri, myDBName);
    await resetDB(db, 'counters');
    counter.init(db.collection('counters'), 'users');
    counter.init(db.collection('counters'), 'events');

    await resetDB(db, 'users');
    await resetDB(db, 'events');
    await add(db, 'users', {name: "Maria del Granado", username: 'majo', hash:'majo', wellesleyEmail: 'md103@wellesley.edu', friends: [2,3,4], 
    rsvp:[1,2], hosting: [1]});
    await add(db, 'users', {name: "Arya Wu", username:'arya', hash:'arya', wellesleyEmail: 'zw102@wellesley.edu', friends: [1,3,4], rsvp:[1,2], 
    hosting: [2]});
    await add(db, 'users', {name: "Bella Steedly", username: 'bella', hash:'bella', wellesleyEmail: 'bs102@wellesley.edu', friends: [1,2,4], 
    rsvp:[2,3], hosting: [3]});
<<<<<<< HEAD
    await add(db, 'users', {name: "Austen Boodell", wellesleyEmail: 'eb115@wellesley.edu', friends: [1,2,3], rsvp:[3], 
=======
    await add(db, 'users', {name: "Austen Boodell", username: 'austen', hash: 'austen', wellesleyEmail: 'eb115@wellesley.edu', friends: [1,2,3], rsvp:[3], 
>>>>>>> b5a6b64b093a9a4a6104b999e172c36f69643a8b
    hosting: []});

    //await Connection.open(mongoUri, myDBName);
    await add(db, 'events', {eventName: "Latinx Culture Show", idOrganizer:1, nameOfOrganizer: 'Maria del Granado',location: 'Casenove Hall', date: '2024-08-15',
    startTime:'07:30', endTime:'14:00',image: ['https://ttn-media.s3.amazonaws.com/2019/09/24195005/Latinx-Online-678x381.png'], tags: ['onCampus', 'org'],
    attendees: [1,2], venmo: '', gcal:'', spotify:''});

    await add(db, 'events', {eventName: "Patriot's Day Picnic", idOrganizer:2, nameOfOrganizer: 'Arya Wu', location: 'Munger Meadows', date: '2024-05-15',
    startTime:'11:30', endTime:'14:00', image: ['https://media.wired.com/photos/5cae8365eaad993a02ff5d1c/master/pass/bostonmarathon-947031426.jpg'], tags: ['food', 'onCampus','sports'],
    attendees: [1, 2,3,4], venmo: '', gcal:'', spotify:''});

    await add(db, 'events', {eventName: "Marshamaglow", idOrganizer:3, nameOfOrganizer: 'Bella Steedly',location: 'Lulu Firepit', date: '2024-04-16',
    startTime:'19:00', endTime:'21:00', image: ['https://media.wired.com/photos/5cae8365eaad993a02ff5d1c/master/pass/bostonmarathon-947031426.jpg'], tags: ['food', 'onCampus'],
    attendees: [3], venmo: '', gcal:'', spotify:''}); 

    await Connection.close();
}
main();
// module.exports = {
//     add
// };