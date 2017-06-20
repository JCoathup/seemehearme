'use strict';

//declare control buttons
var call = document.getElementById("call");
var answer = document.getElementById("answer");
var endCall = document.getElementById("hangup");
var ringer = document.getElementById("ringer");
var panel = document.getElementById("panel");

//disable buttons on start
call.disabled = true;
answer.disabled = true;
endCall.disabled = true;

//declare username and login variables
var connect = document.getElementById("connect");
var username = document.getElementById("username");
var login = document.getElementById("login");
var chatName;

var controls = document.getElementById("controls");
var container = document.getElementById("container");
container.style.display = "none";

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var targetName;
var pcConfig = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
};

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  'mandatory': {
    'OfferToReceiveAudio': true,
    'OfferToReceiveVideo': true
  }
};

/////////////////////////////////////////////

//declare room - all new connections go here
var room = 'foo';

//include socket on both client and server files
var socket = io.connect();

//processes username input then starts user cam
connect.addEventListener("click", function(e){
  e.preventDefault();
  if (!username.value == " "){
    // check for duplicate user
    socket.on('duplicate username', function(data){
      if(data == true){
        username.value="";
        username.placeholder = "Username taken!";
        return;
      }
    });
    //no duplicate found... continue
    socket.emit('new user', username.value, function(){
      login.innerHTML = "<p>You are connected as: <span id='chatname'>" + username.value + "</span></p>";
      chatName = username.value;
      container.style.display = "block";
      startCam();
    });
  }
});

//indicate user is busy on call
socket.on("busy", function(host, guest){
  document.getElementById(host).style.color = "orange";
  document.getElementById(host).style.borderColor = "orange";
  document.getElementById(guest).style.color = "orange";
  document.getElementById(guest).style.borderColor = "orange";
});

//indicate user no longer busy on call
socket.on("call over", function(host, guest){
  document.getElementById(host).style.color = "#ffffff";
  document.getElementById(host).style.borderColor = "#999999";
  document.getElementById(guest).style.color = "#ffffff";
  document.getElementById(guest).style.borderColor = "#999999";
});

//updates online user list
socket.on('get users', function(data){
  userList.innerHTML ="<h2>Online:</h2>";
  for (var i=0; i<data.length; i++){
    userList.innerHTML += "<li id="+data[i]+" class='user'>"+data[i]+"</li>";
  }
});

//listens for user to be dialled
document.addEventListener("click", function(e){
  room = chatName;
  //checks if user already busy in call
  if (e.target && e.target.className == "user"){
    if(e.target.style.color == "orange"){
      panel.innerHTML = "<div id = 'callbusy' style='color:orange; font-weight:bold;'>" +e.target.id+" is busy in a call</div>";
      setTimeout(function(){
        panel.innerHTML = "";
      }, 1500);
      return;
    }
    e.target.style.color = "green";
    e.target.style.borderColor = "green";
    targetName = e.target.id;
    socket.emit('create or join', room);
    console.log('Attempted to create or  join room', room);
    isInitiator = true;
    socket.emit("select user", chatName, targetName);
    dial(chatName);
    call.disabled = false;
    endCall.disabled = true;
    answer.disabled = true;
    panel.innerHTML = "<div id='callingWho' style='color:green; font-weight:bold;'>calling " + targetName + "</div";
  }
});

//listens for user to be invited into chat
socket.on("invite", function(data){
  targetName = data;
  incoming(data);
  var user = document.getElementsByClassName("user");
  for (var i=0; i<user.length; i++){
    if (user[i].id == data){
      room = data;
      socket.emit('create or join', room);
      console.log('Attempted to create or  join room', room);
      sendMessage('got user media');
    }
  }
});

///////////////////////////////!!!!!!!!!!!!!!!!!!!!!!!!
if (room != '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

//prepare room ready for chat
function dial (room){
  if (room !== '') {
    socket.emit('create or join', room);
    console.log('Attempted to create or  join room', room);
  }
}

//signals chat room createed
socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

 //signals chat room full - not needed
socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

//waits for someone to join room
socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

//signals another person has joined the room
socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

//logs messages from server
socket.on('log', function(array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

//generic message function
function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

//display who is calling
function incoming(name){
  answer.disabled = false;
  endCall.disabled = false;
  call.disabled = true;
  panel.innerHTML = "<div id='incomingCall'>"+name+" calling...</div>";
  ringer.innerHTML += "<audio autoplay><source src='../sounds/phonering.mp3' type='audio/mp3'><source src='../sounds/phonering.wav' type='audio/wav'>Your browser does not support the audio element.</audio> ";
}

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'answer' && isStarted) {
     pc.setRemoteDescription(new RTCSessionDescription(message));
     call.disabled = "true";
     localVideo.style.width = "20%";
     remoteVideo.style.width = "100%";
     panel.innerHTML ="";
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

function startCam(){
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}

function gotStream(stream) {
  console.log('Adding local stream.');
  localVideo.src = window.URL.createObjectURL(stream);
  localStream = stream;
  if (isInitiator) {
      maybeStart();
  }
}

var constraints = {
  video: true,
  audio: true
};

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
        doCall();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');

};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    remoteVideo.src = window.URL.createObjectURL(event.stream);
    remoteStream = event.stream;
    panel.innerHTML = "";
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  call.disabled = false;
  endCall.disabled = false;
  answer.disabled = true;
  console.log(room);
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  var inCall = document.getElementById(targetName);
  inCall.style.color = "green";
  inCall.style.borderColor = "green";
  ringer.innerHTML = "";
  var answer = document.getElementById("answer");
  panel.innerHTML = "";
  socket.emit("in call", targetName, chatName);
  endCall.disabled = false;
  answer.disabled = true;
  call.disabled = true;
    console.log(pc);
    console.log('Sending answer to peer.');
      pc.createAnswer().then(
        setLocalAndSendMessage,
        onCreateSessionDescriptionError
      );
      localVideo.style.width = "20%";
      remoteVideo.style.width = "100%";
}

function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].url.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'url': 'turn:' + turnServer.name + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    remoteVideo.src = window.URL.createObjectURL(event.stream);
    remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  ringer.innerHTML = "";
  console.log('Hanging up.');
  stop();
  sendMessage('bye');

}

function handleRemoteHangup() {
  ringer.innerHTML = "";
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  panel.innerHTML = "";
  var endCall = document.getElementById("hangup");
  endCall.disabled = true;
  call.disabled = true;
  answer.disabled = true;
  isStarted = false;
  socket.emit("ended call", chatName, targetName);
  var resetUserColor = document.getElementById(targetName).style.color = "#ffffff";
  document.getElementById(targetName).style.borderColor = "#999999";
  localVideo.style.width = "100%";
  //remoteVideo.style.width = "0%";
  // isAudioMuted = false;
  // isVideoMuted = false;
  pc.close();

 //pc = null;
 room = 'foo';
 socket.emit('create or join', room);
}

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
          opusPayload);
      }
      break;
    }
  }
  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);
  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length - 1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }
  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}
