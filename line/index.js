'use strict';
var request = require('request');
// var CryptoJS = require("crypto-js");
var config = require('./config.json');
var fs = require('fs');
module.exports = {


	verifyRequest: function (req, res, next) {
		// Refer to https://developers.line.me/businessconnect/development-bot-server#signature_validation

		// console.log(JSON.stringify(req.headers));
		// console.log(JSON.stringify(req.body));
		// var channelSignature = req.get('X-LINE-ChannelSignature');
		// var sha256 = CryptoJS.HmacSHA256(JSON.stringify(req.body), config.channelSecret);
		// var base64encoded = CryptoJS.enc.Base64.stringify(sha256);
		// if (base64encoded === channelSignature) {
		// 	console.log('events1:' + JSON.stringify(req.body));
		// 	next();
		// } else {
		// 	console.log('events:2' + JSON.stringify(req.body));
		// 	res.status(470).end();
		// }
		next();
	},

	createTextMsg: function (msgText) {
		var msg = [{
			type: 'text',
			text: msgText
		}];
		return msg;
	},

	createImageMsg: function (imageUrl) {
		var msg = [{
			type: 'image',
			originalContentUrl: imageUrl,
			previewImageUrl: imageUrl
		}];
		return msg;
	},

	createButtonMsg: function (title, text, altText, buttons) {
		var btnList = [];
		for (var i = 0; i < buttons.length; i++) {
			btnList.push(
				{
					type: 'postback',
					label: buttons[i].label,
					data: buttons[i].data,
					text: buttons[i].text,
				}
			);
		}

		var msg = [{
			type: 'template',
			altText: altText,
			template: {
				type: 'buttons',
				title: title,
				text: text,
				actions: btnList
			}
		}];
		return msg;
	},


	replyMsg: function (replyToken, msg) {
		var data = {
			replyToken: replyToken,
			messages: msg
		};

		console.log('replyMsg:' + JSON.stringify(data));

		request({
			method: 'POST',
			url: config.channelUrl + '/v2/bot/message/reply',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': config.channelToken
			},
			json: data
		}, function (err, res, body) {
			if (err) {
				console.log('replyMsg error:' + JSON.stringify(err));
				//if(cb && typeof cb == "function") cb(err);
			} else {
				console.log('replyMsg ok:' + JSON.stringify(body));
				//if(cb && typeof cb == "function") cb();
			}
		});
	},

	sendMsg: function (to, msg, cb) {
		var data = {
			to: to,
			messages: msg
		};

		//console.log('sendMsg:' + JSON.stringify(data));

		request({
			method: 'POST',
			url: config.channelUrl + '/v2/bot/message/push',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': config.channelToken
			},
			json: data
		}, function (err, res, body) {
			if (err) {
				console.log('sendMsg error:' + JSON.stringify(err));
				if (cb) cb(err);
			} else {
				//console.log('sendMsg ok:' + JSON.stringify(body));
				if (cb) cb();
			}
		});
	},

	getContent: function (messageId, cb) {
		request({
			method: 'GET',
			url: config.channelUrl + '/v2/bot/message/' + messageId + '/content',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': config.channelToken
			}
		}).on('end', function () {
			cb();
		}).pipe(fs.createWriteStream('../tmp.png'));
		// , function(err, res, body) {
		// 	if (err) {
		// 		console.log('sendMsg error:' + JSON.stringify(err));
		// 		if (cb) cb(err);
		// 	} else {
		// 		//console.log('sendMsg ok:' + JSON.stringify(body));
		// 		if (cb) cb(body);
		// 	}
		// });
	},

}