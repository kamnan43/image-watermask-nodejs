//'use strict';
var express = require('express'),
	request = require('request'),
	bodyParser = require('body-parser'),
	fs = require('fs'),
	path = require('path'),
	https = require('https'),
	fetch = require('node-fetch');
var line = require('./line');
var config = require('./config.json');
var firebase = require("firebase-admin");
const git = require('./git-deploy');

var serviceAccount = require("./sitthi-watermask-firebase-adminsdk-1vhp3-0ee0c1397a.json");
var firebaseConfig = {
	apiKey: "AIzaSyDiRpxLyRN6C_tXvFsi_fPo-5H-qX4P25M",
	authDomain: "sitthi-watermask.firebaseapp.com",
	databaseURL: "https://sitthi-watermask.firebaseio.com",
	projectId: "sitthi-watermask",
	storageBucket: "",
	messagingSenderId: "69962686935",
	credential: firebase.credential.cert(serviceAccount)
};
firebase.initializeApp(firebaseConfig);
var database = firebase.database();
var txRef = database.ref("/tx");
var cardRef = database.ref("/card");

var http = express();
var port = process.env.PORT;
var baseURL = 'https://sitthi.me:3802';
var phpBaseURL = 'https://sitthi.me/php';

var WaterMaskLinkGroup = 'C3b7e6fbec12fb99ed3028445e25cf17f';
var myUserId = 'U69e0b9d439801778e46aea539685a0a7';
var lastCardInfo;
var currentSetNumber;
var currentSetImage = [];

console.log('start...');
http.use(bodyParser.json());

http.use(express.static(__dirname + '/public'));

http.post('/git', function (req, res) {
	res.status(200).end();
	git.deploy({
		origin: "origin",
		branch: "master"
	});
});

http.get('/view', function (req, res) {
	getTx(req.query.key, function (obj) {
		var header = '<html><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><body>\n';
		var footer = '</body></html>';
		var body = '';

		if (obj) {
			if (obj.index == '' || obj.index == '0') {
				for (var i = 1; i <= config.setA[obj.set - 1].qty; i++) {
					body += appendBody(req.query.key, i);
				}
			} else {
				body += appendBody(req.query.key, obj.index);
			}
		}

		if (body == '') body = '<img width="80%" src="joker.jpg" />\n';
		//body += appendAds();
		res.status(200).end(header + body + footer);
	})
});

http.get('/gen', function (req, res) {
	getTx(req.query.key, function (obj) {
		if (obj) {
			request.get(getImageUrl(obj.set, obj.lineId, req.query.index)).pipe(res);
		} else {
			res.status(404).end();
		}
	})
});

http.get('/healthcheck', function (req, res) {
	res.status(200).end('OK');
});

http.post('/events', line.verifyRequest, function (req, res) {
	console.log('events:' + JSON.stringify(req.body));
	res.status(200).end();

	var events = req.body.events;
	events.forEach(function (event) {

		if (event.type == 'message') {
			if (event.message.type == 'text') {
				if (event.message.text != 'undefined' && event.message.text != '' && event.source.userId != 'undefined') {
					if ((event.source.userId === myUserId) && (event.source.type === 'user')) {
						// admin set
						if (event.message.text.startsWith('set')) {
							var line = event.message.text.split(/\r?\n|\r/g);
							var num = line[0].split(" ");
							line.shift();
							currentSetNumber = num[1];
							currentSetImage = line;
							sendLine(event.source.userId, 'กำลังบันทึก ' + currentSetImage.length + ' ภาพ ในเซต ' + currentSetNumber + '\nกรุณารอสักครู่...');
							saveImage(currentSetNumber);
							sendLine(event.source.userId, 'เสร็จเรียบร้อยครับ ทดลองใช้ได้เลย');
							let setConfig = {
								id: currentSetNumber,
								qty: currentSetImage.length,
							}
							if (currentSetNumber > config.setA.length) {
								config.setA.push(setConfig);
							} else {
								config.setA[currentSetNumber - 1] = setConfig;
							}
							// saveConfig();
						}
					}
					if (event.message.text.startsWith('$') && ((event.source.groupId === WaterMaskLinkGroup) || (event.source.userId === myUserId))) {
						processTextMessage('watermask', event, event.message.text.replace('$', ''));
					}
				}
			} else if (event.message.type == 'image') {
				if ((event.source.userId === myUserId) && (event.source.type === 'user')) {
					if (currentSetNumber) {
						currentSetImage.push(event.message.id);
					} else {
						sendLine(event.source.userId, 'เริ่มต้นด้วยการพิมพ์ set ก่อน เช่น set 88');
					}
				}
			}
		};
	})
});

