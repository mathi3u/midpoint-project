var express = require('express'),
    app = express(),
    path = require('path'),
    http = require('http').Server(app),
    io = require('socket.io')(http),
    turf = require('turf'),
    request = require("sync-request");

var nicknames = {};
var rooms = [];

app.use(express.static(path.join(__dirname, './public')));

function getNearbyPlaces(latlng) {
    var googleConfig = {
        "apiKey": "AIzaSyA_kca427rr8VLDbX6DSRyquoeQOhravfY",
        "outputFormat": "json"
    };
    var parameters = {
        location: latlng,
        radius: 5000,
        types: ["bar"]
    };
    var max_results = 5;
    var places_results = [];

    var url = "https://maps.googleapis.com/maps/api/place/nearbysearch/"
        + googleConfig.outputFormat + "?"
        + "location=" + parameters.location.lat + "," + parameters.location.lng
        + "&rankby=" + "distance" 
        + "&types=" + parameters["types"]
        + "&key=" + googleConfig.apiKey;

 	var res = JSON.parse(request('GET', url, ["json"]).getBody('utf8'))["results"];
    var place;
    
    for (var i = 0; i < res.length && i < max_results; i++) {
        place = {
            "place_id" : res[i]["place_id"],
            "name" : res[i]["name"],
            "address" : res[i]["vicinity"],
            "location" : res[i].geometry["location"],
        };
        places_results.push(place);
    }
    return places_results;
}

function setCenterPoint(room){
    var features = {
        "type": "FeatureCollection",
        "features": []
    };
    for (var key in rooms[room].nicknames){
        features.features.push({
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Point",
                "coordinates": [ rooms[room].nicknames[key].location.lat, rooms[room].nicknames[key].location.lng ]
            }
        });
    }
    rooms[room].venueLatlng = turf.center(features)["geometry"]["coordinates"];
}

function createRoom(venueLocation) {
    var key = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 3); // to be updated
    console.log("INFO Create room " + key);
    rooms[key] = { 
        key: key,
        nicknames: {},
        venueLatlng: (venueLocation ? venueLocation : null),
        fixedVenueLocation: !!venueLocation // ugly operator, to be clarified later
    };
    return key;
}

function addUserToRoom(socket) {
    console.log("INFO User %s has joined room %s", socket.nickname, socket.room);
    socket.join(socket.room);
    rooms[socket.room].nicknames[socket.nickname] = {
        "nickname": socket.nickname,
        "location": socket.location
    };
    if (!rooms[socket.room].fixedVenueLocation) {
        setCenterPoint(socket.room);
    }
}

function removeUserFromRoom(socket) {
    console.log('User %s disconnected. Socket id %s', socket.nickname, socket.id);
    delete rooms[socket.room].nicknames[socket.nickname];
    console.log(rooms[socket.room].nicknames);
    socket.leave(socket.room);
    if (!Object.keys(rooms[socket.room].nicknames).length) {
        delete rooms[socket.room];
    }
    else {
        if (!rooms[socket.room].fixedVenueLocation) {
            setCenterPoint(socket.room);
        }
    }
//    console.log(rooms);
}

function removeUser(nickname) {
    delete nicknames[nickname];
}

io.on('connection', function (socket) {
    console.log('INFO New connection. Socket id %s', socket.id);

    socket.on('new user', function(n, callback) {
        console.log('INFO New user %s', n.nickname);
        if (n.nickname in nicknames) {
            console.log('WARN user %s already exists', n.nickname);
            callback(false, null, "nickname " + n.nickname + "already exists");
        } else if (n.room && !(n.room in rooms)) {
            console.log('WARN there is an issue with room %s that user %s is trying to access', n.room, n.nickname);
            callback(false, n.room, "nickname issue with room " + n.room);
	} else {
            socket.nickname = n.nickname;
            socket.location = n.location;
            socket.room = n.room ? n.room : createRoom(n.venueLocation);

            addUserToRoom(socket);

            callback(true, socket.room, null);
            io.to(socket.id).emit('welcome', {
                "room": socket.room,
                "motd": "Welcome " + socket.nickname + "! An apple a day keeps the doctor away",
                "nicknames": rooms[socket.room].nicknames
            });
            io.sockets.in(socket.room).emit('user joined', {
                "nickname": socket.nickname,
                "location": socket.location
            });
            io.sockets.in(socket.room).emit('venue area', { 
                "location": rooms[socket.room].venueLatlng,
                "places": getNearbyPlaces(rooms[socket.room].venueLatlng)
            });
        }
    });

    socket.on('send message', function (message) {
        console.log('INFO User %s message "%s"', socket.nickname, message);
        io.sockets.in(socket.room).emit('new message', { 
            id: socket.id,
            nick: socket.nickname,
            msg: message, date: Date.now()
        });
    });

    socket.on('disconnect', function () {
        console.log('INFO User %s disconnecting', socket.nickname);
        if (socket.nickname) {
	    io.sockets.in(socket.room).emit('user left', rooms[socket.room].nicknames[socket.nickname]);
            removeUserFromRoom(socket);
            if (rooms[socket.room]) {
                io.sockets.in(socket.room).emit('venue area', {
                    "location": rooms[socket.room].venueLatlng,
                    "places": getNearbyPlaces(rooms[socket.room].venueLatlng)
                });
            }
            removeUser(socket.nickname);
        }
    });
});

http.listen(3000, function () {
    console.log('INFO server listening on: 3000');
});
