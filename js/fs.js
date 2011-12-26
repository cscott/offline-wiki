var indexsize, dumpsize, indexurl, dumpurl, dumpname;

var index, dump;
var accessibleIndex = 0;
var accessibleTitle = ''; //almost last accessible title
var fs;

var dumps = {
  leet: {
    indexsize: 27509,
    dumpsize: 13688465,
    indexurl: 'http://offline-wiki.googlecode.com/files/1337.new.index',
    dumpurl: 'http://offline-wiki.googlecode.com/files/1337.lzma',
  },
  local_leet: {
    indexsize: 27509,
    dumpsize: 13688465,
    indexurl: '/Downloads/split2/old/1337.new.index',
    dumpurl: '/Downloads/split2/old/1337.lzma',
  },
  local_pi: {
    indexsize: 7924566,
    dumpsize: 1025405491,
    indexurl: '/Downloads/split2/pi.index',
    dumpurl: function(ptr){
      var CHUNK_SIZE = 100000000;
      return ['/Downloads/split2/splitpi/pi_' +
      'aa,ab,ac,ad,ae,af,ag,ah,ai,aj,ak'.split(',')[Math.floor(ptr / CHUNK_SIZE)],
        ptr % CHUNK_SIZE];
    }
  },
  pi: {
    indexsize: 7924566,
    dumpsize: 1025405491,
    indexurl: 'http://offline-wiki.googlecode.com/files/pi.index',
    dumpurl: function(ptr){
      var CHUNK_SIZE = 100000000;
      return ['http://offline-wiki.googlecode.com/files/pi_' +
      'aa,ab,ac,ad,ae,af,ag,ah,ai,aj,ak'.split(',')[Math.floor(ptr / CHUNK_SIZE)],
        ptr % CHUNK_SIZE];
    }
  }

}

var defaultsize = 1024*1024*1024*5+100;

function switch_dump(name, dft){
  if(!dumps[name] && dft){name = dft}
  if((location.host=='localhost' || /\.local/.test(location.host)) && !/local_/.test(name)) name = 'local_'+name;
  document.getElementById('dump').value = name.replace('local_','');
  var d = dumps[name];
  dumpname = name;
  localStorage.dumpname = name;
  indexsize = d.indexsize;
  dumpsize = d.dumpsize;
  indexurl = d.indexurl;
  dumpurl = d.dumpurl;
  dump = null;
  index = null;
  accessibleIndex = 0;
  accessibleTitle = '';
  check_download();
  initialize();
}

//if(location.host=='offline-wiki.googlecode.com'){
//  switch_dump(localStorage.dumpname, 'leet');
//}else{
  switch_dump(localStorage.dumpname, 'leet');
//}


var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', clookup = {};
for(var i = 0; i < chars.length; i++) clookup[chars[i]] = i;

function parse64(string){
	//base 64 (note its not the base64 you know and love) conversions
	if(!string) return NaN;
	var n = 0;
	for(var l = string.length, i = 0; i < l; i++) n = n * 64 + clookup[string[i]];
	return n;
}

var blobType;

//ideally this will future-proof the implementation.
//for when .slice means something different
function testSliceType(){
	var bb = createBlobBuilder();
	bb.append("elitistland");
	var number = bb.getBlob().slice(3,5).size;
	if(number == 5){
		blobType = 1
	}else if(number == 2){
		blobType = 2;
	}else{
		alert("Apparently the future, assuming you are in the future, is really messed up by mid-2011 standards.");
	}
}


function blobSlice(blob, start, length){
	if(blob.webkitSlice){
		return blob.webkitSlice(start, start + length);
	}else if(blob.slice){
		if(!blobType) testSliceType();
		if(blobType == 1){
			return blob.slice(start, length);
		}else if(blobType == 2){
			return blob.slice(start, start + length);
		}
	}
}

function createBlobBuilder(){
	if(window.BlobBuilder){
		return new BlobBuilder()
	}else if(window.WebKitBlobBuilder){
		return new WebKitBlobBuilder();
	}
}
function loadFiles(){
  loadIndex(function(){
		console.log('loaded index');
		loadDump(function(){
			console.log('loaded dump');
			updateAccessibleIndex();
			setTimeout(function(){
			  if(can_download){
			    downloadIndex();
			    downloadDump();
			  }else{
			    console.log("not downloading dump");
			  }
			}, 1000);
		});
	});
}
function initialize(){
	console.log('initializing');
	var rfs = (window.requestFileSystem||window.webkitRequestFileSystem);
	if(rfs){
	  rfs(window.PERSISTENT, defaultsize, function(filesystem){
		  fs = filesystem;
		  loadFiles()
	  }, errorHandler);
	}else{
	  console.log("Online Fallback");
	  accessibleIndex = indexsize;
	  console.log(accessibleIndex);
	  
	}
	if(window.webkitStorageInfo){
  	webkitStorageInfo.requestQuota(
      webkitStorageInfo.PERSISTENT, 
      defaultsize,
      function(grantedQuota){
        console.log("Granted quota:", grantedQuota)
      }, 
      function(e){
        console.log("Quota Request error:", e)
      }); 
  }
}
var can_download = true;
var concurrencyKey = +new Date;
function check_download(){
  can_download = true;
  localStorage.checkConcurrency = concurrencyKey;
}
check_download();
onstorage = function(e){
  if(e.key == "checkConcurrency"){
    if(can_download){
      if(+e.newValue < +concurrencyKey){
        can_download = false;
      }else{
        localStorage.checkConcurrency = concurrencyKey;
      }
    }
  }
}

