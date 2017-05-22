var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var hostroom;

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(process.env.OPENSHIFT_NODEJS_PORT || 8000, process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');

users = [];
connections = [];

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {
  connections.push(socket);
  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    if (message == 'got user media'){
      io.sockets.in(hostroom).emit('message', message);
    }
    else if (message.type == 'offer'){
      io.sockets.in(hostroom).emit('message', message);
    }
    else if (message.type == 'candidate'){
      io.sockets.in(hostroom).emit('message', message);
    }
    else if (message.type == 'answer'){
      io.sockets.in(hostroom).emit('message', message);
    }
    else {
      socket.broadcast.emit('message', message);
    }
    console.log("ROOM = " + hostroom);
    //io.sockets.in(hostroom).emit('ready');
  });



  socket.on('create or join', function(room) {
    hostroom = room;
    log('Received request to create or join room ' + room);

    var numClients = io.sockets.sockets.length;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 1) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
    } else if (numClients === 2) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      //socket.emit('full', room);
        io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      console.log("more in room");
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
    users.splice(users.indexOf(socket.username), 1);
    socket.emit(users);
    updateUsernames();
    connections.splice(connections.indexOf(socket), 1);
    console.log(users);
  });
  socket.on('select user', function(data, callee){
    console.log(data);
    console.log(callee);
    for(var i=0; i<connections.length; i++){
      if (connections[i].username == callee){
        connections[i].emit("invite", data);
        socket.join(data);
      }
      if (connections[i].username == data){
        socket.join(data);
      }
    }
  });
  //on user disconnections
  socket.on ('disconnect', function(data){
    users.splice(users.indexOf(socket.username), 1);
    updateUsernames();
    connections.splice(connections.indexOf(socket), 1);
    console.log('Disconnected: %s sockets connected', connections.length);
  });

  //new user
socket.on('new user', function(data, callback){
  for (var a = 0; a < users.length; a++){
    var duplicate = false;
    if (data == users[a]){
      duplicate = true;
      socket.emit('duplicate username', duplicate);
      return;
    }
  }
  callback(true);
  socket.username = data;
  users.push(socket.username);
  updateUsernames();
});

function updateUsernames(){
  socket.emit("gone home");
  io.sockets.emit('get users', users);
}

});
