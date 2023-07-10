const express = require('express')
const http = require('http')
const socketio = require('socket.io')
const cors=require('cors')
const { userJoin, getRoomUsers, getCurrentUser, userLeave, formateMessage} = require('./users')
const handlebars = require("express-handlebars");

const app = express()
const server = http.createServer(app)
const io = socketio(server)

app.use(cors())
app.use(express.json())


app.get("/rooms/:room", (req, res) =>{
  res.json({room:req.params.room})
})

app.post("/rooms/create", (req, res) =>{
  console.log(req.body)
  res.json({room:req.body.roomName})
})

const socketsStatus = {};

const customHandlebars = handlebars.create({ layoutsDir: "./views" });

app.engine("handlebars", customHandlebars.engine);
app.set("view engine", "handlebars");

app.use("/files", express.static("public")); 



io.on('connection', (socket) => {
  const socketId = socket.id;
  socketsStatus[socket.id] = {};

  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room)
    console.log(user)
    socket.join(user.room)

    // Welcome message
    socket.emit('message', `TextMate Bot :- Welcome to ${room}`)

    // Broadcasting other users
    socket.broadcast.to(room).emit('message', `TextMate Bot :- ${username} has joined the room`)

    // getting room users.
    const users = getRoomUsers(user.room)
    io.to(room).emit('roomUsers', {
      room: user.room,
      users
    })
  })
  socket.on('chatMessage', (msg) => {
    const user = getCurrentUser(socket.id)
    io.to(user.room).emit('chatMessage',formateMessage(user.username,msg))
  })
  socket.on('typing', (username) => {
    const user = getCurrentUser(socket.id)
    console.log(user)
    socket.broadcast.to(user.room).emit('typing',username)
  })
  socket.on('chat', (chat) => {
    const user = getCurrentUser(socket.id)
    io.to(user.room).emit('chat',formateMessage(user.username,chat))
  })
  socket.on('stream', ({room, status}) => {
    const user = getCurrentUser(socket.id)
    io.to(room).emit('stream', {user,status});
  });
  socket.on("voice", function (data) {

    var newData = data.split(";");
    newData[0] = "data:audio/ogg;";
    newData = newData[0] + newData[1];

    for (const id in socketsStatus) {

      if (id != socketId && !socketsStatus[id].mute && socketsStatus[id].online)
        socket.broadcast.to(id).emit("send", newData);
    }

  });
  socket.on("userInformation", function (data) {
    socketsStatus[socketId] = data;
  });
  socket.on('disconnect', () => {
    const user = userLeave(socket.id)
    console.log('one user left')
    delete socketsStatus[socketId];

    if(user){
      // Broadcastion other users on leaving
      io.to(user.room).emit('message', `TextMate Bot :- ${user.username} has left the chat`)

      // getting room users.
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      })
    }
  })
})


server.listen(8080, () => {
  console.log('listening on 8080')
})