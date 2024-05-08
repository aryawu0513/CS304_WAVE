// start app with 'npm run dev' in a terminal window
// go to http://localhost:port/ to view your deployment!
// every time you change something in server.js and save, your deployment will automatically reload

// to exit, type 'ctrl + c', then press the enter key in a terminal window
// if you're prompted with 'terminate batch job (y/n)?', type 'y', then press the enter key in the same terminal

// standard modules, loaded from node_modules
const path = require("path");
require("dotenv").config({ path: path.join(process.env.HOME, ".cs304env") });
const counter = require("./counter-utils.js");
// const { add } = require('./insert');
const express = require("express");
const bcrypt = require("bcrypt");
const morgan = require("morgan");
const serveStatic = require("serve-static");
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");
const flash = require("express-flash");
const multer = require("multer");

// our modules loaded from cwd

const { Connection } = require("./connection");
const cs304 = require("./cs304");
const { start } = require("repl");
const { setTheUsername } = require("whatwg-url");

// Create and configure the app

const app = express();

// Morgan reports the final status code of a request's response
app.use(morgan("tiny"));

app.use(cs304.logStartRequest);

// This handles POST data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cs304.logRequestData); // tell the user about any request data
app.use(flash());

app.use(serveStatic("public"));
app.set("view engine", "ejs");

const mongoUri = cs304.getMongoUri();

app.use(
  cookieSession({
    name: "session",
    keys: ["horsebattery"],

    // Cookie Options
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
);
const ROUNDS = 15;

// ================================================================
// configure Multer
app.use("/uploads", express.static("uploads"));

function timeString(dateObj) {
  if (!dateObj) {
    dateObj = new Date();
  }
  d2 = (val) => (val < 10 ? "0" + val : "" + val);
  let hh = d2(dateObj.getHours());
  let mm = d2(dateObj.getMinutes());
  let ss = d2(dateObj.getSeconds());
  return hh + mm + ss;
}

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif"];

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    // the path module provides a function that returns the extension
    let ext = path.extname(file.originalname).toLowerCase();
    console.log("extension", ext);
    let hhmmss = timeString();
    cb(null, file.fieldname + "-" + hhmmss + ext);
  },
});
var upload = multer({
  storage: storage,
  // check whether the file should be allowed
  // should also install and use mime-types
  // https://www.npmjs.com/package/mime-types
  fileFilter: function (req, file, cb) {
    let ext = path.extname(file.originalname).toLowerCase();
    let ok = ALLOWED_EXTENSIONS.includes(ext);
    console.log("file ok", ok);
    if (ok) {
      cb(null, true);
    } else {
      cb(null, false, new Error("not an allowed extension:" + ext));
    }
  },
  // max fileSize in bytes
  limits: { fileSize: 1_000_000 },
});

// ================================================================
// custom routes here
const DBNAME = "wave"; // modify this value
const USERS = "users"; // modify this for your collections
const EVENTS = "events";

/**
 * This function is used to add a new document to a specified collection in the database.
 * It first increments a counter for the collection, then adds this counter as an ID to the document.
 * If the collection is 'users', the ID is added as 'userId'. For event collections, it's added as 'eventId'.
 * Finally, the document is inserted into the collection.
 *
 * @param {Object} db - The database object.
 * @param {String} coll - The name of the collection.
 * @param {Object} dict - The document to be added.
 * @returns {Promise} - A promise that resolves with the result of the insert operation.
 */
async function add(db, coll, dict) {
  const id = await counter.incr(db.collection("counters"), coll);
  // update userId if adding user
  if (coll == "users") {
    dict.userId = id;
  } else {
    dict.eventId = id;
  }
  let result = db.collection(coll).insertOne(dict);
  return result;
}

/**
 * This is the main page route. It uses session cookies to track the user's ID and the number of visits.
 * If the user ID or visits are not set in the session, they are initialized to 'unknown' and 0, respectively.
 * The number of visits is incremented each time the route is accessed.
 */
