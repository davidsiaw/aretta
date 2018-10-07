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
const Kuroshiro = require("kuroshiro");
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");

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

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

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
  var chan = client.channels.get(chan_id);

  console.log("attempt to join", chan_id)

  if (chan)
  {
    on_success(chan);
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

async function start_html_server(c, connection, logging_channel) {

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

  const heerargunner = {

      "きょう":"kyoh",
      "ぎょう":"gyoh",
      "ひょう":"he oh",
      "びょう":"be oh",
      "ぴょう":"pee oh",
      "みょう":"me oh",
      "にょう":"neo",
      "りょう":"leo",

      "ああ":"aah",
      "あい":"eye",
      "あう":"ow",
      "いあ":"ya",
      "いい":"yee",
      "いう":"you",
      "いえ":"yeh",
      "いお":"yo",
      "うあ":"wah",
      "うえ":"way",
      "うい":"we",
      "うう":"woo",
      "うお":"wow",
      "おあ":"oar",
      "おう":"oh",
      "おお":"oh",

      "かあ":"car",
      "かい":"khai",
      "かう":"cow",

      "こう":"co",

      "さあ":"saar",
      "さい":"sigh",
      "せい":"say",

      "しん":"shin",
      "シン":"shin",
      "じん":"jean",
      "ジン":"jean",

      "たあ":"tar",
      "たい":"thigh",
      "たう":"tau",
      "たお":"tao",

      "です":"days",

      "はあ":"haa",
      "はい":"high",
      "はう":"how",
      "はお":"how",

      "ばあ":"baa",
      "ばい":"bye",
      "ばう":"bow",
      "ばお":"bow",

      "ぱあ":"par",
      "ぱい":"pie",
      "ぱう":"pow",
      "ぱお":"pow",


      "きゃ":"kyuh",
      "きゅ":"kewl",
      "きょ":"kyoh",
      "ぎゃ":"gyuh",
      "ぎゅ":"giew",
      "ぎょ":"gyoh",
      "ちゃ":"chuh",
      "ちゅ":"chew",
      "ちょ":"chou",
      "しゃ":"shuh",
      "しゅ":"shew",
      "しょ":"show",
      "じゃ":"jar",
      "じゅ":"jew",
      "じょ":"joe",
      "みゃ":"me uh",
      "みゅ":"me you",
      "みょ":"me yo",
      "にゃ":"knee uh",
      "にゅ":"knew",
      "にょ":"knee yo",
      "ひゃ":"he arh",
      "ひゅ":"he you",
      "ひょ":"he your",
      "びゃ":"be arh",
      "びゅ":"bew",
      "びょ":"be oh",
      "ぴゃ":"peer",
      "ぴゅ":"pew",
      "ぴょ":"pee oh",
      "りゃ":"leah",
      "りゅ":"lew",
      "りょ":"lee yo",

      "キャ":"kyuh",
      "キュ":"kewl",
      "キョ":"kyoh",
      "ギャ":"gyuh",
      "ギュ":"giew",
      "ギョ":"gyoh",
      "チャ":"chuh",
      "チュ":"chew",
      "チョ":"chou",
      "シャ":"shuh",
      "シュ":"shew",
      "ショ":"show",
      "ジャ":"jar",
      "ジュ":"jew",
      "ジョ":"joe",
      "ミャ":"me uh",
      "ミュ":"me you",
      "ミョ":"me yo",
      "ニャ":"knee uh",
      "ニュ":"knew",
      "ニョ":"knee yo",
      "ヒャ":"he arh",
      "ヒュ":"he you",
      "ヒョ":"he your",
      "ビャ":"be arh",
      "ビュ":"bew",
      "ビョ":"be oh",
      "ピャ":"peer",
      "ピュ":"pew",
      "ピョ":"pee oh",
      "リャ":"leah",
      "リュ":"lew",
      "リョ":"lee yo",

      "てぃ":"tee",
      "でぃ":"dee",
      "とぅ":"too",
      "とゅ":"too",
      "すぃ":"see",
      "ティ":"tee",
      "ディ":"tee",
      "トゥ":"too",
      "トュ":"too",
      "スィ":"see",
      "ふぁ":"far",
      "ふぃ":"fee",
      "ふぉ":"for",
      "ファ":"far",
      "フィ":"fee",
      "フォ":"for",
      "ヴ":"view",
      "ヴぃ":"vee",
      "ヴァ":"var",
      "ヴォ":"vough",

      "じぇ":"jay",
      "ちぇ":"chay",
      "ジェ":"jay",
      "チェ":"chay",

      "あ":"uh",
      "い":"yi",
      "う":"oo",
      "え":"eh",
      "お":"oh",
      "か":"car",
      "き":"key",
      "く":"coo",
      "け":"kay",
      "こ":"ko",
      "が":"gah",
      "ぎ":"ghee",
      "ぐ":"goo",
      "げ":"gay",
      "ご":"go",
      "さ":"sar",
      "し":"she",
      "す":"soo",
      "せ":"say",
      "そ":"so",
      "ざ":"zar",
      "じ":"gee",
      "ず":"zoo",
      "ぜ":"zey",
      "ぞ":"zoe",
      "た":"tar",
      "ち":"chee",
      "つ":"tsu",
      "て":"tay",
      "と":"toe",
      "だ":"duh",
      "ぢ":"gee",
      "づ":"zoo",
      "で":"day",
      "ど":"dough",
      "な":"nar",
      "に":"knee",
      "ぬ":"new",
      "ね":"nay",
      "の":"no",
      "は":"ha",
      "ひ":"he",
      "ふ":"foo",
      "へ":"hey",
      "ほ":"ho",
      "ば":"bar",
      "び":"bee",
      "ぶ":"boo",
      "べ":"bay",
      "ぼ":"boar",
      "ぱ":"par",
      "ぴ":"pee",
      "ぷ":"poo",
      "ぺ":"pay",
      "ぽ":"poah",
      "ま":"ma",
      "み":"me",
      "む":"moo",
      "め":"may",
      "も":"mow",
      "や":"yar",
      "ゆ":"you",
      "よ":"yo",
      "ら":"la",
      "り":"lee",
      "る":"lew",
      "れ":"lay",
      "ろ":"low",
      "わ":"wha",
      "を":"woh",
      "ん":"n",
      "ア":"uh",
      "イ":"yi",
      "ウ":"oo",
      "エ":"eh",
      "オ":"oh",
      "カ":"car",
      "キ":"key",
      "ク":"coo",
      "ケ":"kay",
      "コ":"ko",
      "ガ":"gah",
      "ギ":"ghee",
      "グ":"goo",
      "ゲ":"gay",
      "ゴ":"go",
      "サ":"sar",
      "シ":"she",
      "ス":"soo",
      "セ":"say",
      "ソ":"so",
      "ザ":"zar",
      "ジ":"gee",
      "ズ":"zoo",
      "ゼ":"zey",
      "ゾ":"zoe",
      "タ":"tar",
      "チ":"chee",
      "ツ":"tsu",
      "テ":"tay",
      "ト":"toe",
      "ダ":"duh",
      "ヂ":"gee",
      "ヅ":"zoo",
      "デ":"day",
      "ド":"dough",
      "ナ":"nar",
      "ニ":"knee",
      "ヌ":"new",
      "ネ":"nay",
      "ノ":"no",
      "ハ":"ha",
      "ヒ":"he",
      "フ":"foo",
      "ヘ":"hey",
      "ホ":"ho",
      "バ":"bar",
      "ビ":"bee",
      "ブ":"boo",
      "ベ":"bay",
      "ボ":"boar",
      "パ":"par",
      "ピ":"pee",
      "プ":"poo",
      "ペ":"pay",
      "ポ":"poah",
      "マ":"ma",
      "ミ":"me",
      "ム":"moo",
      "メ":"may",
      "モ":"mow",
      "ヤ":"yar",
      "ユ":"you",
      "ヨ":"yo",
      "ラ":"la",
      "リ":"lee",
      "ル":"lew",
      "レ":"lay",
      "ロ":"low",
      "ワ":"wha",
      "ヲ":"woh",
      "ン":"n",
  }

  async function play_text(message, m, voiceid, on_success, on_failure)
  {
    playlist.push(
      [
        async function(message, m, voiceid, on_success, on_failure)
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

          message = message.replace(/\<\a\:[^:]+\:[0-9]+\>/gi, function(x)
          {
            return "a fucking animated emoji";
          })

          message = message.replace(/\<\:[^:]+\:[0-9]+\>/gi, function(x)
          {
            var emoid = x.toString().replace("<:", "").replace(/\:[0-9]+\>/,"");
            return emoid;
          })

          message = message.replace(/onibe/gi, function(x)
          {
            return "on ebay";
          })

          if (voiceid !== "Takumi" && voiceid !== "Mizuki")
          {
            const ks = new Kuroshiro();
            await ks.init(new KuromojiAnalyzer());
            const result = await ks.convert(message, { to: "hiragana" });
            console.log(result);
            var newmessage = result
            for (var len = 2; len >= 0; len--)
            {
              var nm = ""
              var i=0;
              for (i = 0; i < newmessage.length - len; i++)
              {
                var tx = newmessage.substr(i, len+1);
                console.log(tx, i, len+1, newmessage.length)
                if (heerargunner[tx])
                {
                  if (heerargunner[tx] !== 'n')
                  {
                    nm += " " + heerargunner[tx] 
                  }
                  else
                  {
                    nm += 'n'
                  }
                  i += len
                }
                else
                {
                  nm += newmessage[i]
                }
              }
              nm += newmessage.substr(i);
              newmessage = nm;
              console.log(newmessage);
            }

            message = newmessage;
          }

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

function join_chan(logging_channel)
{
  find_channel(client, process.env.CHANNEL_ID, (c)=> {
      c.join()
       .then((connection) => { 
        start_html_server(c, connection, logging_channel);
        //play_radio(); 
      })
       .catch(console.error);
    }, function(){ setTimeout( function(){join_chan(logging_channel);}, 10); } );
}

client.on('ready', () => {

  find_channel(client, "331596661954576385", (logging_channel) => {
    send(logging_channel, "Started up")

    join_chan(logging_channel);

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

function handle_tl_message(message, m)
{
  if (LOG_CHAN)
  {
    send(LOG_CHAN, "[MSG]", "from: <@" + m.author.id + ">", message);
  }

  if (vchandler)
  {

    var text = message.replace(/tl: ?/, "");

    var translate = new AWS.Translate({region: "us-east-1"});
    var params = {
      SourceLanguageCode: 'en', /* required */
      TargetLanguageCode: 'ja', /* required */
      Text: text /* required */
    }
    translate.translateText(params, function (err, data) {
      if (err)
      {
        console.log(err, err.stack); // an error occurred
      }
      else
      {
        var reply = "TL: " + text + " → " + data.TranslatedText;
        m.reply(reply);
        vchandler(data.TranslatedText, m);
      }
    });

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

  if (message.content.indexOf("tl:") == 0)
  {
    if (blacklist[message.author.id] === undefined || blacklist[message.author.id] === false)
    {
      handle_tl_message(message.content.replace(id_front, ""), message);
    }
  }
});


client.login(process.env.BOT_TOKEN);
