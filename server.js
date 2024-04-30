// start app with 'npm run dev' in a terminal window
// go to http://localhost:port/ to view your deployment!
// every time you change something in server.js and save, your deployment will automatically reload

// to exit, type 'ctrl + c', then press the enter key in a terminal window
// if you're prompted with 'terminate batch job (y/n)?', type 'y', then press the enter key in the same terminal

// standard modules, loaded from node_modules
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const counter = require('./counter-utils.js')
// const { add } = require('./insert');
const express = require('express');
const bcrypt = require('bcrypt');
const morgan = require('morgan');
const serveStatic = require('serve-static');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const flash = require('express-flash');
const multer = require('multer');

// our modules loaded from cwd

const { Connection } = require('./connection');
const cs304 = require('./cs304');
const { start } = require('repl');
const { setTheUsername } = require('whatwg-url');

// Create and configure the app

const app = express();

// Morgan reports the final status code of a request's response
app.use(morgan('tiny'));

app.use(cs304.logStartRequest);

// This handles POST data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cs304.logRequestData);  // tell the user about any request data
app.use(flash());


app.use(serveStatic('public'));
app.set('view engine', 'ejs');

const mongoUri = cs304.getMongoUri();

app.use(cookieSession({
    name: 'session',
    keys: ['horsebattery'],

    // Cookie Options
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));
const ROUNDS = 15;

// ================================================================
// configure Multer
app.use('/uploads', express.static('uploads'));

function timeString(dateObj) {
    if( !dateObj) {
        dateObj = new Date();
    }
    d2 = (val) => val < 10 ? '0'+val : ''+val;
    let hh = d2(dateObj.getHours())
    let mm = d2(dateObj.getMinutes())
    let ss = d2(dateObj.getSeconds())
    return hh+mm+ss
}

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif' ];

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        // the path module provides a function that returns the extension
        let ext = path.extname(file.originalname).toLowerCase();
        console.log('extension', ext);
        let hhmmss = timeString();
        cb(null, file.fieldname + '-' + hhmmss + ext);
    }
})
var upload = multer(
    { storage: storage,
      // check whether the file should be allowed
      // should also install and use mime-types
      // https://www.npmjs.com/package/mime-types
      fileFilter: function(req, file, cb) {
          let ext = path.extname(file.originalname).toLowerCase();
          let ok = ALLOWED_EXTENSIONS.includes(ext);
          console.log('file ok', ok);
          if(ok) {
              cb(null, true);
          } else {
              cb(null, false, new Error('not an allowed extension:'+ext));
          }
      },
      // max fileSize in bytes
      limits: {fileSize: 1_000_000 }});



// ================================================================
// custom routes here
const DBNAME = 'wave'; // modify this value
const USERS = 'users';      // modify this for your collections
const EVENTS = 'events'

//scott's example function:
// app.get('/end', async (req, res) => {
//     const db = await Connection.open(mongoUri, DBNAME);
//     let all = await db.collection(EVENTS).find({}).sort({name: 1}).toArray();
//     console.log('len', all.length, 'first', all[0]);
//     return res.render('list.ejs', {listDescription: 'all events', list: all});
// });
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

// main page. This shows the use of session cookies
app.get('/', (req, res) => {
    let uid = req.session.uid || 'unknown';
    let visits = req.session.visits || 0;
    visits++;
    req.session.visits = visits;
    console.log('uid', uid);
    return res.render('index.ejs', {uid, visits});
});

app.get('/explore', async (req, res) => {
    const db = await Connection.open(mongoUri, DBNAME);
    // this loads all events
    let events = await db.collection(EVENTS).find().toArray();
    console.log("here are events", events)
    return res.render('explore.ejs', { username: req.session.username, events: events });
});