app.get("/", (req, res) => {
  let uid = req.session.uid || "unknown";
  let visits = req.session.visits || 0;
  visits++;
  req.session.visits = visits;
  console.log("uid", uid);
  return res.render("index.ejs", { uid, visits });
});

/**
 * This route handles the GET request to the explore page.
 *
 * It opens a connection to the database and retrieves all events.
 * It then renders the 'explore.ejs' view, passing the username from the session and the retrieved events to the view.
 */
app.get("/explore", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  // this loads all events
  // let events = await db.collection(EVENTS).find().toArray();
  let events = await db.collection(EVENTS).find().sort({ date: -1 }).toArray();
  let user = await db.collection(USERS).findOne({ username: req.session.username });

  console.log("here are events", events);
  return res.render("explore.ejs", {
    user:user,
    username: req.session.username,
    events: events,
  });
});

/**
 * This route handles the GET request to the myevent page.
 *
 * The current user is identified by the user ID stored in the session.
 * It then renders the 'myevent.ejs' view
 */
app.get("/myevent", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  console.log("MY ID", req.session.uid);
  let myevents = await db
    .collection(EVENTS)
    .find({ idOrganizer: req.session.uid })
    .sort({ date: -1 })
    .toArray();
  console.log("here are your events", myevents);
  return res.render("myevent.ejs", {
    username: req.session.username,
    events: myevents,
  });
});


/**
 * This function ensures that the user object has all the necessary keys.
 * If any of the keys "name", "username", "wellesleyEmail", or "friends" are not present in the user object,
 * it adds them with an initial value of an empty array.
 *
 * @param {Object} user - The user object to be parsed.
 * @returns {Object} - The parsed user object with all necessary keys.
 */
function parseInfo(user) {
  let vars = ["name", "username", "wellesleyEmail", "friends"];
  vars.forEach((key) => {
    if (!(key in user)) {
      user[key] = [];
    }
  });
  return user;
}

/**
 * This route handles the GET request to the profile page.
 *
 * It opens a connection to the database and retrieves the user's data based on the username stored in the session.
 * The data retrieved includes the user's name, username, Wellesley email, and friends.
 * The user data is then parsed using the `parseInfo` function to ensure all necessary keys are present.
 * Finally, it renders the 'profile.ejs' view, passing the username, parsed user data, and an empty list of people to the view.
 */
app.get("/profile", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  let users = await db.collection(USERS);
  let data = await users
    .find({ username: req.session.username })
    .project({ name: 1, username: 1, wellesleyEmail: 1, friends: 1 })
    .toArray();
  console.log(data, req.session.username);
  console.log(parseInfo(data[0]));

  return res.render("profile.ejs", {
    username: req.session.username,
    userData: parseInfo(data[0]),
    listPeople: [],
  });
});

/**
 * This route handles the GET request to the register page.
 *
 * It uses session cookies to track the user's ID and the number of visits.
 * If the user ID or visits are not set in the session, they are initialized to 'unknown' and 0, respectively.
 * The number of visits is incremented each time the route is accessed.
 * Finally, it renders the 'register.ejs' view, passing the user ID and visit count to the view.
 */
app.get("/register", (req, res) => {
  let uid = req.session.uid || "unknown";
  let visits = req.session.visits || 0;
  visits++;
  req.session.visits = visits;
  return res.render("register.ejs", { uid, visits });
});

/**
 * This route handles the POST request to the register page.
 *
 * It retrieves the user's name, email, username, and password from the request body.
 * It then checks if a user with the same email already exists in the database.
 * If such a user exists, it flashes an error message and redirects to the home page.
 * If no such user exists, it hashes the password and creates a new user in the database with the provided details.
 * It then retrieves the newly created user from the database, sets the user's ID and username in the session, and redirects to the explore page.
 * If any error occurs during this process, it flashes an error message and redirects to the home page.
 */
