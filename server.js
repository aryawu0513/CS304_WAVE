// start app with 'npm run dev' in a terminal window
// go to http://localhost:port/ to view your deployment!
// every time you change something in server.js and save, your deployment will automatically reload

// to exit, type 'ctrl + c', then press the enter key in a terminal window
// if you're prompted with 'terminate batch job (y/n)?', type 'y', then press the enter key in the same terminal

// standard modules, loaded from node_modules
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const counter = require('./counter-utils.js')
const { add } = require('./insert');
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


app.get('/myevent', (req,res) => {
    return res.render('myevent.ejs', {username: req.session.username});
  });

app.get('/profile', (req,res) => {
    return res.render('profile.ejs', {username: req.session.username});
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

app.post('/set-uid/', async (req, res) => {
    try {
      const username = req.body.username;
      const password = req.body.password;
      const db = await Connection.open(mongoUri, DBNAME);
      var existingUser = await db.collection(USERS).findOne({username: username});
      if (existingUser) {
        req.flash('error', "Login already exists - please try logging in instead.");
        return res.redirect('/')
      }
      const hash = await bcrypt.hash(password, ROUNDS);
      await db.collection(USERS).insertOne({
          username: username,
          hash: hash
      });
      console.log('successfully joined', username, password, hash);
      req.flash('info', 'successfully joined and logged in as ' + username);
      req.session.username = username;
      req.session.logged_in = true;
      return res.redirect('/explore');
    } catch (error) {
      req.flash('error', `Form submission error: ${error}`);
      return res.redirect('/')
    }
  });

// // shows how logins might work via Ajax
// app.post('/set-uid-ajax/', (req, res) => {
//     console.log(Object.keys(req.body));
//     console.log(req.body);
//     let uid = req.body.uid;
//     if(!uid) {
//         res.send({error: 'no uid'}, 400);
//         return;
//     }
//     req.session.uid = req.body.uid;
//     req.session.logged_in = true;
//     console.log('logged in via ajax as ', req.body.uid);
//     res.send({error: false});
//     return res.redirect('/explore');
// });

app.post("/login", async (req, res) => {
    try {
      const username = req.body.username;
      const password = req.body.password;
      const db = await Connection.open(mongoUri, DBNAME);
      var existingUser = await db.collection(USERS).findOne({username: username});
      console.log('user', existingUser);
      if (!existingUser) {
        req.flash('error', "Username does not exist - try again.");
       return res.redirect('/')
      }
      const match = await bcrypt.compare(password, existingUser.hash); 
      console.log('match', match);
      if (!match) {
          req.flash('error', "Username or password incorrect - try again.");
          return res.redirect('/')
      }
      req.flash('info', 'successfully logged in as ' + username);
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
      req.session.username = false;
      req.session.logged_in = false;
      req.flash('info', 'You are logged out');
      return res.redirect('/');
    } else {
      req.flash('error', 'You are not logged in - please do so.');
      return res.redirect('/');
    }
  });

// two kinds of forms (GET and POST), both of which are pre-filled with data
// from previous request, including a SELECT menu. Everything but radio buttons

// app.get('/form/', (req, res) => {
//     console.log('get form');
//     return res.render('form.ejs', {action: '/form/', data: req.query });
// });

// app.post('/form/', (req, res) => {
//     console.log('post form');
//     return res.render('form.ejs', {action: '/form/', data: req.body });
// });

app.get('/addevent/', (req, res) => {
    console.log('get addevent form');
    //waiting to have uid login fixed. rightnow it is undefined
    console.log({ userid: req.session.uid})
    return res.render('addevent.ejs', {action: '/addevent/', data: req.query});//userid: req.session.uid
});

async function findTotalEvents() {
    const db = await Connection.open(mongoUri, DBNAME);
    const totalEvents = await db.collection(EVENTS).countDocuments();
    return totalEvents
}

// app.post('/addevent', upload.single('image'), async (req, res) => {
//     console.log('post a new event to the database');
//     console.log('uploaded data', req.body);
//     console.log('image', req.file);
//     //insert file data into mongodb
//     const { eventName, nameOfOrganizer, date, startTime,endTime,location,tags } = req.body;
//     if (!eventName ||!nameOfOrganizer ||!date ||!startTime ||!endTime ||!location){
//         req.flash('error', 'Missing Input');
//         return res.render("addevent.ejs",{data: req.body})
//     }
//     const db = await Connection.open(mongoUri, DBNAME);
//     const eventsdb = db.collection(EVENTS);
//     const eventid = await findTotalEvents() + 1;
//     console.log("eventid",eventid)
//     const eventData = {
//         eventId: eventid,
//         eventName: eventName,
//         idOrganizer: req.session.uid,
//         nameOfOrganizer:nameOfOrganizer,
//         location: location,
//         date: date,
//         startTime: startTime,
//         endTime: endTime,
//         image: ['/uploads/' + req.file.filename],     
//         tags: tags,
//         attendees:[],
//         venmo: '',
//         gcal: '',
//         spotify: ''
//     };
//     const result = await eventsdb.insertOne(eventData);
//     console.log('insertOne result', result);
//     return res.redirect('/myevent');
// });

app.post('/addevent', upload.single('image'), async (req, res) => {
    console.log('post a new event to the database');
    console.log('uploaded data', req.body);
    console.log('image', req.file);
    //insert file data into mongodb
    const { eventName, nameOfOrganizer, date, startTime,endTime,location,tags } = req.body;
    if (!eventName ||!nameOfOrganizer ||!date ||!startTime ||!endTime ||!location){
        req.flash('error', 'Missing Input');
        return res.render("addevent.ejs",{data: req.body})
    }
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
    return res.render('explore.ejs', { username: req.session.uid, events: events });
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
    let eventId = req.params.eventId;
    const db = await Connection.open(mongoUri, DBNAME);
    // add user id to rsvp in event
    await db.collection(EVENTS).updateOne( { eventId: eventId }, { $addToSet: { attendees: username } } )

    // add event id to rsvp in user
    await db.collection(USERS).updateOne( { username: username }, { $addToSet: { rsvp: eventId } } )

    let events = await db.collection(EVENTS).find().toArray();
    return res.render('explore.ejs', { username: username, events: events });

  });


// ================================================================
// postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`open http://localhost:${serverPort}`);
});

// ================================================================
// Login