app.get('/myevent', async (req,res) => {
    const db = await Connection.open(mongoUri, DBNAME);
    console.log("MY ID", req.session.uid)
    let myevents = await db.collection(EVENTS).find({ idOrganizer: req.session.uid }).toArray();
    console.log("here are your events", myevents)
    return res.render('myevent.ejs', { username: req.session.username, events: myevents })
  });

function parseInfo(user) {
let vars = ['name', 'username', 'wellesleyEmail', 'friends'];
vars.forEach((key) => {
    if (!(key in user)) {
    user[key] = [];
    }
});
return user;
}

app.get('/profile', async (req,res) => {
    const db = await Connection.open(mongoUri, DBNAME);
    let users = await db.collection(USERS);
    let data = await users.find({username: req.session.username}).project({name: 1, username: 1, wellesleyEmail: 1, friends: 1}).toArray();
    console.log(data, req.session.username);
    console.log(parseInfo(data[0]));
    
    return res.render('profile.ejs', {username: req.session.username, userData:parseInfo(data[0]), listPeople: []});
});

app.get('/register', (req, res) => {
    let uid = req.session.uid || 'unknown';
    let visits = req.session.visits || 0;
    visits++;
    req.session.visits = visits;
    return res.render('register.ejs', {uid, visits});
})

// shows how logins might work by setting a value in the session
// This is a conventional, non-Ajax, login, so it redirects to main page 
// app.post('/set-uid/', (req, res) => {
//     console.log('in set-uid');
//     req.session.uid = req.body.uid;
//     req.session.logged_in = true;
//     res.redirect('/explore');
// });

app.post('/register', async (req, res) => {
    try {
      const name = req.body.name;
      const email = req.body.email;
      const username = req.body.username;
      const password = req.body.password;
      const db = await Connection.open(mongoUri, DBNAME);
      var existingUser = await db.collection(USERS).findOne({wellesleyEmail: email});
      if (existingUser) {
        req.flash('error', "Login already exists - please try logging in instead.");
        return res.redirect('/')
      }
      const hash = await bcrypt.hash(password, ROUNDS);
      const userData={
          username: username,
          name: name, 
          wellesleyEmail: email,
          hash: hash
      };
      const result = await add(db, USERS, userData)
      console.log('successfully joined', result);
      const newUser = await db.collection(USERS).findOne({username: username});
      const userid = newUser.userId; // Assuming userId is the field for user id
      req.flash('info', 'successfully joined and logged in as ' + username);
      req.session.uid = userid;
      req.session.username = username;
      req.session.logged_in = true;
      return res.redirect('/explore');
    } catch (error) {
      req.flash('error', `Form submission error: ${error}`);
      return res.redirect('/')
    }
  });

app.post("/login", async (req, res) => {
    try {
    //   const userid = req.body.uid;
    //   const username = req.body.username;
      const password = req.body.password;
      const db = await Connection.open(mongoUri, DBNAME);
      console.log('req.email',req.body.email)
      var existingUser = await db.collection(USERS).findOne({wellesleyEmail: req.body.email});
      console.log('user', existingUser);
      if (!existingUser) {
        req.flash('error', "User does not exist - try again.");
        return res.redirect('/')
      }
      const match = await bcrypt.compare(password, existingUser.hash); 
      console.log('match', match);
      if (!match) {
          req.flash('error', "Username or password incorrect - try again.");
          return res.redirect('/')
      }
      const username = existingUser.username
      const userid = existingUser.userId
      req.flash('info', 'successfully logged in as ' + username);
      req.session.uid = userid;
      req.session.username = username;
      req.session.logged_in = true;
      console.log('login as', username);
      return res.redirect('/explore');
    } catch (error) {
      req.flash('error', `Form submission error: ${error}`);
      return res.redirect('/');
    }
  });

// conventional non-Ajax logout, so redirects
app.post('/logout', (req,res) => {
    if (req.session.username) {
      req.session.uid = false;
      req.session.username = false;
      req.session.logged_in = false;
      req.flash('info', 'You are logged out');
      return res.redirect('/');
    } else {
      req.flash('error', 'You are not logged in - please do so.');
      return res.redirect('/');
    }
  });