app.post("/register", async (req, res) => {
  try {
    const name = req.body.name;
    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;
    const db = await Connection.open(mongoUri, DBNAME);
    var existingUser = await db
      .collection(USERS)
      .findOne({ wellesleyEmail: email });
    if (existingUser) {
      req.flash(
        "error",
        "Login already exists - please try logging in instead."
      );
      return res.redirect("/");
    }
    const hash = await bcrypt.hash(password, ROUNDS);
    const userData = {
      username: username,
      name: name,
      wellesleyEmail: email,
      hash: hash,
    };
    const result = await add(db, USERS, userData);
    console.log("successfully joined", result);
    const newUser = await db.collection(USERS).findOne({ username: username });
    const userid = newUser.userId; // Assuming userId is the field for user id
    req.flash("info", "successfully joined and logged in as " + username);
    req.session.uid = userid;
    req.session.username = username;
    req.session.logged_in = true;
    return res.redirect("/explore");
  } catch (error) {
    req.flash("error", `Form submission error: ${error}`);
    return res.redirect("/");
  }
});

/**
 * This route handles the POST request to the login page.
 *
 * It retrieves the user's password from the request body and the user's email to find the user in the database.
 * If no such user exists, it flashes an error message and redirects to the home page.
 * If a user exists, it compares the provided password with the hashed password stored in the database.
 * If the passwords match, it sets the user's ID and username in the session, flashes a success message, and redirects to the explore page.
 * If the passwords do not match, it flashes an error message and redirects to the home page.
 * If any error occurs during this process, it flashes an error message and redirects to the home page.
 */
app.post("/login", async (req, res) => {
  try {
    //   const userid = req.body.uid;
    //   const username = req.body.username;
    const password = req.body.password;
    const db = await Connection.open(mongoUri, DBNAME);
    console.log("req.email", req.body.email);
    var existingUser = await db
      .collection(USERS)
      .findOne({ wellesleyEmail: req.body.email });
    console.log("user", existingUser);
    if (!existingUser) {
      req.flash("error", "User does not exist - try again.");
      return res.redirect("/");
    }
    const match = await bcrypt.compare(password, existingUser.hash);
    console.log("match", match);
    if (!match) {
      req.flash("error", "Username or password incorrect - try again.");
      return res.redirect("/");
    }
    const username = existingUser.username;
    const userid = existingUser.userId;
    req.flash("info", "successfully logged in as " + username);
    req.session.uid = userid;
    req.session.username = username;
    req.session.logged_in = true;
    console.log("login as", username);
    return res.redirect("/explore");
  } catch (error) {
    req.flash("error", `Form submission error: ${error}`);
    return res.redirect("/");
  }
});

/**
 * This route handles the POST request to the logout page.
 *
 * It checks if a user is logged in by checking if a username exists in the session.
 * If a user is logged in, it sets the user's ID, username, and logged_in status in the session to false, flashes a logout success message, and redirects to the home page.
 * If no user is logged in, it flashes an error message and redirects to the home page.
 */
app.post("/logout", (req, res) => {
  if (req.session.username) {
    req.session.uid = false;
    req.session.username = false;
    req.session.logged_in = false;
    req.flash("info", "You are logged out");
    return res.redirect("/");
  } else {
    req.flash("error", "You are not logged in - please do so.");
    return res.redirect("/");
  }
});

/**
 * This route handles the GET request to the addevent page.
 *
 * It logs a message to the console indicating that the addevent form is being accessed.
 * It then renders the 'addevent.ejs' view, passing the action URL and any query parameters from the request to the view.
 */
app.get("/addevent/", (req, res) => {
  console.log("get addevent form");
  return res.render("addevent.ejs", { action: "/addevent/", data: req.query }); //userid: req.session.uid
});

