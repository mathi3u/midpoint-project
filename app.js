var express = require('express'),
    app = express(),
    path = require('path'),
    http = require('http').Server(app),
    io = require('socket.io')(http);

// integrate GOOGLE API
// https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=48.84,2.35&ole.log(places_results);iadius=500&types=bar&key=AIzaSyA_kca427rr8VLDbX6DSRyquoeQOhravfY

var nicknames = {};
var rooms = ['default-room'];

app.use(express.static(path.join(__dirname, './public')));

function getNearbyPlaces(lat, lng) {
    var googleConfig = {
        "apiKey": "AIzaSyA_kca427rr8VLDbX6DSRyquoeQOhravfY",
        "outputFormat": "json"
    };
    var parameters = {
        location: [lat, lng],
        radius: 500,
        types: ["bar"]
    };
    var max_results = 1;
    var places_results = [];
    var request = require("request")

    var url = "https://maps.googleapis.com/maps/api/place/nearbysearch/"
        + googleConfig.outputFormat + "?"
        + "location=" + parameters["location"][0] + "," + parameters["location"][1]
        + "&radius=" + parameters["radius"] 
        + "&types=" + parameters["types"]
        + "&key=" + googleConfig.apiKey;

    request({
        url: url,
        json: true
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var place;
            for (var i = 0; i < body.results.length && i < max_results; i++) {
                place = {
                    "reference" : body.results[i]["reference"],
                    "name" : body.results[i]["name"],
                    "address" : body.results[i]["vicinity"],
                    "location" : body.results[i].geometry["location"],
                };
                places_results.push(place);
            }
        }
    });
    return places_results;
}


var turf = require('turf');

var centerPoint;

function setCenterPoint(){
    console.log("Centerpoint");
    var features = {
        "type": "FeatureCollection",
        "features": []
    };
    for (var key in nicknames){
        features.features.push({
                "type": "Feature",
                "properties": {},
                "geometry": {
                "type": "Point",
                "coordinates": [nicknames[key].location.lat, nicknames[key].location.lng]
            }
        });
    }
    centerPoint = turf.center(features)["geometry"]["coordinates"];
}

io.on('connection', function (socket) {
    console.log('INFO New connection. Socket id %s', socket.id);

    socket.on('new user', function(n, callback) {
        console.log('INFO New user %s', n.nickname);
        if (n.nickname in nicknames) {
            console.log('WARN user %s already exists', n.nickname);
            callback(false);
        }
        else {
            socket.nickname = n.nickname;
            socket.location = n.location;
            nicknames[socket.nickname] = { "nickname": socket.nickname, "location": socket.location };
            console.log('INFO User %s has been added to the list', socket.nickname);
            callback(true);
            socket.room = rooms[0];
			socket.join(rooms[0]);
            io.to(socket.id).emit('welcome', { "motd": "Welcome " + socket.nickname + "! An apple a day keeps the doctor away", "nicknames": nicknames });
            io.sockets.in(socket.room).emit('user joined', nicknames[socket.nickname]);
            setCenterPoint();
            console.log(centerPoint);
            io.sockets.in(socket.room).emit('midpoint', { "location" : centerPoint, "places":  getNearbyPlaces(centerPoint[0], centerPoint[1])});
        }
    });

    socket.on('send message', function (message) {
        console.log('INFO User %s message "%s"', socket.nickname, message);
        io.sockets.in(socket.room).emit('new message', { id: socket.id, nick: socket.nickname, msg: message, date: Date.now() });
    

        io.sockets.in(socket.room).emit('resp nearby', getNearbyPlaces("lat", "lng"));
    });

    socket.on('disconnect', function () {
        var user = nicknames[socket.nickname];

        if (socket.nickname && nicknames[socket.nickname]) {
            io.sockets.in(socket.room).emit('user left', nicknames[socket.nickname]);
            delete nicknames[socket.nickname];
        }
        console.log('User %s disconnected. Socket id %s', socket.nickname, socket.id);
        console.log(nicknames);
    });
});

http.listen(3000, function () {
    console.log('INFO server listening on: 3000');
});
