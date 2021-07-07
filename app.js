'use strict'
const express = require('express');
const app = express();
const path = require('path');
const port = 2000;
var serv = require('http').Server(app);

app.get('/',function(req, res) {
  // res.sendFile('/Users/PROMISE/WebProjects/HTML\ Games/multi_player/client/index.html');
  res.sendFile(path.join(__dirname,"client/index.html"));
});
app.use('/client', express.static(__dirname + '/client'));
serv.listen(port);
console.log("server started");

var socket_List = {};

function Entity(x, y, spdx, spdy, id) {
    this.x = x,
    this.y = y,
    this.spdx = spdx,
    this.spdy = spdy,
    this.id = id
}
Entity.prototype.updatePosition = function() {
    this.x += this.spdx;
    this.y += this.spdy;
    this.spdx = 0; this.spdy = 0;
};
Entity.prototype.update = function() {
    this.updatePosition();
};

function Player(x, y, spdx, spdy, id) {
    Entity.call(this, x, y, spdx, spdy, id);
    this.number = "" + Math.floor(10 * Math.random()),
    this.pressingUp = false,
    this.pressingDown = false,
    this.pressingLeft = false,
    this.pressingRight = false,
    this.maxSpeed = 5,
    Player.list[this.id] = this
}
Player.list = {}
Player.prototype = Object.create(Entity.prototype);
Player.prototype.constructor = Player;
Player.prototype.updateSpeed = function(){  //rewrite
    if(this.pressingRight){
      this.spdx = this.maxSpeed;}
    if(this.pressingLeft){
      this.spdx = -this.maxSpeed;}
    if(this.pressingDown){
      this.spdy += this.maxSpeed;}
    if(this.pressingUp){
      this.spdy -= this.maxSpeed;}
}
Player.prototype.updatePlayer = function(){
    this.updateSpeed();
    this.update();
}

Player.onConnect = function(socket){
  new Player(250, 250, 0, 0, socket.id);

  socket.on('keyPress', function(data){
    for (let i in Player.list){
      let player = Player.list[i];
      if(player.id === socket.id && data.inputID === 'right'){
        player.pressingRight = data.state;
      }
      if(player.id === socket.id && data.inputID === 'down'){
        player.pressingDown = data.state;
      }
      if(player.id === socket.id && data.inputID === 'left'){
        player.pressingLeft = data.state;
      }
      if(player.id === socket.id && data.inputID === 'up'){
        player.pressingUp = data.state;
      }
    }
  });
}
Player.onDisconnect = function(socket){
  delete Player.list[socket.id];
}
Player.update = function() {
  let pack = [];
  for (let i in Player.list) {
    let player = Player.list[i];
    player.updatePlayer();
    pack.push({
      x: player.x,
      y: player.y,
      number: player.number
    });
  }
  return pack;
}

function Bullet(x, y, spdx, spdy, id, angle) {
    Entity.call(this, x, y, spdx, spdy, id);
    this.angle = angle,
    // this.id = Math.random();
    // this.spdx = Math.cos(angle/ 180 * Math.PI)*10,
    // this.spdy = Math.sin(angle/ 180 * Math.PI)*10,
    this.timer = 0,
    this.toRemove = false,
    Bullet.list[this.id] = this
}
Bullet.list = {};
Bullet.prototype = Object.create(Entity.prototype);
Bullet.prototype.constructor = Bullet;
Bullet.prototype.updateBullet = function(){
  this.spdx+=3;
  this.spdy+=3;
  if(this.timer++ > 100){this.toRemove = true;}
  this.update();
}

Bullet.update = function() {
  if(Math.random() < 0.1){
    let id = Math.random();
    let angle = Math.random()*360;
    let spdx = Math.cos(angle/ 180 * Math.PI)*10;
    let spdy = Math.sin(angle/ 180 * Math.PI)*10;
    new Bullet(150, 150, spdx, spdy, id, angle);
  }
  let pack = [];
  for (let i in Bullet.list) {
    let bullet = Bullet.list[i];
    bullet.updateBullet();
    pack.push({
      x: bullet.x,
      y: bullet.y
    });
  }
  return pack;
}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
  console.log("socket connection");

  socket.id = Math.random();
  socket_List[socket.id] = socket;

  Player.onConnect(socket);

  socket.on('disconnect', function(){
    delete socket_List[socket.id];
    Player.onDisconnect(socket);
  });
});

setInterval(function() {
  let pack = {
    player : Player.update(),
    bullet : Bullet.update()
  };
  for (let i in socket_List){
    let socket = socket_List[i];
    socket.emit('newPosition', pack);
  }

}, 1000/25);

// handling multiple players at the same time with a listen
// every frame, the server updates the player position and sends the new position to client
//
// interativity- using kbd to move players & shoot bullet