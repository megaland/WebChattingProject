var express = require('express');
var app = express();
var session = require('express-session');
var bodyparser = require('body-parser');
var mysql = require('mysql');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var connection = mysql.createConnection({
  host : 'localhost',
  user : 'root',
  password : '1234',
  database : 'webchatting'
});

connection.connect();

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(bodyparser.urlencoded({extended : false}));
app.use(session({
  secret : 'eroij8t58t45t',
  resave : false,
  saveUninitialized : true
}));

var getdatenow = function(){
  var date = new Date();
  var nowdate;
  if(date.getDate() > 9){
    nowdate = date.getDate();
  }else {
    nowdate = "0"+date.getDate();
  }
  var datestr = ""+date.getFullYear()+(date.getMonth()+1)+nowdate+date.getHours()+date.getMinutes()+date.getSeconds();
  return datestr;
};

//로그인---------------------
app.get('/', function(req, res){
  res.render('login');
});

app.post('/login', function(req, res){
  console.log( req.body.id + ' : '  +req.body.password);
  var sql = "select * from usertbl where id ='" + req.body.id +"' and password ='" + req.body.password + "'";
  connection.query(sql, function(err, rows, fields){
    var newjson;
    if(rows.length ===0){
      newjson = {result : 'fail'};
      console.log(newjson);
      res.send(JSON.stringify(newjson));
    }else {
      req.session.login = rows[0].id;
      newjson = {result : 'success', login : req.session.login};
      console.log(newjson);
      res.send(JSON.stringify(newjson));
    }
  });

});

//회원가입---------------------
app.get('/insertmember', function(req, res){
  res.render('insertmember');
});

app.post('/insertmember', function(req, res){
  var sql = 'insert into usertbl (id, password, nickname, email) values(?, ?, ?, ?)';
  console.log(req.body.id);
  var values = [req.body.id, req.body.passwordone, req.body.nickname, req.body.email];
  connection.query(sql, values, function(err, rows, fields){
    if(err){
      console.log(err);
    }
    res.redirect('/main');
  });

});


app.post('/checkid', function(req, res){
  var sql = "select id from usertbl where id = '" + req.body.id+"'";
  connection.query(sql, function(err, rows, fields){
    if(err){
      console.log('err');
    }
    if(rows.length === 0){
      console.log('없음');
      res.send('success');
    }else{
      res.send('exist');
    }
    console.log(rows);
  });
});

//메인---------------------------
app.get('/main', function(req, res){
  console.log(req.session.login);
  var sql = "select * from roomtbl where id='" + req.session.login+"'";
  var rooms = [];
  connection.query(sql, function(err, rows, fields){
    if(err){
      console.log('err');
    }

    for (var i = 0; i < rows.length; i++) {
      rooms.push(rows[i]);
    }
    res.render('main', {login : req.session.login, rooms : rooms});
  });

});

app.post('/getpostlist', function(req, res){
  var sql = "select * from conversationtbl where roomnum = '"+
              req.body.roomnum+"' and regdate > '" +
              req.body.lastreadnum +"'";
  connection.query(sql, function(err, rows, fields){
    res.send(rows);
  });

});

app.post('/getroommembers', function(req, res){
  var sql = "select * from roomtbl where roomnum = '"+req.body.roomnum+"'";
  connection.query(sql, function(err, rows, fields){
    var roommembers = [];
    for (var i = 0; i < rows.length; i++) {
      roommembers.push(rows[i].id);
    }
    res.send(roommembers);
  });


});

//방만들기----------------------------
app.get('/createroom', function(req, res){
  res.render('createroom', {login : req.session.login});
});

app.post('/searchsomeone', function(req, res){
  console.log(req.body.searchword);
  var sql;
  if(!req.body.searchword){
    sql = "select * from usertbl limit 30";
  }else {
    sql = "select * from usertbl where id like '%"+req.body.searchword+ "%' limit 30";
  }
  connection.query(sql, function(err, rows, fields){
    res.send(rows);
  });
});

app.post('/createroom', function(req, res){
  var checkedid = JSON.parse(req.body.checkedid);
  console.log(req.body.roomname);
  var loopfunction = function(err, rows, fields){
    if(err){
      console.log(err);
    }

  };
  var loopfunctionfinal = function(err,rows, fields){
    if(err){
      console.log(err);
    }
    res.send('새방이 생성되었습니다.');
  };
  var sql = "select count(*) as roomcount from roomtbl";
  connection.query(sql, function(err, rows, fields){
    if(err){
      console.log(err);
    }
    for (var i = 0; i < checkedid.length; i++) {
      var secondsql = "insert into roomtbl (id, roomnum, regdate, roomname) values('"+checkedid[i]+"', ?, ?, ?)";
      var param = [rows[0].roomcount, getdatenow(), req.body.roomname];
      if(i == (checkedid.length - 1)){
        connection.query(secondsql, param, loopfunctionfinal);
      }else {
        connection.query(secondsql, param, loopfunction);
      }
    }
  });

});

//통신--------------------------
var ids = [];
io.on('connection', function(socket){
  var socketid = socket.id;

  socket.on('init', function(login){
    var newid = {socketid : socketid, login : login};
    ids.push(newid);
  });

  for (var i = 0; i < ids.length; i++) {
    console.log('user connected : ' + ids[i].login);
  }

  socket.on('take action', function(msg){
    var idtookmsg = [];
    for (var i = 0; i < msg.roommembers.length; i++){
      for (var j = 0; j < ids.length; j++){
        if(ids[j].login == msg.roommembers[i]){
          idtookmsg.push(ids[j].socketid);
        }
      }
    }
    var chatdate = getdatenow();
    var sql = "insert into conversationtbl (content, regdate, writer, roomnum) values('"+
              msg.chattext+"', '"+
              chatdate + "', '"+
              msg.login+"', '"+msg.roomnum+"')";
    connection.query(sql, function(err, rows, fields){
      if(err){
        console.log(err);
      }else {
        console.log('success');
      }

    });
    for (var k = 0; k < idtookmsg.length; k++) {
      io.to(idtookmsg[k]).emit('take msg', {msg : msg.login +" : "+msg.chattext, roomnum : msg.roomnum});
      //io.to(idtookmsg[k]).emit('take msg', msg.login +" : "+msg.chattext + chatdate);
    }
  });
});

http.listen(3000, function(){
    console.log('connected');
});



// app.listen(3000, function(){
//   console.log('connected');
// });
