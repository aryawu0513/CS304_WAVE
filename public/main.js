console.log('main.js loaded');

$(document).ready(function() {
    console.log("HI!!!");
    $(".events-grid").on('click', '.saveBtn', function(event) {
      var eventId = $(this).closest("[data-id]").attr("data-id");
      console.log(eventId)
      saveEvent(eventId);
    });
    $(".events-grid").on('click', '.rsvpBtn', function(event) {
        var eventId = $(this).closest("[data-id]").attr("data-id");
        console.log(eventId)
        rsvpEvent(eventId);
      });
});

function saveEvent(eventId) {
    $.post("/saveAjax/"+eventId, {eventId: eventId}).then(processActionSave);
}

function rsvpEvent(eventId) {
    $.post("/rsvp/"+eventId, {eventId: eventId}).then(processActionRsvp);
}

function processActionSave(resp) {
    console.log('response is ',resp);
    if (resp.error) {
        alert('Error: '+resp.error);
    }
    $(`[data-id=${resp.eventId}]`).find('.saveBtn').text("Saved").prop("disabled", true);;
}

function processActionRsvp(resp) {
    console.log('response is ',resp);
    if (resp.error) {
        alert('Error: '+resp.error);
    }
    $(`[data-id=${resp.eventId}]`).find('.rsvpBtn').text("RSVPed").prop("disabled", true);;
}