app.get('/addevent/', (req, res) => {
    console.log('get addevent form');
    return res.render('addevent.ejs', {action: '/addevent/', data: req.query});//userid: req.session.uid
});

app.post('/addevent', upload.single('image'), async (req, res) => {
    console.log('post a new event to the database');
    console.log('uploaded data', req.body);
    console.log('image', req.file);
    //insert file data into mongodb
    const requiredFields = ['eventName', 'nameOfOrganizer', 'date', 'startTime', 'endTime', 'location', 'image'];
    // Check for missing fields
    const missingFields = requiredFields.filter(field => !req.body[field] && field !== 'image');
    if (!req.file || missingFields.length > 0) {
        const missingFieldsMessage = missingFields.length > 0 ? `Missing inputs: ${missingFields.join(', ')}` : '';
        const imageMessage = !req.file ? 'Image is missing' : '';
        req.flash('error', `${imageMessage} ${missingFieldsMessage}`);
        return res.render("addevent.ejs", { data: req.body });
    }
    // const { eventName, nameOfOrganizer, date, startTime,endTime,location,tags } = req.body;
    // if (!eventName ||!nameOfOrganizer ||!date ||!startTime ||!endTime ||!location){
    //     req.flash('error', 'Missing Input');
    //     return res.render("addevent.ejs",{data: req.body})
    // }
    const db = await Connection.open(mongoUri, DBNAME);
    
    // const eventsdb = db.collection(EVENTS);
    // const eventid = await findTotalEvents() + 1;
    // console.log("eventid",eventid)
    const eventData = {
        eventName: eventName,
        idOrganizer: req.session.uid,
        nameOfOrganizer:nameOfOrganizer,
        location: location,
        date: date,
        startTime: startTime,
        endTime: endTime,
        image: ['/uploads/' + req.file.filename],     
        tags: tags,
        attendees:[],
        venmo: '',
        gcal: '',
        spotify: ''
    };
    const result = await add(db, 'events', eventData)
    // const result = await eventsdb.insertOne(eventData);
    console.log('insertOne result', result);
    return res.redirect('/myevent');
});

// Edit Event Form
app.get('/editEvent', async (req, res) => {
    // Retrieve the event ID from the request query
    const eventId = parseInt(req.query.eventId);
    // Delete the event from the database using the event ID
    const db = await Connection.open(mongoUri, DBNAME);
    const event = await db.collection(EVENTS).findOne({eventId: eventId })
    // Render a form to edit the event using the event ID
    console.log("THIS IS THE EVENT TO CHANGE:",event)
    res.render('editevent.ejs', { event:event });
});

// Handle Edit Event Form Submission
app.post('/editEvent', async (req, res) => {
    // Retrieve the event ID and updated event data from the request body
    const eventId = parseInt(req.body.eventId);
    const updatedEvent = {
        eventId : eventId,
        eventName: req.body.eventName,
        location: req.body.location,
        date: req.body.date,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        tags: req.body.tags.split(','), // Assuming tags are comma-separated
        attendees: req.body.attendees.split(','), // Assuming attendees are comma-separated
        venmo: req.body.venmo,
        gcal: req.body.gcal,
        spotify: req.body.spotify
    };

    console.log(updatedEvent)
    const db = await Connection.open(mongoUri, DBNAME);
    const result = await db.collection(EVENTS).updateOne({ eventId: eventId}, { $set: updatedEvent });
    
    console.log("UPDATE RESULT:",result);
    res.redirect('/myevent');
});

