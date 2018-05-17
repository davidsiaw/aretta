const Discord = require('discord.js');
const Icy = require('icy');
const client = new Discord.Client();
const WebSocket = require('ws');
const fs = require('fs');
const bodyParser = require('body-parser');
const ytdl = require('ytdl-core');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const { URL } = require('url');
const proto = {
  'http:': require('http'),
  'https:': require('https')
}
const fileType = require('file-type');
var jsmediatags = require("jsmediatags");

const AWS = require('aws-sdk');

const SECRET_TOKEN = process.env.SECRET_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

var blacklist = {};
var command_hash = {};

var playing = false;
var LOG_CHAN = null;
var vchandler = () => {};

const DEFAULT_VOICE = "Takumi";

var voices = {}

var playlist = []

function save_state(on_complete)
{
  var state = {
    voices: voices
  }
  fs.writeFile("config", JSON.stringify(state), function(err) {
      if (err) {
          return console.log(err);
      }
      console.log("Config saved!");
      if (on_complete)
      {
        on_complete();        
      }
  }); 
}

function load_state(on_playing)
{
  fs.readFile('config', function(err, data) {
    if (err) {
      return console.log(err);
    }
    try
    {
      var state = JSON.parse(data);
      voices = state.voices
      console.log("Config loaded!");
    }
    catch (e)
    {
      return console.log(e);
    }
  });
}

function send(channel)
{
  try
  {
    var message = "[" + new Date() + "]";
    for (var idx in arguments)
    {
      if (idx == 0) { continue; }
      message += " "
      message += arguments[idx]
    }
    channel.send(message);
  }
  catch (e)
  {
    console.log("[SEND]", e)
  }
}

function find_channel(client, chan_id, on_success, on_failure)
{
  var channels = [];

  client.guilds.map( (g) => {
    g.channels.
      filter( (c) => { return chan_id.indexOf(c.id) != -1; } ).
      map ( (c) => { channels.push(c) } );
  });

  if (channels.length == 1)
  {
    on_success(channels[0]);
  }
  else
  {
    on_failure(chan_id);
  }
}

function not_find_chan(chan_id)
{
  console.log("could not find channel", chan_id)
}

function play_next()
{
  if (!playing)
  {
    var x = playlist.shift();
    if (x)
    {
      console.log("Playing: ", x[1], ";", playlist.length, "sentences left.")
      x[0](x[1], x[2], x[3], x[4], x[5]);
    }
    else
    {
      console.log("No more sentences")
    }
  }
}

function setup_events(current_stream, c, connection, logging_channel)
{
  current_stream.on("start", function() {
    send(logging_channel, "[PLAY]", "started!");
  });

  current_stream.on("error", function(e) {
    send(logging_channel, "[PLAY]", "errored!");
    send(logging_channel, "[PLAY]", e);
    current_stream.end();
    playing = null;
    play_next();
  });

  current_stream.on("end", function(e) {
    send(logging_channel, "[PLAY]", "ended!");
    playing = null;
    play_next();
  });
}

