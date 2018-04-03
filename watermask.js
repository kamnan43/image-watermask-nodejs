var config   = require('./config.json');
var Jimp = require("jimp");
const Storage = require('@google-cloud/storage');
const storage = Storage({
  projectId: 'sitthi-water-mask',
  keyFilename: 'sitthi-water-mask-2ed96681dbdd.json'
});
const bucket = storage.bucket('sitthi-water-mask-bucket');
var zipdir = require('zip-dir');

function getOutputFolderName (suit, set, caption) {
    return caption + '_' + suit + '_' + set;
}

function getOriginalFilePath(suit, set, caption, index) {
    return suit + '/' + set + '/' + index + '.png';
}

function getOutputFilePath(suit, set, caption, index) {
    return caption + '_' + suit + '_' + set + '/' + index + '.png';
}

function getPublicURL (filename) {
    return 'https://storage.googleapis.com/sitthi-water-mask-bucket/' + filename;
}

function getViewURL (suit, set, id) {
    return 'https://sitthi-water-mask.herokuapp.com/view?suit=' + suit + '&set=' + set + '&id=' + id;
}

function generateImage (suit, set, caption, index, cb) {
    var loadedImage;
    var textImage;
    var filepath = getOriginalFilePath(suit, set, caption, index);
    console.log('START ' + index);
    Jimp.read(filepath)
        .then(function (image) {
            loadedImage = image;
            return Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);
        })
        .then(function (font) {
            var filename = getOutputFilePath(suit, set, caption, index);
            var text = 'Line ID : ' + caption;
            textImage = new Jimp(75 * text.length , 140, function (err, image) {
                image.print(font, 0, 0, text);
                image.rotate(45);
                image.opacity(0.2);
            });
            
            var x = (loadedImage.bitmap.width-textImage.bitmap.width)/2;
            var y = (loadedImage.bitmap.height-textImage.bitmap.height)/2;
            loadedImage.composite( textImage, x, y );
            console.log('PROCESSED ' + index);

            loadedImage.getBuffer( Jimp.MIME_PNG, function(err,buffer){
                uploadToGCS(filename, buffer);
                console.log('UPLOADED ' + index);
            } );

            if (index < config.setA[set-1].qty)
                generateImage (suit, set, caption, index+1, cb);
            else
                cb();

        })
        .catch(function (err) {
            console.error(err);
        });
}

function uploadToGCS (filename, buffer) {
    const file = bucket.file(filename);
    const stream = file.createWriteStream({
        metadata: {
            contentType: 'image/png'
        }
    });

    stream.on('error', (err) => {
        console.error(err);
    });

    stream.on('finish', () => {
        file.makePublic().then(() => {

        });
    });

    stream.end(buffer);
}

module.exports = {
    genWaterMask : function(suit, set, caption, rootcb) {
        generateImage (suit, set, caption, 1, function() {
            rootcb(getViewURL(suit, set, caption));
        });
    },
    genView : function(suit, set, caption) {
        var header = '<html><body>';
        var body = '';
        for(var i = 1; i <= config.setA[set-1].qty; i++) {
            body = body + '<img width=\"100%\" src=\'' + getPublicURL(getOutputFilePath(suit, set, caption,i)) + '\' /><br/>'
            
        }
        var footer = '</body></html>';
        return header + body + footer;
    }
}