app.post('/addFriend/', async (req, res) =>{
    const db = await Connection.open(mongoUri, DBNAME);
    let users = await db.collection(USERS);
    let data = await users.find({username: req.session.username}).project({name: 1, username: 1, wellesleyEmail: 1, friends: 1}).toArray();
    console.log(data, req.session.username);
    console.log(parseInfo(data[0]));

    let friendId = parseInt(req.body.friendId);
    let userFriends = data[0].friends;
    console.log(friendId);

    if (!(friendId in userFriends)){
        await users.updateOne(
            { username: req.session.username },
            { $addToSet: { friends: friendId } }
        );
    }
    data = await users.find({username: req.session.username}).project({name: 1, username: 1, wellesleyEmail: 1, friends: 1}).toArray();
    console.log(data[0].friends);
    
    return res.render('profile.ejs', {username: req.session.username, userData:parseInfo(data[0]), listPeople: []});
    
})

// Delete Event
app.post('/deleteEvent', async (req, res) => {
    // Retrieve the event ID from the request body
    const eventId = parseInt(req.body.eventId);
    // Delete the event from the database using the event ID
    const db = await Connection.open(mongoUri, DBNAME);
    const result = await db.collection(EVENTS).deleteOne({eventId: eventId });
    // if (result.deletedCount === 1) {
    //     req.flash('info', 'Event deleted successfully');
    // } else {
    //     req.flash('error', 'Failed to delete event');
    // }
    console.log("DELETE RESULT:",result)

    // Redirect to the page displaying all events
    res.redirect('/myevent');
});

app.get('/searchFriends', async (req, res) => {
    const db = await Connection.open(mongoUri, DBNAME);
    let users = await db.collection(USERS);
    const entry = req.query.entry;
    const kind = req.query.kind; 

    let data = await users.find({username: req.session.username}).project({name: 1, username: 1, wellesleyEmail: 1, friends: 1}).toArray();
    console.log(data, req.session.username);
    console.log(parseInfo(data[0]));
    

    console.log(entry, kind, "entyr and kind");

    if ((entry && !kind) || (!entry && kind)){
        req.flash("info", `please provide corresponding kind for your search query`);
        return res.redirect("/profile")
    }

    if (kind == "name"){
        var listPerson = await users
        .find({'name': {'$regex': entry, '$options': 'i'}}) //find based on input term
        .toArray();
    }
    else if (kind == 'username'){ 
        var listPerson = await users
        .find({'username': {'$regex': entry, '$options': 'i'}}) //find based on input term
        .toArray();
    }

    console.log('matches', listPerson);

    return res.render('profile.ejs', {username: req.session.username, userData:parseInfo(data[0]), listPeople: listPerson});

    
});


// app.get('/staffList/', async (req, res) => {
//     const db = await Connection.open(mongoUri, WMDB);
//     let all = await db.collection(STAFF).find({}).sort({name: 1}).toArray();
//     console.log('len', all.length, 'first', all[0]);
//     return res.render('list.ejs', {listDescription: 'all staff', list: all});
// });

/////file upload
// app.post('/upload', upload.single('image'), async (req, res) => {
//     const username = req.session.username;
//     if (!username) {
//         req.flash('info', "You are not logged in");
//         return res.redirect('/login');
//     }
//     console.log('uploaded data', req.body);
//     console.log('file', req.file);
//     // insert file data into mongodb
//     const db = await Connection.open(mongoUri, DBNAME);
//     const result = await db.collection(EVENTS)
//           .insertOne({title: req.body.title,
//                       owner: username,
//                       //base on event's attribtues
//                       Image_path: '/uploads/'+req.file.filename});
//     console.log('insertOne result', result);
//     // always nice to confirm with the user
//     req.flash('info', 'file uploaded');
//     return res.redirect('/');
// });