/**
 * This route handles the POST request to the addevent page.
 *
 * It receives an image file and other event details from the request body.
 * It checks if any required fields are missing from the request body or if the image file is missing.
 * If any required data is missing, it flashes an error message and re-renders the addevent page with the submitted data.
 * If all required data is present, it opens a connection to the database and inserts a new event document with the submitted data and some default values.
 * It then redirects to the myevent page.
 */
app.post("/addevent", upload.single("image"), async (req, res) => {
  console.log("post a new event to the database");
  console.log("uploaded data", req.body);
  console.log("image", req.file);
  //insert file data into mongodb
  const requiredFields = [
    "eventName",
    "nameOfOrganizer",
    "date",
    "startTime",
    "endTime",
    "location",
    "image",
  ];
  // Check for missing fields
  const missingFields = requiredFields.filter(
    (field) => !req.body[field] && field !== "image"
  );
  if (!req.file || missingFields.length > 0) {
    const missingFieldsMessage =
      missingFields.length > 0
        ? `Missing inputs: ${missingFields.join(", ")}`
        : "";
    const imageMessage = !req.file ? "Image is missing" : "";
    req.flash("error", `${imageMessage} ${missingFieldsMessage}`);
    return res.render("addevent.ejs", { data: req.body });
  }
  const {
    eventName,
    nameOfOrganizer,
    date,
    startTime,
    endTime,
    location,
    tags,
  } = req.body;

  const db = await Connection.open(mongoUri, DBNAME);

  const eventData = {
    eventName: eventName,
    idOrganizer: req.session.uid,
    nameOfOrganizer: nameOfOrganizer,
    location: location,
    date: date,
    startTime: startTime,
    endTime: endTime,
    image: ["/uploads/" + req.file.filename],
    tags: tags,
    attendees: [],
    venmo: "",
    gcal: "",
    spotify: "",
  };
  const result = await add(db, "events", eventData);
  // const result = await eventsdb.insertOne(eventData);
  console.log("insertOne result", result);
  return res.redirect("/myevent");
});

/**
 * This route handles the GET request to the editEvent page.
 *
 * It retrieves the event ID from the request query, opens a connection to the database, and retrieves the event with the given ID.
 * It then renders the 'editevent.ejs' view, passing the retrieved event to the view.
 */
app.get("/editEvent", async (req, res) => {
  // Retrieve the event ID from the request query
  const eventId = parseInt(req.query.eventId);
  // Delete the event from the database using the event ID
  const db = await Connection.open(mongoUri, DBNAME);
  const event = await db.collection(EVENTS).findOne({ eventId: eventId });
  // Render a form to edit the event using the event ID
  console.log("THIS IS THE EVENT TO CHANGE:", event);
  res.render("editevent.ejs", { event: event });
});

/**
 * This route handles the POST request to the editEvent page.
 *
 * It retrieves the event ID and updated event data from the request body.
 * It opens a connection to the database and updates the event with the given ID using the updated event data.
 * It then redirects to the myevent page.
 */
app.post("/editEvent", async (req, res) => {
  // Retrieve the event ID and updated event data from the request body
  const eventId = parseInt(req.body.eventId);
  const updatedEvent = {
    eventId: eventId,
    eventName: req.body.eventName,
    location: req.body.location,
    date: req.body.date,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    tags: req.body.tags.split(","), // Assuming tags are comma-separated
    attendees: req.body.attendees.split(","), // Assuming attendees are comma-separated
    venmo: req.body.venmo,
    gcal: req.body.gcal,
    spotify: req.body.spotify,
  };

  console.log(updatedEvent);
  const db = await Connection.open(mongoUri, DBNAME);
  const result = await db
    .collection(EVENTS)
    .updateOne({ eventId: eventId }, { $set: updatedEvent });

  console.log("UPDATE RESULT:", result);
  res.redirect("/myevent");
});

