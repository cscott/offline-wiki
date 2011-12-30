
function binarySearch(value, low, high, win, threshold, parser, callback){
	coreSearch(Math.round(low + (high - low) / 2));
	function coreSearch(mid){
		index.readText(mid - win, win * 2, function(text){
		  if(text == false) return callback(false);
			try{
				var result = parser(text); //maybe ideally something closer to the exact center would be better.
			}catch(err){
			  console.log('had error parsing', text, "hello");
				return coreSearch(mid + win + 10000);
			}
			var offset = text.split("\n")[0].length + 1;
				
			if(high - low < threshold * 2){
				return callback(low, high, result, text);
			}
			//console.log(result, result < value ? '<' : '>', value);
			if(result < value){
			  low = mid - win;
			  coreSearch(Math.round(low + (high - low) / 2))
				//binarySearch(value, mid - win, high, win, threshold, parser, callback);
			}else{
			  high = mid + win;
			  coreSearch(Math.round(low + (high - low) / 2))
				//binarySearch(value, low, mid + win, win, threshold, parser, callback);
			}
		})
	}
}

var midpointCache = {};
function binarySearch2(value, callback){
  var low = 0, high = index.getChunks();
  var delta = 0;
  var old = Infinity;
  value = slugfy(value);
  var terminate = false;
  var start = new Date;
  function getMidvalue(mid, callback){
    if(mid in midpointCache) return callback(midpointCache[mid]);
    index.readChunkText(mid, function(e){
      if(e == false){
        delta++;
        return coreSearch()
      }
      var r = e.split('\n');
      var m = r[Math.floor(r.length / 2)].split(/\||>/);
      var result = slugfy(m[0]);
      midpointCache[mid] = result;
      callback(result);
    })
  }
  function coreSearch(){
    if(terminate) return;
    var diff = high - low;
    if(old - diff < 2){
      //console.log('search time', new Date - start);
      return callback(high, low);
    }
    old = diff;
    var mid = Math.round(low/2 + high/2) + (Math.pow(-1, delta) * Math.ceil(delta/2));
    if(mid <= low || mid >= high || high <= low) return callback(false); //total failure
    getMidvalue(mid, function(result){
      delta = 0;
      if(result < value){
        low = mid - 1;
      }else{
        high = mid + 1;
      }
      coreSearch();
    })
  }
  coreSearch();
  return function(){
    terminate = true;
  }
}

function binarySearch3_old(value, callback){
  value = slugfy(value);
  var low = 0, high = index.getChunks();
  var terminate = false;
  var start = +new Date;
  
  
  function core(){
    if(terminate) return;
    var center = low/2 + high/2;
    if(high - low < 1){
      console.log('search time', new Date - start);
      return callback(center);
    }
    var block = Math.floor(center);
    var rem = center % 1;
    index.readChunkText(block, function(e){
      var c = Math.round(rem * e.length);
      var n = 0, s;
      do {
        n++;
        s = e.slice(Math.max(0, c - n), c + n)
      } while(!/\n.*\n/.test(s));
      var r = slugfy(s.match(/\n(.*)\n/)[1].split(/\||>/)[0]);
      if(r < value){
        low = block + Math.max(0, c - n - 137)/e.length
      }else if(r > value){
        high = block + (c + n + 137)/e.length
      }
      core()
    })
  }
  core();
  return function(){terminate = true}
}


function binarySearch3(value, callback){
  value = slugfy(value);
  var low = 0, high = index.getChunks();
  var terminate = false;
  var lastdiff = Infinity;
  
  function middle(center, cb){
    var ms = center.toFixed(4);
    if(ms in midpointCache) return cb(midpointCache[ms]);
    var block = Math.floor(center);
    var rem = center % 1;
    index.readChunkText(block, function(e){
      var c = Math.round(rem * e.length);
      var n = 0, s;
      do {
        n++;
        s = e.slice(Math.max(0, c - n), c + n)
      } while(!/\n.*\n/.test(s));
      var r = slugfy(s.match(/\n(.*)\n/)[1].split(/\||>/)[0]);
      var nlow = block + Math.max(0, c - n - 137)/e.length;
      var nhigh = block + (c + n + 137)/e.length;
      cb(midpointCache[ms] = [r, nlow, nhigh])
    })
  }
  
  function core(){
    if(terminate) return;
    var center = low/2 + high/2;
    if(Math.abs(lastdiff - (high - low)) < 0.03){
      //console.log(value, center);
      return callback(center);
    }
    lastdiff = high - low;
    middle(center, function(x){
      //console.log(x[0]);
      if(x[0] < value) low = x[1];
      else if(x[0] > value) high = x[2];
      core();
    })
  }
  core();
  return function(){terminate = true}
}


