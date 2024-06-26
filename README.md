# CS304_WAVE
This is the final project for CS304 SP2024

[Video link](https://drive.google.com/file/d/1Tr07oEaY4QecFd_FidqLqSrKBs38M5BH/view?usp=share_link)

Team members:Arya Wu, Austen Boodell, Bella Steedly, Mary Jo del Granado


WAVE is a web application, inspired by 25Live, where students can publicize the events they are hosting. Users can upload their own events, see who has RSVP’d to their event, RSVP to posted events, and save events. This allows students to publicize unofficial (and official) events through an organized user interface. Currently many events are publicized through posters placed throughout dorms or on Sidechat. We would like to allow users to publish their posters online and reach a wider audience of students. 25Live is limited to school-sponsored events. WAVE would provide the same benefits without limiting by type of event. Instead, we would allow students to organize their events by tags so users could filter for events they are interested in. 

Status: complete

Direction to use:

When you first run our app, you are taken to a login page. Since you don’t yet have an account, you should click the “create an account button”. This will take you to the register page where you can type in a username and password that you would like to use for the app. If you have entered a username and password that is already in use, you will be taken to the login page to sign in. Otherwise, you will be logged in and redirected to our explore page. Now try clicking on the “Profile” button on the top navigation bar. You can edit your account information there. You can also search for friends and add them. Try searching for Arya with searchtype being "name" and add as friend. You would see your friend count increase. Now click the “logout” button to sign out of your account. You will be logged out and redirected to our login page. Now try entering the username and password you registered with to ensure that your account was in fact successfully created. If you enter an incorrect username or password you will stay on the login page where you can try again to log in or create a new account. Once you successfully login and are directed to the explore page, you can start browsing events. 

When the explore page is initially opened, it will display all events in the database as a scrollable list displaying all of their information. At the top of the page there is a search and a filter bar. To test the filter bar, select the food checkbox and then press the filter button. It should display all events that have food listed as a tag. You can further test the filter button by clicking other filters but not all of them have events in the database yet. To test the search bar type ‘maria’, select Search Type: Host Name and press the search button. The page will display events with organizer names that include ‘maria’. Test again by either selecting or typing in the date 04/16/2024. It will display events happening on that date.  

For addEvent page, you would input the name of your event, the name of the organizer, pick the date, start time, end time, input the location, upload the spam for your event, and choose from a predefined set of tags, and click the CreateEvent button. Any missing input will result in a flash of error. A successful submission will add the event to the Events Collection in the database and route you to MyEvents, where you can see all the events you have created. You would also be able to edit the events you created and see it reflected. You also have the option to delete them.

On the main Explore page you can also save event to view later, or rsvp to events. You would then be able to see the events you saved and rsvped by navigating to the RelatedEvent page. Save event means you might want to come back and revisit the event details, while rsvp means you are saying that you will be attending the event. RSVP adds you to the attendees list, while save is only for you to see so it does not add you to the attendees list.