function processTextMessage(service, event, commandStr) {

	switch (service) {
		case 'watermask':
			var arr = commandStr.trim().replace(/\r?\n|\r/g, "").split(" ");
			var setStr = arr[0].trim();
			var setArr = setStr.split(".");
			var setNo = setArr[0].trim();
			var indexNo = '0';
			if (isNaN(setStr)) {
				sendLine(event.source.groupId, 'เลขเซตไม่ถูกต้อง');
				break;
			}
			//------------------------------------------------------------------------------------------------
			if (setNo < 1) {
				sendLine(event.source.groupId, 'ตอนนี้มีแค่เซต 1-' + config.setA.length + ' ครับ');
				break;
			}
			if (setNo > config.setA.length) {
				sendLine(event.source.groupId, 'ตอนนี้มีแค่เซต 1-' + config.setA.length + ' ครับ');
				break;
			}
			//------------------------------------------------------------------------------------------------
			if (setArr.length >= 2) {
				indexNo = setArr[1].trim();
				if (indexNo < 1) {
					sendLine(event.source.groupId, 'เซต ' + setNo + ' มี ' + config.setA[setNo - 1].qty + ' ภาพ กรุณาระบุ 1-' + config.setA[setNo - 1].qty + ' ครับ');
					break;
				}
				if (indexNo > config.setA[setNo - 1].qty) {
					sendLine(event.source.groupId, 'เซต ' + setNo + ' มี ' + config.setA[setNo - 1].qty + ' ภาพ กรุณาระบุ 1-' + config.setA[setNo - 1].qty + ' ครับ');
					break;
				}
			}
			//------------------------------------------------------------------------------------------------
			if (arr.length < 2) {
				sendLine(event.source.groupId, 'ยังไม่ได้ระบุ LineID');
				break;
			}
			var idStr = arr[1].trim();
			if (idStr.length < 3) {
				sendLine(event.source.groupId, 'รูปแบบ LineID ไม่ถูกต้อง');
				break;
			}
			if (idStr.length > 20) {
				sendLine(event.source.groupId, 'LineID ยาวไปมั้ย');
				break;
			}

			var key = saveTx(event.message.id, event.source.userId + '', 'A', setNo, idStr, indexNo);
			var url = baseURL + '/view?key=' + key;
			//var ads = ' \n\nAds: สินค้าความงามเปิดตัวใหม่\nเปิดรับตัวแทนรุ่นแรกจำนวนจำกัด\nด่วน! เต็มแล้วปิดเลย\nสนใจรีบลงชื่อที่\nhttp://line.me/ti/p/%40ecy6740p';

			sendLine(event.source.groupId, 'ภาพเซต ' + setStr + ' ของ ' + idStr + ' ดาวน์โหลดได้ที่ ' + url);
			break;
		default:

			break;
	}
}

function sendLine(sendTo, message) {
	line.sendMsg(
		sendTo,
		line.createTextMsg(message)
	);
}

function defaultCallback(err, data) {
	if (err) console.log(err);
}

function saveTx(messageId, userId, suit, set, lineId, index) {
	var key = txRef.push().key;
	txRef.child(key).set({
		userId: userId,
		suit: suit,
		set: set,
		index: index,
		lineId: lineId
	});
	return key;
}