//search events on explore page
app.get('/search/', async (req, res) => {
    const db = await Connection.open(mongoUri, DBNAME);
    const entry = req.query.entry;
    const kind = req.query.kind; //assuming that the kind options correspond with the keys in database
    const date = req.query.date;
    let events = await db.collection(EVENTS).find().toArray();

    if ((entry && !kind) || (!entry && kind)){
        req.flash("info", `please provide corresponding kind for your search query`);
        return res.render("explore.ejs", { username: req.session.uid, events})
    }
    if (kind == "person") {
        console.log("in person---------")
        events = [];
        console.log("set events to", events);
        let pattern = new RegExp(entry, "i");
        console.log("here is query", {name: { $regex: pattern }});
        events = await db.collection(EVENTS).find({ nameOfOrganizer: { $regex: pattern }}).toArray();
        
    } else {
        if (kind){
            let kpattern = new RegExp(entry, "i");
            let dpattern = new RegExp(date, "i");
            let query = {date: { $regex: dpattern }}; //todo austen - check that this works
            query[kind] = { $regex: kpattern };
            console.log("here is query", query)
            events = await db.collection(EVENTS).find(query).toArray(); //todo austen - this is iffy
            console.log("here are events", events)
        } else {
            let dpattern = new RegExp(date, "i");
            let query = {date: { $regex: dpattern }}; //todo austen - check that this works
            console.log("here is query", query)
            events = await db.collection(EVENTS).find(query).toArray(); //todo austen - this is iffy
            console.log("here are events", events)
        }
    }
    console.log("heres events", events)
    return res.render('explore.ejs', { username: req.session.username, events: events });
})

//filters events on explore page
app.get('/filter', async (req, res) => {
    const db = await Connection.open(mongoUri, DBNAME);
    const age = req.query.age
    const food = req.query.food
    const onCampus = req.query.onCampus
    const offCampus = req.query.offCampus
    const sports = req.query.sports
    const org = req.query.org
   

    const tags = [age, food, onCampus, offCampus, sports, org].filter(value => value !== '');
    //const tags = ['fun']
    let query = {};
    if (tags.length > 0) {
        query.tags = { $in: tags };
    }

    let events = await db.collection(EVENTS).find(query).toArray();
    return res.render('explore.ejs', { username: req.session.uid, events });
})

app.post('/rsvp/', async (req, res) => {
    let username = req.session.username || 'unknown';
    console.log("username", username)
    let eventId = req.body.eventId;
    console.log("eventID", eventId)
    const db = await Connection.open(mongoUri, DBNAME);
    // add user id to rsvp in event
    await db.collection(EVENTS).updateOne( { eventId: eventId }, { $addToSet: { attendees: username } } )
    let event = await db.collection(EVENTS).find( { eventId: eventId } ).toArray();
   
    // add event id to rsvp in user
    await db.collection(USERS).updateOne( { username: username }, { $addToSet: { rsvp: eventId } } )
    let user = await db.collection(USERS).find( { username: username } ).toArray();
    
    console.log("event", event);
    console.log("user", user);

    let events = await db.collection(EVENTS).find().toArray();
    return res.render('explore.ejs', { username: username, events: events });

});

app.post('/updateProfile/', async (req, res) => {
    const db = await Connection.open(mongoUri, DBNAME);
    let users = await db.collection(USERS);
    let data = await users.find({username: req.session.username}).project({name: 1, username: 1, wellesleyEmail: 1, friends: 1}).toArray();
    console.log(req.body, "body");

    // Extract data from req.body and update user info
    for (const key in req.body) {
        if (req.body[key] !== '') {
            data[0][key] = req.body[key];
        }
    }
    // Update user info in the database
    await users.updateOne(
        {username: req.session.username},
        {$set: data[0]}
    );

    req.session.username = data[0]['username'];

    data = await users.find({username: req.session.username}).project({name: 1, username: 1, wellesleyEmail: 1, friends: 1}).toArray();
    
    console.log(data, "data")
    return res.render('profile.ejs', {username: req.session.username, userData:parseInfo(data[0]), listPeople: []});

})
// ================================================================
// postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`open http://localhost:${serverPort}`);
});

// ================================================================
// Login