var last_download_update = 0;
function updateAccessibleIndex(){
	//console.log('getting accessible index');
	downloadStatus(function(index, title){
		console.log('accessible index: ', index);
		accessibleIndex = index;
		accessibleTitle = title;
		if(new Date - last_download_update > 1000){
  		document.getElementById('status').innerHTML = '<b>Downloading</b> <a href="?'+accessibleTitle+'">'+accessibleTitle+'</a>';
			last_download_update = +new Date;
		}
	});
}

function loadIndex(callback){
	fs.root.getFile(dumpname+'.index', {create:true, exclusive: false}, function(e){
		e.file(function(file){
			index = file;
			if(callback) callback();
		})
	}, errorHandler);
}

function loadDump(callback){
	fs.root.getFile(dumpname+'.lzma', {create:true, exclusive: false}, function(e){
		e.file(function(file){
			dump = file;
			if(callback) callback();
		})
	}, errorHandler);
}

function updateDownloadStatus(){
	if(!dump) return;
	document.getElementById('progress').value = dump.size / dumpsize;
	document.getElementById('download').title = (100 * dump.size / dumpsize).toFixed(5)+"%";
}



function downloadStatus(callback){
  return callback(index.size, 'n/a', dump.size);
  
	if(!index || !dump) return false;
	if(dump.size < 1000 || index.size < 1000) return callback(0, 'n/a');
	if(dump.size == dumpsize && index.size == indexsize) return callback(index.size, 'n/a', dump.size);
	//get the current size of the accessible index.
	var targetsize = dump.size;
	binarySearch(targetsize - 1024 * 768, Math.max(0, accessibleIndex - 1024 * 768), index.size, 500, 1000, function(text){
		return parse64(text.match(/\n.+?\|([\w/_\-]+)/)[1])
	}, function(low, high, result, text){	 //using the text arg is bad! but we're using this to save a bit of time
		//console.log(low, high, result);
		//console.log(text.split('\n')[1], result, targetsize)
		if(text){
		  var z = text.match(/\n(.+)\|.+\n/);
		  callback(Math.floor(low/2 + high/2) + 1024 * 512, z[1])
	  }
		//callback(low + 1024 * 512, text && text.split('\n')[1].split(/\||\>/)[0]);
		/*
	  readIndex(low, high - low, function(raw){
			var text = raw;
			var lines = text.split("\n").slice(1);
			var lastnum = -1;
			var bytecount = text.split("\n")[0].length;
			for(var i = 0; i < lines.length; i++){
				var num = parse64(lines[i].split("|")[1]);
				if(!isNaN(num) && (lastnum == -1 || Math.abs(lastnum - num) < 1024 * 1024)){
					if(num > dump.size) break;
					lastnum = num;
				}
				bytecount += lines[i].length + 1; //account for the newline
			}
			var title = text && text.split('\n')[1].split(/\||\>/)[0];
			callback(low + bytecount, title);
		})*/
	})
}


function readIndex(start, length, callback){
  var hash = 'i'+start+'-'+length;
	if(indexCache[hash]) return callback(indexCache[hash]);
	start = Math.max(0, start);
	
  if(fs){
	  if(!index) return callback('');
	  var fr = new FileReader();
	  fr.onload = function(){
		  indexCache[hash] = fr.result;
		  callback(fr.result);
	  }
	
	  fr.readAsText(blobSlice(index, start, Math.min(index.size - start, length)), 'utf-8');
	}else{
  	var xhr = new XMLHttpRequest(); //resuse object
  	var du = typeof indexurl == 'function' ? indexurl(start) : [indexurl, start];
	  xhr.open('GET', du[0] + "?"+Math.random(), true);
	  xhr.setRequestHeader('Range', 'bytes='+du[1]+'-'+Math.min(indexsize, du[1]+length));
	  xhr.onload = function(){
	    indexCache[hash] = xhr.responseText;
	    callback(xhr.responseText);
	  }
	  xhr.send(null);
	}
}



function readDump(position, callback, blocksize){
  //console.log("reading dump", position);
	blocksize = blocksize || 200000;
  if(fs){
    //console.log("failing else");
	  var fr = new FileReader();
	  fr.onload = function(){
	    var buf = fr.result;
		  decompressPage(buf, callback);
	  }
	  //fr.readAsBinaryString(blobSlice(dump, position, blocksize || 200000));
	  fr.readAsArrayBuffer(blobSlice(dump, position, blocksize));
	}else{
	  //console.log("creating XHR")
  	var xhr = new XMLHttpRequest(); //resuse object
  	var du = typeof dumpurl == 'function' ? dumpurl(position) : [dumpurl, position];
	  xhr.open('GET', du[0] + "?"+Math.random(), true);
	  xhr.setRequestHeader('Range', 'bytes='+du[1]+'-'+(du[1]+blocksize));
  	xhr.responseType = 'arraybuffer';
	  xhr.onload = function(){
	    decompressPage(xhr.response, callback);
	  }
	  xhr.send(null);
	}
}