/**
 * This route handles the POST request to the addFriend page.
 *
 * It retrieves the friend ID from the request body and the user's username from the session.
 * It opens a connection to the database and retrieves the user's data.
 * If the friend ID is not already in the user's friends list, it adds the friend ID to the user's friends list in the database.
 * It then re-retrieves the user's data and renders the 'profile.ejs' view, passing the username from the session, the user's data, and an empty list of people to the view.
 */
app.post("/addFriend/", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  let users = await db.collection(USERS);
  let data = await users
    .find({ username: req.session.username })
    .project({ name: 1, username: 1, wellesleyEmail: 1, friends: 1 })
    .toArray();
  console.log(data, req.session.username);
  console.log(parseInfo(data[0]));

  let friendId = parseInt(req.body.friendId);
  let userFriends = data[0].friends;
  console.log(friendId);

  if (!(friendId in userFriends)) {
    await users.updateOne(
      { username: req.session.username },
      { $addToSet: { friends: friendId } }
    );
  }
  data = await users
    .find({ username: req.session.username })
    .project({ name: 1, username: 1, wellesleyEmail: 1, friends: 1 })
    .toArray();
  console.log(data[0].friends);

  return res.render("profile.ejs", {
    username: req.session.username,
    userData: parseInfo(data[0]),
    listPeople: [],
  });
});

/**
 * This route handles the POST request to the deleteEvent page.
 *
 * It retrieves the event ID from the request body, opens a connection to the database, and deletes the event with the given ID.
 * If the event was deleted successfully, it flashes an info message. If the event was not deleted successfully, it flashes an error message.
 * It then redirects to the myevent page.
 */
app.post("/deleteEvent", async (req, res) => {
  // Retrieve the event ID from the request body
  const eventId = parseInt(req.body.eventId);
  // Delete the event from the database using the event ID
  const db = await Connection.open(mongoUri, DBNAME);
  const result = await db.collection(EVENTS).deleteOne({ eventId: eventId });
  if (result.deletedCount === 1) {
    req.flash("info", "Event deleted successfully");
  } else {
    req.flash("error", "Failed to delete event");
  }
  // Redirect to the page displaying all events
  res.redirect("/myevent");
});

/**
 * This route handles the GET request to the searchFriends page.
 *
 * It retrieves the search entry and kind from the request query and the user's username from the session.
 * It opens a connection to the database and retrieves the user's data.
 * If only the search entry or kind is provided, it flashes an info message and redirects to the profile page.
 * If both the search entry and kind are provided, it searches for users whose name or username matches the search entry, depending on the kind.
 * It then renders the 'profile.ejs' view, passing the username from the session, the user's data, and the list of matching users to the view.
 */
app.get("/searchFriends", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  let users = await db.collection(USERS);
  const entry = req.query.entry;
  const kind = req.query.kind;

  let data = await users
    .find({ username: req.session.username })
    .project({ name: 1, username: 1, wellesleyEmail: 1, friends: 1 })
    .toArray();
  console.log(data, req.session.username);
  console.log(parseInfo(data[0]));

  console.log(entry, kind, "entyr and kind");

  if ((entry && !kind) || (!entry && kind)) {
    req.flash(
      "info",
      `please provide corresponding kind for your search query`
    );
    return res.redirect("/profile");
  }

  if (kind == "name") {
    var listPerson = await users
      .find({ name: { $regex: entry, $options: "i" } }) //find based on input term
      .toArray();
  } else if (kind == "username") {
    var listPerson = await users
      .find({ username: { $regex: entry, $options: "i" } }) //find based on input term
      .toArray();
  }

  console.log("matches", listPerson);

  return res.render("profile.ejs", {
    username: req.session.username,
    userData: parseInfo(data[0]),
    listPeople: listPerson,
  });
});