function start_html_server(c, connection, logging_channel) {

  LOG_CHAN = logging_channel;

  load_state();

  var error = false;

  function register_user_command(command, func)
  {
    command_hash[command] = func;
  }

  const Polly = new AWS.Polly({
    region: 'ap-northeast-1'
  })


  function play_text(message, m, voiceid, on_success, on_failure)
  {
    playlist.push(
      [
        function(message, m, voiceid, on_success, on_failure)
        {

          message = message.replace(/\<@[0-9]+\>/g, function(x)
          {
            var userid = x.toString().replace("<@", "").replace(">","");
            var nick = m.channel.guild.members.get(userid).displayName;
            return nick;
          })

          message = message.replace(/\<#[0-9]+\>/g, function(x)
          {
            var chanid = x.toString().replace("<#", "").replace(">","");
            var channame = m.channel.guild.channels.get(chanid).name;
            return channame;
          })

          message = message.replace(/\<\:[^:]+\:[0-9]+\>/gi, function(x)
          {
            var emoid = x.toString().replace("<:", "").replace(/\:[0-9]+\>/,"");
            return emoid;
          })

          var params = {
            'Text': message,
            'OutputFormat': 'ogg_vorbis',
            'VoiceId': voiceid
          }

          Polly.synthesizeSpeech(params, (err, data) => {
            if (err)
            {
              console.log(err.code)
              if (on_failure)
              {
                on_failure();
              }
            }
            else if (data) 
            {
              if (data.AudioStream instanceof Buffer) {
                fs.writeFile("./speech.ogg", data.AudioStream, function(err) {
                  if (err) {
                    return console.log(err);
                  }

                  playing = true;
                  current_stream = connection.play("./speech.ogg");
                  setup_events(current_stream, c, connection, logging_channel);
                  if (on_success)
                  {
                    on_success();
                  }
                })

              }
            }
          });
        },
        message,
        m,
        voiceid,
        on_success,
        on_failure
      ]
    )
    play_next();
  }

  vchandler = (message, m) => {

    if ( !connection.channel.members.get(m.author.id) )
    {
      var reply = "You need to be in the voice channel to use this command!";
      return m.reply(reply);
    }

    play_text(message, m, voices[m.author.id] || DEFAULT_VOICE, ()=>{}, ()=>{});
  };

  register_user_command("setseiyuu", (message, m) => {

    play_text("this is what " + m.author.username + " sounds like now.", m, message,
      ()=> {
        voices[m.author.id] = message;
        save_state(()=>{
          var reply = "Set voice to " + message + "!";
          m.reply(reply);
        });
      },

      ()=>{
        var reply = "Not a valid seiyuu: " + message;
        m.reply(reply);
      });
  });

  register_user_command("seiyuus", (message, m) => {

    var reply = "Available voices are: Mizuki, Takumi, Amy, Brian, Joanna, Matthew, Kendra, Joey, Kimberly, Justin and Salli";
    m.reply(reply);
  });

}

client.on('ready', () => {

  find_channel(client, "331596661954576385", (logging_channel) => {
    send(logging_channel, "Started up")

    find_channel(client, process.env.CHANNEL_ID, (c)=> {
      c.join()
       .then((connection) => { 
        start_html_server(c, connection, logging_channel);
        //play_radio(); 
      })
       .catch(console.error);
    }, not_find_chan);

  }, not_find_chan);

});

function handle_admin_message(message, m)
{
  if (message === 'restart')
  {
    m.reply('Okie~ be right back!');
    client.destroy();
    save_state();
    setTimeout(() => {
      process.exit();
    }, 1000);
  }
}

function handle_user_message(message, m)
{
  if (LOG_CHAN)
  {
    send(LOG_CHAN, "[MSG]", "from: <@" + m.author.id + ">", message);
  }

  const command = message.split(" ").filter(Boolean)[0];
  if (command_hash[command])
  {
    command_hash[command](message.replace(command+" ", ""), m);
  }
}

function handle_vc_message(message, m)
{
  if (LOG_CHAN)
  {
    send(LOG_CHAN, "[MSG]", "from: <@" + m.author.id + ">", message);
  }

  if (vchandler)
  {
    vchandler(message.replace(/vc: ?/, ""), m);
  }
}

client.on('message', message => {

  //console.log("[MSG]", message.author, message.content);
  const id_front = '<@'+CLIENT_ID+'> ';
  if (message.content.indexOf(id_front) == 0)
  {
    if (message.author.id == "122908555178147840")
    {
      handle_admin_message(message.content.replace(id_front, ""), message);
    }

    if (blacklist[message.author.id] === undefined || blacklist[message.author.id] === false)
    {
      handle_user_message(message.content.replace(id_front, ""), message);
    }
  }

  if (message.content.indexOf("vc:") == 0)
  {
    if (blacklist[message.author.id] === undefined || blacklist[message.author.id] === false)
    {
      handle_vc_message(message.content.replace(id_front, ""), message);
    } 
  }
});


client.login(process.env.BOT_TOKEN);