var stop_download = false;

function downloadDump(){

	fs.root.getFile(dumpname+'.lzma', {create:true, exclusive: false}, function(fileEntry){
		fileEntry.createWriter(function(fileWriter) {
  		//document.getElementById('status').innerHTML = '<b>Downloading</b> <a href="?'+accessibleTitle+'">'+accessibleTitle+'</a>';
			updateDownloadStatus();
			var ptr = fileWriter.length;
			if(ptr < dumpsize){
		    if(stop_download){
  				document.getElementById('download').style.display = '';
        	document.getElementById('status').innerHTML = '<b>Not Downloading</b>';
          return;
        }
			  var du = typeof dumpurl == 'function' ? dumpurl(ptr) : [dumpurl, ptr];
				requestChunk(du[0], du[1], function(buf){
				  //console.log("downloaded");
					fileWriter.seek(ptr);
					var bb = createBlobBuilder();
					bb.append(buf);
					var blob = bb.getBlob();
					fileWriter.write(blob);
					//console.log('writing');
					setTimeout(function(){
				    downloadDump();
					}, 100);
					updateAccessibleIndex();
					
				})
			}else{
				console.log('done downloading dump');
        can_download = false;
				document.getElementById('download').style.display = 'none';
			}
		})
	}, errorHandler);
}


function downloadIndex(){
	fs.root.getFile(dumpname+'.index', {create:true, exclusive: false}, function(fileEntry){
		fileEntry.createWriter(function(fileWriter) {
		  var ptr = fileWriter.length;
			if(ptr < indexsize){			
        if(stop_download){
  				document.getElementById('download').style.display = '';
        	document.getElementById('status').innerHTML = '<b>Not Downloading</b>';
          return;
        }
  			var du = typeof indexurl == 'function' ? indexurl(ptr) : [indexurl, ptr];
				requestChunk(du[0], du[1], function(buf){
					fileWriter.seek(ptr);
					var bb = createBlobBuilder();
					bb.append(buf);
					var blob = bb.getBlob();
					fileWriter.write(blob);
					setTimeout(function(){
				    downloadIndex();
					}, 100);
				})
			}else{
				console.log('done downloading index');
			}
		})
	}, errorHandler);
}

var chunksize = 1024 * 1024; //one megabyte
function requestChunk(url, pos, callback){
	document.getElementById('download').style.display = '';
  var chunkstart = +new Date;	
	var xhr = new XMLHttpRequest(); //resuse object
	//console.log('downloading ',url + "?"+Math.random(),'position',pos);
	xhr.open('GET', url+ "?"+Math.random(), true);
	xhr.setRequestHeader('Range', 'bytes='+pos+'-'+(pos+chunksize));

	xhr.responseType = 'arraybuffer';
	xhr.onerror = function(){
		//do something
		console.log("got error")
	}
	xhr.onload = function(){
	  //console.log(xhr.status, xhr);
	  var chunkend = +new Date;
	  var elapsed = (chunkend - chunkstart);
		if(xhr.status > 100 && xhr.status <= 400){
		  setTimeout(function(){
			  callback(xhr.response)
		  }, Math.max(0, 10000 - elapsed));
		}
	}
	xhr.send(null)
}


function nero(){
  fs.root.getFile(dumpname+'.index', {create: false}, function(fileEntry) {
    fileEntry.remove(function(){console.log("removed index file")})
  })
  fs.root.getFile(dumpname+'.lzma', {create: false}, function(fileEntry) {
    fileEntry.remove(function(){console.log("removed dump file")})
  })
}

function errorHandler(e) {
  var msg = '';

  switch (e.code) {
    case FileError.QUOTA_EXCEEDED_ERR:
      msg = 'QUOTA_EXCEEDED_ERR';
      break;
    case FileError.NOT_FOUND_ERR:
      msg = 'NOT_FOUND_ERR';
      break;
    case FileError.SECURITY_ERR:
      msg = 'SECURITY_ERR';
      break;
    case FileError.INVALID_MODIFICATION_ERR:
      msg = 'INVALID_MODIFICATION_ERR';
      break;
    case FileError.INVALID_STATE_ERR:
      msg = 'INVALID_STATE_ERR';
      break;
    case 42:
      msg = 'Maybe Quota Error';
      break;
    default:
      msg = 'Unknown Error';
      break;
  };

  console.log('Error: ' + msg);
  document.getElementById('download').style.display = '';
  document.getElementById('status').innerHTML = '<b>Error</b> '+msg;
  
  setTimeout(initialize, 1337);
}