function defaultParser(text){
	return text && slugfy(text.split("\n")[1].split(/\||\>/)[0])
}




var indexCache = {};


//stolen from quirksmode
function findPos(obj) {
	var curleft = curtop = 0;
	if (obj.offsetParent) {
	  do {
			  curleft += obj.offsetLeft;
			  curtop += obj.offsetTop;
	  } while (obj = obj.offsetParent);
	}
	return [curleft,curtop];
}

function reposition(){
  var sea = document.getElementById('search');
  var p = findPos(sea);
  document.getElementById('autocomplete').style.top = (p[1] + sea.offsetHeight - 1) + 'px';
  document.getElementById('autocomplete').style.left = p[0] + 'px';
  document.getElementById('autocomplete').style.width = (sea.offsetWidth - 2) + 'px';
}


function t(el, set){
  if('textContent' in document.body){
    if(typeof set != 'undefined'){
      el.textContent = set;
    }
    return el.textContent;
  }else{
    if(typeof set != 'undefined'){
      el.innerText = set;
    }
    return el.innerText;
  }
}

var lastSearchTime = 0;
var lastArticle = '';
var autocompleteWorker;
reposition();
autocomplete(document.getElementById('search'), document.getElementById('autocomplete'), function(query, callback){



	//if(downloading) return callback(["Downloading... Please Wait"]);
	//if(autocompleteWorker) autocompleteWorker();
	
	autocompleteWorker = runSearch(query, function(results){
	  
		var map = {};
		var filtered = results.map(function(x){
			return x.redirect ? x.pointer : x.title;
		}).filter(function(x){
		  if(x in map) return 0;
		  return map[x] = 1;
		}).slice(0,15).map(function(x){
			//this is probably one of my cleverest regexes ever
			//return x.replace(new RegExp('('+query.split('').join('|')+')','gi'), '|$1|').replace(/((\|.\|){2,})/g, '<b>$1</b>').replace(/\|/g,'')
			return x.replace(new RegExp('('+query.replace(/[^\w]/g, ' ').replace(/ +/g,'|')+')', 'gi'), '<b>$1</b>')
		});
		callback(filtered)
	}, true)
}, function(query){
  query = query || '';
	if(new Date - lastSearchTime > 3141){ //Pi! also 3sec is like google instant's magic number apparnetly too
		document.title = query;
    history.pushState({}, '', '?'+query.replace(/ |%20/g,'_'));
	}
	lastSearchTime = new Date;
	loadArticle(query);
});

var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', clookup = {};
for(var i = 0; i < chars.length; i++) clookup[chars[i]] = i;

function parse64(string){
	//base 64 (note its not the base64 you know and love) conversions
	if(!string) return NaN;
	var n = 0;
	for(var l = string.length, i = 0; i < l; i++) n = n * 64 + clookup[string[i]];
	return n;
}



function findBlock(query, callback){

	runSearch(query, function(results, pos){
		if(!results[0]){
		  callback(query, 0, 0);
		}else if(results[0].redirect){
		  if(results[0].pointer != query){
			  findBlock(results[0].pointer, callback)
			}else{
			  callback(query, 0, 0);
			}
		}else{
			callback(results[0].title, results[0].pointer, pos)
		}
	})
}

