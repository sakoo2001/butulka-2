const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",        // Railway deploy sonrası öz domain-inizi yazın
    methods: ["GET","POST"]
  },
  transports: ['websocket','polling']
});
const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Domino server running on port ${ PORT }`);
});

// routing
const path = require('path')
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); 
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/public/index.html');
});

const fs = require('fs');
const scoreboardFilePath = "./scoreboard.js";
if (fs.existsSync(scoreboardFilePath)) {
	require("./scoreboard")(app);
}

let roomSettings = {
	totalRooms:8, //total rooms
	findPlayer:{
		timeoutTimer:25000, //connection timeout timer
		connectTimer:10000, //connection timer to start (must less than timeoutTimer)
	},
	maxPlayers:[
		{
			game:'guessthesketch',
			total:4
		},
		{
			game:'bingobash',
			total:9
		},
		{
			game:'spotthedifferences',
			total:2
		},
		{
			game:'snakesandladders',
			total:4
		},
		{
			game:'quizgamevs',
			total:4
		},
		{
			game:'tictactoe',
			total:2
		},
		{
			game:'connectfour',
			total:4
		},
		{
			game:'wordsearch',
			total:2
		},
		{
			game:'feedmonster',
			total:4
		},
		{
			game:'slotcarchallenge',
			total:2
		},
		{
			game:'playreversi',
			total:2
		},
		{
			game:'playcheckers',
			total:2
		},
		{
			game:'wheeloffortunequiz',
			total:4
		},
		{
			game:'circlejump',
			total:4
		},
		{
			game:'findme',
			total:4
		},
		{
			game:'cardattack',
			total:2
		},
		{
			game:'typeracer',
			total:4
		},
		{
			game:'playludo',
			total:8
		},
		{
			game:'playdominoes',
			total:4
		},
		{
			game:'wartactics',
			total:2
		},
		{
			game:'findanimals',
			total:2
		},
		{
			game:'findminime',
			total:2
		},
		{
			game:'warship',
			total:2
		},
		{
			game:'warshiproyale',
			total:6
		},
		{
			game:'fourcolors',
			total:4
		},
		{
			game:'rainbowbead',
			total:4
		},
		{
			game:'playhexaboard',
			total:2
		},
		{
			game:'memorychess',
			total:6
		},
		{
			game:'skipcard',
			total:6
		},
		{
			game:'galacticgo',
			total:6
		},
		{
			game:'galacticjunior',
			total:4
		}
	]
}

//text settings
let textDisplay = {
	user:'Oyunçu ',
	room:"Otaq ",
	minPlayers:'Oyuna başlamaq üçün minimum 2 oyunçu lazımdır.',
	joinRoom:"Otağa qoşuldunuz: [ROOM].",
	joinRoomPublic:"[USER] otağa qoşuldu.",
	joinPrivateRoom:"Şəxsi otağa qoşuldunuz: [ROOM].",
	shareCode:"Qoşulmaq üçün [ROOM] kodunu dostlarınızla paylaşın.",
	roomNotFound:"Şəxsi otaq tapılmadı.",
	roomOccupied:"Bu otaqda oyun gedir.",
	roomFull:"Bu otaq doludur.",
	disconnected:"Otaqdan ayrıldınız: [ROOM].",
	disconnectedPublic:"[USER] otaqdan ayrıldı.",
	exitRoom:"[USER] otağı tərk etdi",
	nickNames:["Happy","Dragonfly","Mini Me","Flyby","Ringo","Dorito","Donut","Pickle","Skipper","Amour"]
};


let gameType;
let maxPlayers;
let rooms = [];
let privateRooms = [];
let userIndex = 0;
let connectInterval = null;

for(let n=0; n<roomSettings.totalRooms; n++){
	rooms.push({name:textDisplay.room+(n+1), users:[], id:n, public:true, play:false});
}

//to self: socket.emit('updatechat', );
//to others: socket.broadcast.emit('updatechat', 'SERVER', username + ' has connected to this room');
//to everyone include self: io.sockets.emit('updateusers', usernames);

//to specific room
//socket.broadcast.to(socket.data.room).emit('updateSocketLog', socket.data.username+' has join this room');
//io.sockets.in(rooms[roomIndex].name).emit('updateRooms', 'leave');

io.on('connection', function (socket) {
	socket.on('updateGameType', function(game){
		gameType = game;

		let maxPlayersIndex = roomSettings.maxPlayers.findIndex(x => x.game ===gameType);
		maxPlayers = maxPlayersIndex == -1 ? 2 : roomSettings.maxPlayers[maxPlayersIndex].total;
	});

	socket.on('adduser', function(username){
		let enterName = username == undefined ? false : true;
		let newUser = username == undefined ? textDisplay.user + (userIndex+1) : username;
		socket.data = {username:newUser, entername:enterName, index:userIndex, room:'', roomIndex:''};
		userIndex++;
		
		if(newUser != undefined){
			socket.emit('updateSocketUser', 'success', socket.data);
			socket.emit('updateSocketRooms', 'roomlist', rooms);
		}
	});
	
	socket.on('createroom', function(index){
		//if room exist, if room is not full, if room is not playing
		
		//private
		for(let n = 0; n < 10; n++){
			let roomCode = generateCode(4);
			let roomIndex = privateRooms.findIndex(x => x.name === roomCode);
			if(roomIndex == -1){
				n = 10;
				privateRooms.push({name:roomCode, users:[], id:rooms.length, public:false, play:false, timer:0, matching:false});
			}
		}
		
		let roomIndex = privateRooms.length-1;
		if(!socket.data.entername){
			generateNickNames(privateRooms, roomIndex);
			setUserNickNames(privateRooms, roomIndex);
		}
		
		socket.join(privateRooms[roomIndex].name);
		socket.data.room = privateRooms[roomIndex].name;
		socket.data.public = false;
		privateRooms[roomIndex].users.push({username:socket.data.username, index:socket.data.index, data:[], active:false});

		socket.emit('updateSocketRooms', 'join', socket.data);
		socket.emit('updateSocketLog', getTimeStamp() + textDisplay.joinPrivateRoom.replace('[ROOM]', privateRooms[roomIndex].name));
		socket.emit('updateSocketLog', getTimeStamp() + textDisplay.shareCode.replace('[ROOM]', privateRooms[roomIndex].name));
		socket.broadcast.to(socket.data.room).emit('updateSocketLog', getTimeStamp() + textDisplay.joinRoomPublic.replace('[USER]', socket.data.username));
		socket.emit('updateSocketRooms', 'namelist', privateRooms[roomIndex].users);
	});
	
	socket.on('joinroom', function(name){
		let getRoomInfo = findSocketRoom(name);
		let roomIndex = getRoomInfo.roomIndex;
		let targetArray = getRoomInfo.targetArray;
		
		if(roomIndex == -1){
			socket.emit('updateSocketLog', getTimeStamp() + textDisplay.roomNotFound);
		}else if(targetArray[roomIndex].play){
			socket.emit('updateSocketLog', getTimeStamp() + textDisplay.roomOccupied);
		}else if(targetArray[roomIndex].users.length >= maxPlayers){
			socket.emit('updateSocketLog', getTimeStamp() + textDisplay.roomFull);
		}else{
			if(!socket.data.entername){
				if(targetArray[roomIndex].users.length == 0){
					generateNickNames(targetArray, roomIndex);
				}

				setUserNickNames(targetArray, roomIndex);
			}
			
			socket.join(targetArray[roomIndex].name);
			socket.data.room = targetArray[roomIndex].name;
			targetArray[roomIndex].users.push({username:socket.data.username, index:socket.data.index, data:[], ready:false});

			socket.emit('updateSocketRooms', 'join', socket.data);
			socket.emit('updateSocketLog', getTimeStamp() + textDisplay.joinRoom.replace('[ROOM]', targetArray[roomIndex].name));
			socket.broadcast.to(socket.data.room).emit('updateSocketLog', getTimeStamp() + textDisplay.joinRoomPublic.replace('[USER]', socket.data.username));

			io.sockets.emit('updateSocketRooms', 'roomlist', targetArray);
			io.sockets.in(targetArray[roomIndex].name).emit('updateSocketRooms', 'namelist', targetArray[roomIndex].users);
		}
	});

	socket.on('joinrandomroom', function(name){
		//find room and users
		let roomCode = -1;
		for(let n = 0; n < privateRooms.length; n++){
			if(privateRooms[n].matching && !privateRooms[n].play){
				roomCode = privateRooms[n].name;
			}
		}

		if(roomCode == -1){
			//create new room if no room found
			for(let n = 0; n < 10; n++){
				roomCode = generateCode(4);
				let roomIndex = privateRooms.findIndex(x => x.name === roomCode);
				if(roomIndex == -1){
					n = 10;
					privateRooms.push({name:roomCode, users:[], id:rooms.length, public:false, play:false, timer:0, matching:true});
				}
			}

			let roomIndex = privateRooms.length-1;
			socket.join(privateRooms[roomIndex].name);
			socket.data.room = privateRooms[roomIndex].name;
			socket.data.public = false;

			if(!socket.data.entername){
				if(privateRooms[roomIndex].users.length == 0){
					generateNickNames(privateRooms, roomIndex);
				}

				setUserNickNames(privateRooms, roomIndex);
			}
			privateRooms[roomIndex].users.push({username:socket.data.username, index:socket.data.index, data:[], active:false});
			togglePrivateTimer();
		}else{
			//join exist room if available
			let getRoomInfo = findSocketRoom(roomCode);
			let roomIndex = getRoomInfo.roomIndex;
			let targetArray = getRoomInfo.targetArray;

			if(!socket.data.entername){
				if(targetArray[roomIndex].users.length == 0){
					generateNickNames(targetArray, roomIndex);
				}

				setUserNickNames(targetArray, roomIndex);
			}
		
			socket.join(targetArray[roomIndex].name);
			socket.data.room = targetArray[roomIndex].name;
			targetArray[roomIndex].users.push({username:socket.data.username, index:socket.data.index, data:[], ready:false});

			if(targetArray[roomIndex].users.length >= maxPlayers){
				targetArray[roomIndex].matching = false;
				socket.broadcast.to(socket.data.room).emit('updateSocketRooms', 'matched');
			}
		}
	});
	
	socket.on('exitroom', function(){
		leaveSocketRoom();
	});
	
	socket.on('game', function(status, data, others){
		updateSocketGame(status, data, others);
	});
	
	// when the user disconnects.. perform this
	socket.on('disconnect', function(){
		if(socket.data != undefined){
			if(socket.data.room != ''){
				socket.broadcast.to(socket.data.room).emit('updateSocketLog', getTimeStamp() + textDisplay.disconnectedPublic.replace('[USER]', socket.data.username));
				leaveSocketRoom();
			}
		}
	});
	
	socket.on('closeroom', function(){
		let getRoomInfo = findSocketRoom(socket.data.room);
		let roomIndex = getRoomInfo.roomIndex;
		let targetArray = getRoomInfo.targetArray;
		
		if(targetArray[roomIndex] == undefined || targetArray[roomIndex].name == undefined){
			return;
		}
		
		socket.leave(targetArray[roomIndex].name);
		socket.data.room = '';
		
		targetArray[roomIndex].users.length = 0;
		targetArray[roomIndex].play = false;
		
		for(let n = 0; n < privateRooms.length; n++){
			if(privateRooms[n].users.length == 0){
				privateRooms.splice(n,1);
			}
		}
		togglePrivateTimer();
		io.sockets.emit('updateSocketRooms', 'roomlist', rooms);
	});
	
	function returnUserTurn(getRoomInfo, con, status){
		let roomIndex = getRoomInfo.roomIndex;
		let targetArray = getRoomInfo.targetArray;
		
		if(targetArray[roomIndex].turn != undefined){
			let turnIncrease = con;
			for(let n=0; n<maxPlayers; n++){
				if(turnIncrease){
					targetArray[roomIndex].turn++;
					targetArray[roomIndex].turn = targetArray[roomIndex].turn > targetArray[roomIndex].users.length-1 ? 0 : targetArray[roomIndex].turn;
				}
				
				if(targetArray[roomIndex].users[targetArray[roomIndex].turn].active){
					n = maxPlayers;
				}else{
					turnIncrease = true;
				}
			}

			let postData = {turn:targetArray[roomIndex].turn, index:targetArray[roomIndex].users[targetArray[roomIndex].turn].index, username:targetArray[roomIndex].users[targetArray[roomIndex].turn].username};
			io.sockets.in(targetArray[roomIndex].name).emit('updateSocketGame', status, postData, getTimeStamp());
		}
	}
	
	function leaveSocketRoom(){
		let getRoomInfo = findSocketRoom(socket.data.room);
		let roomIndex = getRoomInfo.roomIndex;
		let targetArray = getRoomInfo.targetArray;
		
		if(roomIndex == -1){
			return;
		}
		
		socket.leave(targetArray[roomIndex].name);
		socket.emit('updateSocketLog', getTimeStamp() + textDisplay.disconnected.replace('[ROOM]', targetArray[roomIndex].name));
		socket.data.room = '';
		
		let userIndex = targetArray[roomIndex].users.findIndex(x => x.index === Number(socket.data.index));
		if(targetArray[roomIndex].play){
			targetArray[roomIndex].users[userIndex].active = false;
			returnUserTurn(getRoomInfo, false);
		}else{
			targetArray[roomIndex].users.splice(userIndex, 1);

			if(!socket.data.enterName && Array.isArray(targetArray[roomIndex].nickNamesIndex)){
				let thisNickNameIndex = userIndex;
				targetArray[roomIndex].nickNamesIndex.splice(userIndex, 1);
				targetArray[roomIndex].nickNamesIndex.push(thisNickNameIndex);
			}
		}
		
		let notiCon = targetArray[roomIndex].play == true ? true : false;
		socket.broadcast.to(targetArray[roomIndex].name).emit('updateGameSocketLog', {time:getTimeStamp(), message:textDisplay.exitRoom.replace('[USER]', socket.data.username), noti:notiCon});
		socket.broadcast.to(targetArray[roomIndex].name).emit('updateSocketLog', getTimeStamp() + textDisplay.exitRoom.replace('[USER]', socket.data.username));
		io.sockets.in(targetArray[roomIndex].name).emit('updateSocketRooms', 'namelist', targetArray[roomIndex].users);
		
		socket.emit('updateSocketRooms', 'exit', socket.data);
		
		//if is host leaving force everyone leave if playing
		if(userIndex == 0 && targetArray[roomIndex].play){
			targetArray[roomIndex].users.length = 0;
			io.sockets.in(targetArray[roomIndex].name).emit('updateSocketRooms', 'leave');
		}
		
		//clear room
		for(let n = 0; n < rooms.length; n++){
			if(rooms[n].users.length == 0){
				rooms[n].play = false;
			}
		}
		
		for(let n = 0; n < privateRooms.length; n++){
			if(privateRooms[n].users.length == 0){
				privateRooms.splice(n,1);
			}
		}
		
		togglePrivateTimer();
		io.sockets.emit('updateSocketRooms', 'roomlist', rooms);
	}

	function togglePrivateTimer(){
		let startInterval = false;
		for(let n = 0; n < privateRooms.length; n++){
			if(privateRooms[n].matching == true && !privateRooms[n].play){
				startInterval = true;
			}
		}

		if(startInterval){
			if(connectInterval == null){
				connectInterval = setInterval(privateTimerFunc,1000);
			}
		}else{
			if(connectInterval != null){
				clearInterval(connectInterval);
				connectInterval = null;
			}
		}
	}

	function privateTimerFunc(){
		for(let n = 0; n < privateRooms.length; n++){
			if(privateRooms[n].matching == true && !privateRooms[n].play){
				privateRooms[n].timer += 1000;

				if(privateRooms[n].timer >= roomSettings.findPlayer.timeoutTimer){
					if(privateRooms[n].users.length <= 1){
						privateRooms[n].matching = false;					
						io.sockets.in(privateRooms[n].name).emit('updateSocketRooms', 'timeout');
					}
				}else if(privateRooms[n].timer >= roomSettings.findPlayer.connectTimer){
					if(privateRooms[n].users.length >= 2){
						privateRooms[n].matching = false;
						socket.broadcast.to(privateRooms[n].name).emit('updateSocketRooms', 'matched');
					}
				}
			}
		}
	}
	
	function findSocketRoom(name){
		let targetArray = rooms;
		let roomIndex = rooms.findIndex(x => x.name === name);
		socket.data.public = true;
		
		if(roomIndex == -1){
			//private
			roomIndex = privateRooms.findIndex(x => x.name === name);
			if(roomIndex != -1){
				targetArray = privateRooms;	
				socket.data.public = false;
			}
		}
		
		return {roomIndex:roomIndex, targetArray:targetArray};
	}
	
	function generateCode(length) {
		//let chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', result="";
		let chars = '0123456789', result="";
		for (let i = length; i > 0; --i)
			result += chars[Math.round(Math.random() * (chars.length - 1))]
		return result
	}

	function generateNickNames(targetArray, roomIndex){
		let nickNamesArray = [];
		for(let n=0; n<textDisplay.nickNames.length; n++ ){
			nickNamesArray.push(n);
		}
		nickNamesArray = nickNamesArray.sort(() => Math.random() - 0.5);
		targetArray[roomIndex].nickNamesIndex = nickNamesArray;

		socket.data.username = targetArray[roomIndex].nickNamesIndex[targetArray[roomIndex].users.length];
	}

	function setUserNickNames(targetArray, roomIndex){
		socket.data.username = textDisplay.nickNames[targetArray[roomIndex].nickNamesIndex[targetArray[roomIndex].users.length]];
	}

	function getTimeStamp(){
		let date_ob = new Date();
		let date = ("0" + date_ob.getDate()).slice(-2);
		let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
		let year = date_ob.getFullYear();
		let hours = date_ob.getHours();
		let minutes = date_ob.getMinutes();
		let seconds = date_ob.getSeconds();

		return hours + ":" + minutes + ' ';
	}

	function checkEnoughPlayer(players){
		if(players == 1){
			socket.emit('updateSocketLog', getTimeStamp() + textDisplay.minPlayers);
			return false;
		}else{
			return true;
		}
	}

	function updateSocketGame(status, data, others){
		let getRoomInfo = findSocketRoom(socket.data.room);
		let roomIndex = getRoomInfo.roomIndex;
		let targetArray = getRoomInfo.targetArray;
		
		if(targetArray[roomIndex] == undefined || targetArray[roomIndex].name == undefined){
			return;
		}

		if(status == 'init'){
			if(!checkEnoughPlayer(targetArray[roomIndex].users.length)){
				return;
			}

			for(let n=0; n<targetArray[roomIndex].users.length; n++){
				targetArray[roomIndex].users[n].active = true;
			}
			
			targetArray[roomIndex].play = true;
			io.sockets.emit('updateSocketRooms', 'roomlist', rooms);
			io.sockets.in(targetArray[roomIndex].name).emit('updateSocketGame', status, targetArray[roomIndex].users);
			return;
		}

		if(gameType == "snakesandladders"){
			if(status == 'start'){
				let randomTurn = Math.floor(Math.random()*targetArray[roomIndex].users.length);
				targetArray[roomIndex].turn = randomTurn;
				let postData = {turn:randomTurn, index:targetArray[roomIndex].users[randomTurn].index, username:targetArray[roomIndex].users[randomTurn].username};
				io.sockets.in(targetArray[roomIndex].name).emit('updateSocketGame', status, postData, getTimeStamp());
				return;
			}else if(status == 'nextplayer'){
				returnUserTurn(getRoomInfo, true, status);
				return;
			}
		}else if(gameType == "tictactoe" || gameType == "connectfour" || gameType == "wordsearch"){
			if(status == 'start'){
				let randomTurn = Math.floor(Math.random()*targetArray[roomIndex].users.length);
				targetArray[roomIndex].userTurn = randomTurn;
				targetArray[roomIndex].turn = randomTurn;
				let postData = {turn:randomTurn, index:targetArray[roomIndex].users[randomTurn].index, username:targetArray[roomIndex].users[randomTurn].username};
				io.sockets.in(targetArray[roomIndex].name).emit('updateSocketGame', status, postData, getTimeStamp());
				return;
			}else if(status == 'updatemovecomplete'){
				returnUserTurn(getRoomInfo, true, status);
				return;
			}else if(status == 'updateroundcomplete'){
				targetArray[roomIndex].userTurn = targetArray[roomIndex].userTurn == 1 ? 0 : 1;
				targetArray[roomIndex].turn = targetArray[roomIndex].userTurn == 1 ? 0 : 1;
				returnUserTurn(getRoomInfo, true, status);
				return;
			}
		}else if(gameType == "playreversi" || gameType == "playcheckers" || gameType == "playchess"){
			if(status == 'start'){
				let randomTurn = Math.floor(Math.random()*targetArray[roomIndex].users.length);
				targetArray[roomIndex].turn = randomTurn;
				let postData = {turn:randomTurn, index:targetArray[roomIndex].users[randomTurn].index, username:targetArray[roomIndex].users[randomTurn].username};
				io.sockets.in(targetArray[roomIndex].name).emit('updateSocketGame', status, postData, getTimeStamp());
				return;
			}else if(status == 'updatemovecomplete'){
				let postData = {index:data.index, username:targetArray[roomIndex].users[data.index].username};
				io.sockets.in(targetArray[roomIndex].name).emit('updateSocketGame', status, postData, getTimeStamp());
				return;
			}
		}

		if(others){
			socket.broadcast.to(targetArray[roomIndex].name).emit('updateSocketGame', status, data, getTimeStamp());
		}else{
			io.sockets.in(targetArray[roomIndex].name).emit('updateSocketGame', status, data, getTimeStamp());
		}
	}
});