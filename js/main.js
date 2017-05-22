'use strict';

//declare control buttons
var call = document.getElementById("call");
var answer = document.getElementById("answer");
var endCall = document.getElementById("hangup");

call.disabled = true;
answer.disabled = true;
endCall.disabled = true;

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

var pcConfig = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  'mandatory': {
    'OfferToReceiveAudio': true,
    'OfferToReceiveVideo': true
  }
};

/////////////////////////////////////////////

var room = 'foo'; //= 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');

var socket = io.connect();
//process username
var controls = document.getElementById("controls");
controls.style.display = "none";

var connect = document.getElementById("connect");
var username = document.getElementById("username");
var login = document.getElementById("login");
var chatName;
//processes username input
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
      controls.style.display = "block";
      startCam();
    });
  }
});

//updates online user list
socket.on('get users', function(data){
  userList.innerHTML ="<h2>Online:</h2>";
  console.log(data);
  for (var i=0; i<data.length; i++){
    userList.innerHTML += "<li id="+data[i]+" class='user'>"+data[i]+"</li>";

  }
});

document.addEventListener("click", function(e){
  if (e.target && e.target.id == "calling"){
    console.log("call starts here....");
    console.log("ALERT!!!!!!!" + pc);
    //maybeStart();
  }
});
var targetName;
document.addEventListener("click", function(e){
  room = chatName;
  if (e.target && e.target.className == "user"){
    e.target.style.color = "green";
    targetName = e.target.id;
    socket.emit('create or join', room);
    console.log('Attempted to create or  join room', room);
    isInitiator = true;
    socket.emit("select user", chatName, targetName);
    dial(chatName);
    call.disabled = false;
    endCall.disabled = false;
  }

});
socket.on("invite", function(data){
  targetName = data;
  console.log("invite from..." + data);
  incoming(data);
  var user = document.getElementsByClassName("user");
  for (var i=0; i<user.length; i++){
    console.log(user[i].id);
    if (user[i].id == data){
      room = data;
      socket.emit('create or join', room);
      console.log('Attempted to create or  join room', room);
      sendMessage('got user media');
    }
  }
  console.log("The room will be:" + room);
  console.log("PC IS...." + pc);
});


///////////////////////////////!!!!!!!!!!!!!!!!!!!!!!!!
if (room != '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

function dial (room){
  if (room !== '') {
    socket.emit('create or join', room);
    console.log('Attempted to create or  join room', room);
  }
}


socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////
var localVideo = document.querySelector('#localVideo');
function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

function incoming(name){
  console.log(room);
  //call.disabled = true;
  console.log("INCOMING CALL...! From" + name);
  //answer.disabled = false;
  //endCall.disabled = true;
  answer.disabled = false;
  endCall.disabled = false;
  call.disabled = true;
  controls.innerHTML += "<div id='incomingCall' style='color:green; float: left; font-weight:bold;'>INCOMING CALL!!! from "+name+"</div>";
/*  if (confirm("Answer Call?")){
    var answer2 = document.getElementById("answer");
    var hangup2 = document.getElementById("hangup");
    var incomingCall = document.getElementById("incomingCall");
    incomingCall.innerHTML = "";
    answer2.disabled = true;
    hangup2.disbaled = false;
    doAnswer();
  }
  else{
    console.log("call rejected");
  } */
}

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    console.log(room);
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    //incoming();
    } else if (message.type === 'answer' && isStarted) {
     pc.setRemoteDescription(new RTCSessionDescription(message));
     localVideo.style.width = "20%";
     remoteVideo.style.width = "100%";
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


var remoteVideo = document.querySelector('#remoteVideo');

function startCam(){
  //call.disabled = false;
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
  //sendMessage('got user media');
  if (isInitiator) {
      maybeStart();
  }
}





var constraints = {
  video: true
};

console.log('Getting user media with constraints', constraints);

if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

function maybeStart() {
  console.log("ALERRT!!!!!!!!!!" + pc);
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    console.log("ALERT!!!!!!" + pc);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      call.addEventListener("click", function(){
        //endCall.disabled = false;
        //call.disabled = true;
        console.log("ALERT!!!!!!!!!" + pc);
        doCall();
      });

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
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log(room);
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  var answer2 = document.getElementById("answer");
  var hangup2 = document.getElementById("hangup");
  var incomingCall = document.getElementById("incomingCall");
  incomingCall.innerHTML = "";
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
  console.log('Hanging up.');
  stop();
  sendMessage('bye');

}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  var resetUserColor = document.getElementById(targetName).style.color = "#ffffff";
  localVideo.style.width = "100%";
  //remoteVideo.style.width = "0%";
  // isAudioMuted = false;
  // isVideoMuted = false;
  pc.close();
  endCall.disabled = true;
  call.disabled = true;
  answer.disabled = true;
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

/*
endCall.addEventListener("click", function(){
  console.log("Sorry - ending call....");
  hangup();
});
*/