function getTx(key, cb) {
	try {
		txRef.orderByKey()
			.equalTo(key)
			.once("value", function (snapshot) {
				snapshot.forEach(function (snap) {
					cb(snap.val());
				});
			});
	} catch (e) {
		console.log(e);
		cb();
	}
}

function appendBody(key, index) {
	return '<img width="80%" src="gen?key=' + key + '&index=' + index + '" /><br/>\n';
}

function appendAds() {
	var header = '<hr><br><center>Ads<br><br>ปรากฏการณ์ Peachy Fever 🍑🍑 ปังระเบิดไปทั่วทุกหย่อมหญ้า<br>✨อยากรวย ✨อย่ารีรอ ของหายากนะคะ รีบจับจอง ชักช้าไม่มีของขาย ต้องรอล็อตถัดไปนะคะ ☺️<br>สนใจสั่งซื้อ/เปิดบิล';
	header += '<br>😍 FB : <a href="https://www.facebook.com/peachy.in.th">เซรั่มลูกพีชเกาหลี รายใหญ่ กทม</a> หรือ ทักแชทโดยกดลิงค์ <a href="https://m.me/peachy.in.th">m.me/peachy.in.th</a>';
	header += '<br>😍 Line : 0944455071 หรือ กดลิงค์ <a href="http://bit.ly/2n4mqVE">http://bit.ly/2n4mqVE</a>';
	header += '<br>🍑 รับประกันความปังโดยทีมฝ้ายสายดัน 🍑<br>';
	//return '<img width="50%" src="ads/ads1.jpg" /></center>\n';	
	var ads = '<a href="http://bit.ly/2n4mqVE">';
	ads += '<img width="22%" src="ads/01.jpg" />';
	ads += '<img width="22%" src="ads/02.jpg" />';
	ads += '<img width="22%" src="ads/03.jpg" />';
	ads += '<img width="22%" src="ads/04.jpg" /><br>';
	ads += '<img width="22%" src="ads/05.jpg" />';
	ads += '<img width="22%" src="ads/06.jpg" />';
	ads += '<img width="22%" src="ads/07.jpg" />';
	ads += '<img width="22%" src="ads/08.jpg" /></a>\n';
	var footer = '</center>\n';
	return header + ads + footer;
}

function getImageUrl(set, id, index) {
	return phpBaseURL + '/gen_xxdf.php?set=' + set + '&id=' + id + '&index=' + index
}

function saveImage(set) {
	currentSetImage.forEach((url, index) => {
		extractUrl(url, (newUrl) => {
			console.log('extractUrl', newUrl);

			request({
				method: 'GET',
				url: newUrl
			}).on('end', function () {
				var uploadUrl = phpBaseURL + '/upload_file.php';
				var req = request.post(uploadUrl, function optionalCallback(err, httpResponse, response) {
					if (err) {
						return console.error('upload failed:', err);
					}
					console.log(index, ':Upload successful!  Server responded with:', response);
				});
				var form = req.form();
				form.append('file', fs.createReadStream(set + '_' + (index + 1) + '.png'), {
					filename: (index + 1) + '.png',
					contentType: 'image/png'
				});
				form.append('set', set);
			}).pipe(fs.createWriteStream(set + '_' + (index + 1) + '.png'));

		});
	})

	// var data = line.getContent(messageId, () => {
}

function extractUrl(originalUrl, cb) {
	fetch(originalUrl, { method: 'GET' })
		.then(res => res.text())
		.then(body => {
			var start = body.indexOf('header-content-right') + 32;
			body = body.substring(start, start + 100);
			var end = body.indexOf('download');
			body = body.substring(0, end - 2).trim();
			cb(body);
		})
		.catch(error => {
			console.log(error)
		});
}

function saveConfig() {
	fs.writeFile("config.json", JSON.stringify(config), function (err) {
		if (err) {
			return console.log(err);
		}
		config = require('./config.json');
	});
}

var certOptions = {
	key: fs.readFileSync('../cert/privkey.pem'),
	cert: fs.readFileSync('../cert/fullchain.pem')
};

http.listen(3002);
https.createServer(certOptions, http).listen(3802);