/**
 * This route handles the GET request to the search page.
 *
 * It retrieves the search entry, kind, and date from the request query and the user's username from the session.
 * It opens a connection to the database and retrieves all events.
 * If only the search entry or kind is provided, it flashes an info message and renders the 'explore.ejs' view with all events.
 * If the kind is 'person', it searches for events whose organizer's name matches the search entry.
 * If the kind is not 'person' and is provided, it searches for events whose date and the field corresponding to the kind match the search entry and date.
 * If the kind is not provided, it searches for events whose date matches the search date.
 * It then renders the 'explore.ejs' view, passing the username from the session and the matching events to the view.
 */
app.get("/search/", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  const entry = req.query.entry;
  const kind = req.query.kind; //assuming that the kind options correspond with the keys in database
  const date = req.query.date;
  // let events = await db.collection(EVENTS).find().toArray();
  // console.log(events)
  let events = await db.collection(EVENTS).find().sort({ date: -1 }).toArray();
  let user = await db.collection(USERS).findOne({ username: req.session.username });

  if ((entry && !kind) || (!entry && kind)) {
    req.flash(
      "info",
      `please provide corresponding kind for your search query`
    );

    return res.render("explore.ejs", {user:user,username: req.session.username, events });
  }
  if (kind == "person") {
    console.log("in person---------");
    events = [];
    console.log("set events to", events);
    let pattern = new RegExp(entry, "i");
    console.log("here is query", { name: { $regex: pattern } });
    events = await db
      .collection(EVENTS)
      .find({ nameOfOrganizer: { $regex: pattern } })
      .toArray();
  } else {
    if (kind) {
      let kpattern = new RegExp(entry, "i");
      let dpattern = new RegExp(date, "i");
      let query = { date: { $regex: dpattern } }; //todo austen - check that this works
      query[kind] = { $regex: kpattern };
      console.log("here is query", query);
      events = await db.collection(EVENTS).find(query).toArray(); //todo austen - this is iffy
      console.log("here are events", events);
    } else {
      let dpattern = new RegExp(date, "i");
      let query = { date: { $regex: dpattern } }; //todo austen - check that this works
      console.log("here is query", query);
      events = await db.collection(EVENTS).find(query).toArray(); //todo austen - this is iffy
      console.log("here are events", events);
    }
  }
  console.log("heres events", events);
  return res.render("explore.ejs", {
    user:user,
    username: req.session.username,
    events: events,
  });
});

/**
 * This route handles the GET request to the filter page.
 *
 * It retrieves the age, food, onCampus, offCampus, sports, and org from the request query and the user's username from the session.
 * It opens a connection to the database.
 * It creates a list of tags from the query parameters, filtering out any empty values.
 * If there are any tags, it creates a query to find events whose tags are in the list of tags.
 * It retrieves the events matching the query from the database.
 * It then renders the 'explore.ejs' view, passing the username from the session and the matching events to the view.
 */
app.get("/filter", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  const age = req.query.age;
  const food = req.query.food;
  const onCampus = req.query.onCampus;
  const offCampus = req.query.offCampus;
  const sports = req.query.sports;
  const org = req.query.org;

  const tags = [age, food, onCampus, offCampus, sports, org].filter(
    (value) => value !== ""
  );
  //const tags = ['fun']
  let query = {};
  if (tags.length > 0) {
    query.tags = { $in: tags };
  }

  let events = await db.collection(EVENTS).find(query).toArray();
  let user = await db.collection(USERS).findOne({ username: req.session.username });
  return res.render("explore.ejs", { user:user,username: req.session.username, events });
});

//working on this
/**
 * This route handles the POST request to the rsvp page.
 *
 * It retrieves the username from the session and the eventId from the request parameters.
 * It opens a connection to the database.
 * It adds the username to the attendees of the event with the given eventId.
 * It adds the eventId to the rsvp of the user with the given username.
 * It retrieves all events from the database.
 * It then renders the 'explore.ejs' view, passing the username and all events to the view.
 */
