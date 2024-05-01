console.log('main.js loaded');

$(document).ready(function() {
    console.log("HI!!!");
    $("#events-list").on('click', '.saveBtn', function(event) {
      var eventId = $(this).closest("[data-id]").attr("data-id");
      console.log(eventId)
      saveEvent(eventId);
    });
});

function saveEvent(eventId) {
    $.post("/saveAjax/"+eventId, {eventId: eventId}).then(processAction);
}

function processAction(resp) {
    console.log('response is ',resp);
    if (resp.error) {
        alert('Error: '+resp.error);
    }
    $(`[data-id=${resp.eventId}]`).find('.saveBtn').text("Saved").prop("disabled", true);;
}