function runSearch(query, callback, fuzzy){
  var c = index.getChunksize();
	//binarySearch(slugfy(query), 0, indexsize(), 200, 800, defaultParser, function(low, high, res){
	return binarySearch3(query, function(midchunk){
	  var mid = midchunk * index.getChunksize();
	  //var high = h * c, low = l * c;
	  //binarySearch(slugfy(query), l * c, h * c, 200, 800, defaultParser, function(low, high, res){
	    //if(low === false) return callback(false);
	    var win = 800;
		  index.readText(mid - win, win * 2, function(text){
		    if(text == false) return callback(false);
			  //console.log(text);
		    var results = text.split('\n').slice(1, -1)
			  .filter(function(x){
			    var parts = x.split(/\||\>/), title = parts[0], ptr = parts[1];
			    return title && (fuzzy || (title.toLowerCase().trim().replace(/[^a-z0-9]/g,'') == query.toLowerCase().trim().replace(/[^a-z0-9]/g,'')))
			  });
			  if(fuzzy != 2){
			    results = results.map(function(x){
				    var parts = x.split(/\||\>/), title = parts[0].replace(/_/g, ' '), ptr = parts[1];
				    return {title: title, pointer: /\>/.test(x) ? ptr : parse64(ptr), redirect: /\>/.test(x), score: scoreResult(title, query)}
			    }).sort(function(a, b){
				    return a.score - b.score
			    })
			  }
			  callback(results, mid);
		  })
		//})
	})
}

//another version by me: http://snippets.dzone.com/posts/show/6942
//based on: http://en.wikibooks.org/wiki/Algorithm_implementation/Strings/Levenshtein_distance
//and:  http://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
function damlev( str1, str2 ){
  if(!str1)str1="";
  if(!str2)str2="";

	var i, j, cost, d = [];
  str1 = str1.split("");
  str2 = str2.split("");
	
	if (str1.length == 0) return str2.length;
	if (str2.length == 0) return str1.length;
	
	for (i = 0; i <= str1.length; i++){
		d[ i ] = new Array();
		d[ i ][ 0 ] = i;
	}
 
	for (j = 0; j <= str2.length; j++) d[ 0 ][ j ] = j;
 
	for ( i = 1; i <= str1.length; i++ ){
		for ( j = 1; j <= str2.length; j++ ){
			cost = str1[i - 1] != str2[j - 1]; //false == 0, true == 1

			d[ i ][ j ] = Math.min(
                            d[ i - 1 ][ j ] + 1,
                            d[ i ][ j - 1 ] + 1,
                            d[ i - 1 ][ j - 1 ] + cost
                            );
			if(i > 1 && j > 1 && str1[i-1] == str2[j-2] && str1[i-2] == str2[j-1]){
        d[i][j] = Math.min(
                          d[i][j],
                          d[i-2][j-2] + cost   // transposition
                          )
       }
		}
	}
	
	return d[str1.length][str2.length];
}