app.post("/rsvp/", async (req, res) => {
  let username = req.session.username || "unknown";
  let eventId = req.params.eventId;
  const db = await Connection.open(mongoUri, DBNAME);
  // add user id to rsvp in event
  await db
    .collection(EVENTS)
    .updateOne({ eventId: eventId }, { $addToSet: { attendees: username } });

  // add event id to rsvp in user
  await db
    .collection(USERS)
    .updateOne({ username: username }, { $addToSet: { rsvp: eventId } });

  // let events = await db.collection(EVENTS).find().toArray();
  let events = await db.collection(EVENTS).find().sort({ date: -1 }).toArray();
  let user = await db.collection(USERS).findOne({ username: req.session.username });
  return res.render("explore.ejs", { user:user,username: username, events: events });
});


app.get("/savedevent", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  let user = await db.collection(USERS).findOne({ username: req.session.username });
  let savedEvents = await db.collection(EVENTS).find({ eventId: { $in: user.saved } }).sort({ date: -1 }).toArray();
    
  console.log("here are your saved events", savedEvents);
  return res.render("savedevent.ejs", {
    username: req.session.username,
    events: savedEvents,
  });
});

app.get("/rsvpedevent", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  let user = await db.collection(USERS).findOne({ username: req.session.username });
  let rsvpedEvents = await db.collection(EVENTS).find({ eventId: { $in: user.rsvp } }).sort({ date: -1 }).toArray();
    
  console.log("here are your rsvped events", rsvpedEvents);
  return res.render("savedevent.ejs", {
    username: req.session.username,
    events: rsvpedEvents,
  });
});

/**
 * This route handles the POST request to the updateProfile page.
 *
 * It opens a connection to the database and retrieves the user's data.
 * It then iterates over the request body, updating the user's data with the new values provided in the request body.
 * It updates the user's data in the database.
 * It updates the username in the session with the new username.
 * It retrieves the updated user's data from the database.
 * It then renders the 'profile.ejs' view, passing the username from the session, the updated user's data, and an empty list of people to the view.

 */
app.post("/updateProfile/", async (req, res) => {
  const db = await Connection.open(mongoUri, DBNAME);
  let users = await db.collection(USERS);
  let data = await users
    .find({ username: req.session.username })
    .project({ name: 1, username: 1, wellesleyEmail: 1, friends: 1, userId:1})
    .toArray();
  console.log(req.body, "body");

  let nameOfUser = req.body['name'];
  // if name of user is being modified you also have to update events database
  if (nameOfUser != "" && nameOfUser != data[0]['name']){
    let events = await db.collection(EVENTS);
    let userId = data[0]["userId"];
    await events.updateMany({idOrganizer: userId}, {$set: {nameOfOrganizer: nameOfUser}});
  }

  // Extract data from req.body and update user info
  for (const key in req.body) {
    if (req.body[key] != "") {
      data[0][key] = req.body[key];
    }
  }

  // Update user info in the database
  await users.updateOne({username: req.session.username }, {$set: data[0]});

  req.session.username = data[0]["username"];

  data = await users
    .find({ username: req.session.username })
    .project({ name: 1, username: 1, wellesleyEmail: 1, friends: 1 })
    .toArray();

  console.log(data, "data");
  return res.render("profile.ejs", {
    username: req.session.username,
    userData: parseInfo(data[0]),
    listPeople: [],
  });
});


// Handle POST requests to "/saveEvent"
app.post("/saveAjax/:eventId", async(req, res) =>{
  let username = req.session.username || "unknown";
  const eventId =parseInt(req.params.eventId);
  
  // Logic to save the event for the current user
  const db = await Connection.open(mongoUri, DBNAME);
  await db
  .collection(USERS)
  .updateOne({ username: username }, { $addToSet: { saved: eventId } });

  // For example, you could add the eventId to the user's saved events list in the database
  // const doc = await likeMovie(tt);
  return res.json({ error: false, eventId:eventId});
 // Send success status
});


// ================================================================
// postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function () {
  console.log(`open http://localhost:${serverPort}`);
});

// ================================================================
// Login
