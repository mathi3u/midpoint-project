var express = require('express'),
    app = express(),
    path = require('path'),
    http = require('http').Server(app),
    io = require('socket.io')(http);

var nicknames = {};


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
                callback(true);
                socket.nickname = n.nickname;
                                socket.location = n.location;
                nicknames[socket.nickname] = { "nickname": socket.nickname, "location": socket.location };
                console.log('INFO User %s has been added to the list', socket.nickname);
                io.to(socket.id).emit('welcome', { "motd": "Welcome " + socket.nickname + "! An apple a day keeps the doctor away", "nicknames": nicknames });
                io.emit('user joined', nicknames[socket.nickname]);
                console.log(nicknames);
            }
        });

        socket.on('send message', function (message){
                console.log('INFO User %s message "%s"', socket.nickname, message);
                io.emit('new message', { id: socket.id, nick: socket.nickname, msg: message, date: Date.now() });
        });


        socket.on('disconnect', function (){
                        var user = nicknames[socket.nickname];

            if (socket.nickname){
                delete nicknames[socket.nickname];
            }
                console.log('User %s disconnected. Socket id %s', socket.nickname, socket.id);
                        if (socket.nickname){
                io.emit('user left', socket.nickname);
                        }
            console.log(nicknames);
        });
});

http.listen(3000, function () {
    console.log('INFO server listening on: 3000');
});