codepoint2name={"34":"quot","38":"amp","60":"lt","62":"gt","160":"nbsp","161":"iexcl","162":"cent","163":"pound","164":"curren","165":"yen","166":"brvbar","167":"sect","168":"uml","169":"copy","170":"ordf","171":"laquo","172":"not","173":"shy","174":"reg","175":"macr","176":"deg","177":"plusmn","178":"sup2","179":"sup3","180":"acute","181":"micro","182":"para","183":"middot","184":"cedil","185":"sup1","186":"ordm","187":"raquo","188":"frac14","189":"frac12","190":"frac34","191":"iquest","192":"Agrave",
"193":"Aacute","194":"Acirc","195":"Atilde","196":"Auml","197":"Aring","198":"AElig","199":"Ccedil","200":"Egrave","201":"Eacute","202":"Ecirc","203":"Euml","204":"Igrave","205":"Iacute","206":"Icirc","207":"Iuml","208":"ETH","209":"Ntilde","210":"Ograve","211":"Oacute","212":"Ocirc","213":"Otilde","214":"Ouml","215":"times","216":"Oslash","217":"Ugrave","218":"Uacute","219":"Ucirc","220":"Uuml","221":"Yacute","222":"THORN","223":"szlig","224":"agrave","225":"aacute","226":"acirc","227":"atilde",
"228":"auml","229":"aring","230":"aelig","231":"ccedil","232":"egrave","233":"eacute","234":"ecirc","235":"euml","236":"igrave","237":"iacute","238":"icirc","239":"iuml","240":"eth","241":"ntilde","242":"ograve","243":"oacute","244":"ocirc","245":"otilde","246":"ouml","247":"divide","248":"oslash","249":"ugrave","250":"uacute","251":"ucirc","252":"uuml","253":"yacute","254":"thorn","255":"yuml","338":"OElig","339":"oelig","352":"Scaron","353":"scaron","376":"Yuml","402":"fnof","710":"circ","732":"tilde",
"913":"Alpha","914":"Beta","915":"Gamma","916":"Delta","917":"Epsilon","918":"Zeta","919":"Eta","920":"Theta","921":"Iota","922":"Kappa","923":"Lambda","924":"Mu","925":"Nu","926":"Xi","927":"Omicron","928":"Pi","929":"Rho","931":"Sigma","932":"Tau","933":"Upsilon","934":"Phi","935":"Chi","936":"Psi","937":"Omega","945":"alpha","946":"beta","947":"gamma","948":"delta","949":"epsilon","950":"zeta","951":"eta","952":"theta","953":"iota","954":"kappa","955":"lambda","956":"mu","957":"nu","958":"xi",
"959":"omicron","960":"pi","961":"rho","962":"sigmaf","963":"sigma","964":"tau","965":"upsilon","966":"phi","967":"chi","968":"psi","969":"omega","977":"thetasym","978":"upsih","982":"piv","8194":"ensp","8195":"emsp","8201":"thinsp","8204":"zwnj","8205":"zwj","8206":"lrm","8207":"rlm","8211":"ndash","8212":"mdash","8216":"lsquo","8217":"rsquo","8218":"sbquo","8220":"ldquo","8221":"rdquo","8222":"bdquo","8224":"dagger","8225":"Dagger","8226":"bull","8230":"hellip","8240":"permil","8242":"prime","8243":"Prime",
"8249":"lsaquo","8250":"rsaquo","8254":"oline","8260":"frasl","8364":"euro","8465":"image","8472":"weierp","8476":"real","8482":"trade","8501":"alefsym","8592":"larr","8593":"uarr","8594":"rarr","8595":"darr","8596":"harr","8629":"crarr","8656":"lArr","8657":"uArr","8658":"rArr","8659":"dArr","8660":"hArr","8704":"forall","8706":"part","8707":"exist","8709":"empty","8711":"nabla","8712":"isin","8713":"notin","8715":"ni","8719":"prod","8721":"sum","8722":"minus","8727":"lowast","8730":"radic","8733":"prop",
"8734":"infin","8736":"ang","8743":"and","8744":"or","8745":"cap","8746":"cup","8747":"int","8756":"there4","8764":"sim","8773":"cong","8776":"asymp","8800":"ne","8801":"equiv","8804":"le","8805":"ge","8834":"sub","8835":"sup","8836":"nsub","8838":"sube","8839":"supe","8853":"oplus","8855":"otimes","8869":"perp","8901":"sdot","8968":"lceil","8969":"rceil","8970":"lfloor","8971":"rfloor","9001":"lang","9002":"rang","9674":"loz","9824":"spades","9827":"clubs","9829":"hearts","9830":"diams"};

function utfdec(input) {
  for(var n = 0, output = ''; n < input.length; n++){
    var c = input.charCodeAt(n);
    if(c < 128){ output += input[n]; }else if(c > 127) {
      if(c < 2048){
        output += String.fromCharCode(c >> 6 | 192);
      }else{
        output += String.fromCharCode(c >> 12 | 224) + String.fromCharCode(c >> 6 & 63 | 128);
      }
        output += String.fromCharCode(c & 63 | 128);
    }
  }
  return output;
}

function slugfy(text){
  if(!text) return '';
  var ret = "";
  text = text.toLowerCase();
  //text = utfdec(text);
  //console.log(text);
  for(var l = text.length, i = 0; i < l; i++){
    var num = text.charCodeAt(i);
    if(codepoint2name[num]){
      ret += codepoint2name[num]
    }else{
      ret += text.charAt(i);
    }
  }
  return ret
        .replace(/([a-zA-Z])(uml|acute|grave|circ|tilde|cedil)/g, '$1')
        .replace(/[^a-zA-Z0-9_]/g, ' ')
        .replace(/ +/g, '')
        .trim()
}
function scoreResult(result, query){
  /*
    penalize explicit results to restore some semblance of faith in humanity
  */
  var censor = /porn|shit|piss|fuck|cunt|tits|sex|anal|cunnilingus|hentai|penis|vagina|ejaculation|breast/i.test(result) ? Math.E : 0;
  var score = damlev(result.substr(0, query.length), query) * 0.5 + damlev(result.substr(0, query.length).toLowerCase(), query.toLowerCase()) * 2 + Math.abs(query.length - result.length) * 0.1;
  //console.log(result, query, score, censor);
  return score + censor;
}

