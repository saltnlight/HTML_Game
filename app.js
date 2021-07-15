// 'use strict'
const mongo = require('mongojs');
var db = mongo('localhost:27017/myGame', ['players', 'Progress']);

const express = require('express');
const app = express();
const path = require('path');
const port = 2000;
var serv = require('http').Server(app);

app.get('/',function(req, res) {
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
Entity.prototype.update = function() {
  this.updatePosition();
};
Entity.prototype.updatePosition = function() {
  this.x += this.spdx;
  this.y += this.spdy;
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
    this.maxSpd = 10,
  	this.hp = 10,
  	this.hpMax = 10,
  	this.score = 0,
    Player.list[this.id] = this,
    initPack.player.push(this.getInitPack())
}
Player.list = {}
Player.prototype = Object.create(Entity.prototype);
Player.prototype.constructor = Player;
Player.prototype.updateSpeed = function(){  //rewritten
  if(this.pressingRight){
    this.spdx = this.maxSpeed;
  } else if(this.pressingLeft){
    this.spdx = -this.maxSpeed;
  } else {
    this.spdx = 0;
  }

  if(this.pressingDown){
    this.spdy += this.maxSpeed;
  } else if(this.pressingUp){
    this.spdy -= this.maxSpeed;
  } else {
    this.spdy = 0;
  }
}
Player.prototype.updatePlayer = function(){
  this.updateSpeed();
  this.update();
  if (this.pressingAttack) {
    this.shoot(this.mouseAngle);
  }
}
Player.prototype.getInitPack = function(){
  return {
    id:this.id,
    x:this.x,
    y:this.y,
    number:this.number,
    hp:this.hp,
    hpMax:this.hpMax,
    score:this.score
  };
};
Player.prototype.getUpdatePack = function(){
		return {
			id:this.id,
			x:this.x,
			y:this.y,
			hp:this.hp,
			score:this.score,
		}
};
Player.prototype.shoot = function(angle){
  b = new Bullet(this.id, angle);
  b.x = this.x;
  b.y = this.y;
  return b;
}

Player.update = function() {
  let pack = [];
  for (let i in Player.list) {
    let player = Player.list[i];
    player.updatePlayer();
    pack.push(player.getUpdatePack());
  }
  return pack;
}
Player.getAllInitPack = function(){
	let players = [];
	for(let i in Player.list){ players.push(Player.list[i].getInitPack()); }
	return players;
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

  socket.emit('init',{
		player:Player.getAllInitPack(),
		bullet:Bullet.getAllInitPack(),
	});
}
Player.onDisconnect = function(socket){
  delete Player.list[socket.id];
  removePack.player.push([socket.id]);
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
  Bullet.list[this.id] = this,
  initPack.bullet.push(this.getInitPack())
}
Bullet.list = {};
Bullet.prototype = Object.create(Entity.prototype);
Bullet.prototype.constructor = Bullet;
Bullet.prototype.updateBullet = function(){
  if(this.timer++ > 100){this.toRemove = true;}
  this.update();
  for(let i in Player.list){
    let p = Player.list[i];
    if(this.getDistance(p) < 16 && this.parent !== p.id){
      p.hp -= 1;
			if(p.hp <= 0){
				let shooter = Player.list[this.parent];
				if(shooter){ shooter.score += 1; }
				p.hp = p.hpMax;
				p.x = Math.random() * 500;
				p.y = Math.random() * 500;
			}
      // this.toRemove = true;
    }
  }
}
Bullet.prototype.getInitPack = function(){
  return {
    id:this.id,
    x:this.x,
    y:this.y
  };
};
Bullet.prototype.getUpdatePack = function(){
		return {
			id:this.id,
			x:this.x,
			y:this.y
		}
};

Bullet.update = function() {
  let pack = [];
  for (let i in Bullet.list) {
    let bullet = Bullet.list[i];
    bullet.updateBullet();
    if (bullet.toRemove) {
      delete Bullet.list[i];
      removePack.bullet.push(bullet.id);
    } else {
      pack.push(bullet.getUpdatePack());
    }
  }
  return pack;
}
Bullet.getAllInitPack = function(){
	let bullets = [];
	for(let i in Bullet.list){ bullets.push(Bullet.list[i].getInitPack()); }
	return bullets;
}

const isValidPassword = function (data, cb) {
  db.Player.find({username:data.username, password:data.password}, function (err, res) {
    if (res.length>0) { cb(true);}
    else { cb(false); }    // cb(USERS[data.username] === data.password);
  });
}
const isUsernameTaken = function (data, cb) {
  db.Player.find({username:data.username}, function (err, res) {
    if (res.length>0) {
      cb(true);
    } else {
      cb(false)
    }
  });
}
const addUser = function (data, cb) {
  db.Player.insert({username:data.username, password:data.password}, function (err) {
    cb();
  });
}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
  console.log("socket connection");
  socket.id = Math.random();
  socket_List[socket.id] = socket;

  socket.on('signIn', function(data) {
    isValidPassword(data, function(res) {
      if(res) {
        Player.onConnect(socket);
        socket.emit('sigInResponse', {success:true});
      } else {
        socket.emit('sigInResponse', {success:false});
      }
    });
  });

  socket.on('signUp', function(data) {
    isUsernameTaken(data, function(res) {
      if (res) {
        socket.emit('signUpResponse', {success:false});
      } else {
        addUser(data, function () {
          socket.emit('signUpResponse', {success:true});
        });
      }
    });
  });

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

var initPack = {player:[],bullet:[]};
var removePack = {player:[],bullet:[]};

setInterval(function() {
  let pack = {
    player : Player.update(),
    bullet : Bullet.update()
  };
  for (let i in socket_List){
    let socket = socket_List[i];
		socket.emit('init',initPack);
		socket.emit('update',pack);
		socket.emit('remove',removePack);
  }
  initPack.player = [];
	initPack.bullet = [];
	removePack.player = [];
	removePack.bullet = [];
}, 1000/25);

// handling multiple players at the same time with a listen
// every frame, the server updates the player position and sends the new position to client
//
// interativity- using kbd to move players & shoot bullet
