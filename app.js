// 'use strict'
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

function Entity() {
    this.x = 250,
    this.y = 250,
    this.spdx = 0,
    this.spdy = 0,
    this.id = ""
}
Entity.prototype.updatePosition = function() {
    this.x += this.spdx;
    this.y += this.spdy;
    this.spdx = 0; this.spdy = 0;
};
Entity.prototype.update = function() {
    this.updatePosition();
};
Entity.prototype.getDistance = function(pt) {
  return Math.sqrt( Math.pow(this.x-pt.x, 2) + Math.pow(this.y-pt.y, 2) );
};

function Player(id) {
    Entity.call(this);
    this.id = id,
    this.number = "" + Math.floor(10 * Math.random()),
    this.pressingUp = false,
    this.pressingDown = false,
    this.pressingLeft = false,
    this.pressingRight = false,
    this.pressingAttack = false,
    this.mouseAngle = 0,
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
Player.prototype.shoot = function(angle){
  b = new Bullet(this.id, angle);
  b.x = this.x;
  b.y = this.y;
  return b;
}
Player.prototype.updatePlayer = function(){
  this.updateSpeed();
  this.update();
  if (this.pressingAttack) {
    this.shoot(this.mouseAngle);
  }
}

Player.onConnect = function(socket){
  new Player(socket.id);

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
      if(player.id === socket.id && data.inputID === 'attack'){
        player.pressingAttack = data.state;
      }
      if(player.id === socket.id && data.inputID === 'mouseAngle'){
        player.mouseAngle = data.state;
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

function Bullet(parent, angle) {
    Entity.call(this);
    this.parent = parent,
    this.angle = angle,
    this.id = Math.random(),
    this.spdx = Math.cos(angle/ 180 * Math.PI)*10,
    this.spdy = Math.sin(angle/ 180 * Math.PI)*10,
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
  for(let i in Player.list){
    let p = Player.list[i];
    if(this.getDistance(p) < 16 && this.parent !== p.id){
      this.toRemove = true;
      //handle collision effect
    }
  }
}

Bullet.update = function() {
  let pack = [];
  for (let i in Bullet.list) {
    let bullet = Bullet.list[i];
    bullet.updateBullet();
    if (bullet.toRemove) {
      delete Bullet.list[i];
    } else {
      pack.push({
        x: bullet.x,
        y: bullet.y
      });
    }
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

  socket.on('msgToServer', function(data){
    let playerName = ('' + socket.id).slice(2,7);
    for (let i in socket_List) {
      socket_List[i].emit('addToChat', playerName +': '+ data)
    }
  });

  socket.on('evalServer', function(data){
    let res = eval(data);
    socket.emit('evalRes', res);
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
