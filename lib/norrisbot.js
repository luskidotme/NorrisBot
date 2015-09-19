'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');

var NorrisBot = function Constructor(settings){
    this.settings = settings;
    this.settings.name = this.settings.name || 'norrisbot';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'norrisbot.db');

    this.user = null;
    this.db = null;
};

util.inherits(NorrisBot, Bot);

NorrisBot.prototype.run = function(){
    NorrisBot.super_.call(this, this.settings);

    this.on('start', this._onStart);
    this.on('message', this._onMessage);
};

NorrisBot.prototype._onStart = function() {
    this._loadBotUser();
    this._connectDb();
    this._firstRunCheck();
};

NorrisBot.prototype._loadBotUser = function(){
    var self = this;
    this.user = this.users.filter(function(user){
        return user.name === self.name;
    });
};

NorrisBot.prototype._connectDb = function(){
    if(!fs.existsSync(this.dbPath)){
        console.error('Database path '+'"'+this.dbPath+'" does not exists or it\'s not readable');
        process.exit(1);
    }

    this.db = new SQLite.Database(this.dbPath);
};

NorrisBot.prototype._firstRunCheck = function(){
    var self = this;
    self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function(err, record){
        if(err){
            return console.error('DATABASE ERROR : '+err);
        }

        var currentTime = (new Date()).toJSON();

        //if it's the first run
        if(!record) {
            self._welcomeMessage();
            return self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
        }

        self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"',currentTime);
    });
};

NorrisBot.prototype._welcomeMessage = function(){
    console.log("Welcome message sent");
    this.postMessageToChannel(this.channels[0].name, 'Hi guys, roundhouse kicks anyone ?' +
    '\n I can tell jokes, but very honest ones. Just say `Chuck Norris` or '+this.name+' to invoke me');
};

NorrisBot.prototype._onMessage = function(message){
    console.log('Received message');
    if(this._isChatMessage(message) &&
        this._isChannelConversation(message) &&
        !this._isFromNorrisBot(message)&&
        this._isMentioningChuckNorris(message)
    ){
        this._replyWithRandomJoke(message);
    }
};

NorrisBot.prototype._isChatMessage = function(message){
    return message.type === 'message' && Boolean(message.text);
};

NorrisBot.prototype._isChannelConversation = function(message){
    console.log(message.channel[0]);
    return typeof message.channel === 'string' &&
            message.channel[0] === 'C';
};

NorrisBot.prototype._isFromNorrisBot = function(message){
    return message.user === this.user[0].id;
};

NorrisBot.prototype._isMentioningChuckNorris = function(message){
    return message.text.toLowerCase().indexOf('chuck norris') > -1 ||
        message.text.toLowerCase().indexOf(this.name) > -1;
};

NorrisBot.prototype._replyWithRandomJoke = function(originalMessage){
    var self = this;
    self.db.get('SELECT id, joke FROM jokes ORDER BY used ASC, RANDOM() LIMIT 1', function(err, record){
        if(err){
            return console.error('DATABASE ERROR : '+err);
        }

        var channel = self._getChannelById(originalMessage.channel);
        self.postMessageToChannel(channel.name, record.joke, {as_user: true});
        self.db.run('UPDATE jokes SET used = used + 1 WHERE id = ?', record.id);
    });
};

NorrisBot.prototype._getChannelById = function(channelId){
    return this.channels.filter(function(item){
        return item.id === channelId;
    })[0];
};

module.exports = NorrisBot;