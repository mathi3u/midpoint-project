var express = require('express'),
    app = express(),
    path = require('path'),
    http = require('http').Server(app),
    io = require('socket.io')(http);

var foursquare = (require('node-foursquare-venues'))(
    'U24XYADHDFEEPQYJ5UEXGRUFTDGQPZBTPQKR1WPZ43NYVPVF',
    'HEVKYCMH04PXO2E0XTPYULFIBLI5XYGNGYFOXIXXVQA4GWZP'
);
 
var params = {
    "ll": "40.7,-74"
};


foursquare.venues.search({"ll":"48.86923, 2.306294", "radius":1000, "category":"bar"}, function(error, v) {
    if (!error) {
        console.log(v.response.venues[0]);
    }
});



var nicknames = {};
var rooms = ['default-room'];

app.use(express.static(path.join(__dirname, './public')));




io.on('connection', function (socket) {
    console.log('INFO New connection. Socket id %s', socket.id);

    socket.on('new user', function(n, callback){
        console.log('INFO New user %s', n.nickname);
        if (n.nickname in nicknames){
            console.log('WARN user %s already exists', n.nickname);
            callback(false);
        }
        else{
            socket.nickname = n.nickname;
            socket.location = n.location;
            nicknames[socket.nickname] = { "nickname": socket.nickname, "location": socket.location };
            console.log('INFO User %s has been added to the list', socket.nickname);
            callback(true);
            socket.room = rooms[0];
			socket.join(rooms[0]);
            io.to(socket.id).emit('welcome', { "motd": "Welcome " + socket.nickname + "! An apple a day keeps the doctor away", "nicknames": nicknames });
            io.sockets.in(socket.room).emit('user joined', nicknames[socket.nickname]);
            console.log(nicknames);
        }
    });

    socket.on('send message', function (message){
        console.log('INFO User %s message "%s"', socket.nickname, message);
        io.sockets.in(socket.room).emit('new message', { id: socket.id, nick: socket.nickname, msg: message, date: Date.now() });
    });

    socket.on('disconnect', function (){
        var user = nicknames[socket.nickname];

        if (socket.nickname && nicknames[socket.nickname]){
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
