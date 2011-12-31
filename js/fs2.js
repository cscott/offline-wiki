/*
  What exactly is this?
  
  Well, first let's discuss what exactly offline-wiki needs to do
  in order to get a better picture of what hole this fills.
  
  Offline Wiki needs to work offline, that's a pretty big feature.
  I don't think that needs explanation, but I feel like giving an
  explanation anyway. Or maybe not. Okay, I changed my mind. Maybe
  I'll change my mind again if I think of a good excuse to waste
  your time like that.
  
  Offline Wiki runs in the browser, something which is usually online.
  This is actually part of the calling of the project, because browsers
  are exceedingly useless while offline, and this sort of brings a 
  vague semblance of utility to something which usually becomes useless.
  
  However, this prompts an interesting challenge, for Offline Wiki must
  maintain reasonable utility while online and offline. So then, a virtual
  filesystem with multiple supporting backends becomes useful.
  
  At least one layer of abstraction would make sense, since you can do
  a binary search on a networked file just as well as a local file. It
  would also be useful to treat the local file as a sort of cache, so 
  that all data which comes from the great fluffy panda in the sky is
  recorded for posterity.
  
  But then another layer of abstraction becomes useful because Firefox
  doesn't implement the FileSystem API, while Chrome's implementation of
  IndexedDB crashes (the entire browser!) when you try saving some typed
  arrays (I dont know specifics, I was too bored to investigate).
  
  This Virtual File API also uses a bitset to calculate download progress
  quickly. The bitset is really just a lightweight representation of whatever
  is saved. The only use of this is for the popcount function, which takes
  that bitset and counts the number of downloaded chunks in order to generate
  a purty progress bar.
  
  I guess that bitset may also be useful for calculating the 'most recently
  downloaded article', which is a cool feature that totally needs to be 
  implemented in the next version which employs this backend.
  
  Since compression algorithms require a definite start/finish which may not
  necessarily align with the chunk boundaries (which are absolutely arbitrary
  by the way), it needs a layer of abstraction above the readChunk method.
  
  This is the readBlock method. It returns a block which is a unit of data
  always less than the size of the chunk. Sometimes it needs to read two chunks
  in order to get the necessary amount of data. Maybe in the future, readBlock
  will be able to handle non-fixed sizes for blocks and maybe even blocks larger
  than the chunk.
  
  It calls readChunk once or twice in order to get the data and neatly trims
  and slices it until it is fit to be returned.
  
  So yeah, here you have it. Hybrid online/offline virtual files. I should totally
  rework this to be more object-orient-ish.
*/

function VirtualFile(name, size, chunksize, network){
  //var chunksize = 2 * 1024 //512 * 1024;
  //var blocksize = 1 * 1024 //200 * 1024; //blocksize must be < chunksize
  var defaultsize = 1024 * 1024 * 1024 + 1;
  var initialized = false;
  var file, fileEntry, db, sql;
  var persistent = false;
  var terminate = false;
  
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
    }else if(blob.mozSlice){
      return blob.mozSlice(start, start + length);
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
    }else if(window.MozBlobBuilder){
      return new MozBlobBuilder();
    }
  }

  function setbit(n){
    bitfield[~~(n/8)] = bitfield[~~(n/8)] | (1 << (n % 8));
    localStorage[name+'_bitset'] = b64(bitfield);
  }
  function getbit(n){
    return ((bitfield[~~(n/8)] & (1 << (n % 8))) >> (n % 8));
  }
  function checkbit(n){
    if(!getbit(n)){
      console.log("warning! inconsistency for bit ", n);
      setbit(n);
    }
  }
  var bits_in_char = new Uint8Array(256);
  for(var i = 0; i < 256; i++){
    bits_in_char[i] = i.toString(2).replace(/0/g, '').length;
  }

  function popcount(){
    for(var i = 0, s = 0; i < bitfield.length; i++) s += bits_in_char[bitfield[i]];
    return s;
  }
  var D = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/=";
  function b64(B){
    var s = '';
    for(var i = 0; i < B.length; i += 3){
      var a = B[i], b = B[i + 1], c = B[i + 2];
      s += D[a >> 2] + D[((a & 3) << 4) | (b >> 4)] + D[((b & 15) << 2) | (c >> 6)] + D[c & 63];
    }
    return s;
  }
  function d64(s){
    //beware: can not handle non-padded strings properly
    var B = new Uint8Array(Math.ceil(s.length/4 * 3));
    for(var i = 0, j = 0; i < s.length; i += 4, j += 3){
      var a = D.indexOf(s[i]), b = D.indexOf(s[i+1]), c = D.indexOf(s[i+2]), d = D.indexOf(s[i+3]);
      B[j] = (a << 2) | (b >> 4);
      B[j+1] = ((b & 15) << 4) | (c >> 2);
      B[j+2] = ((c & 3) << 6) | d;
    }
    return B
  }
  
  var chunks = Math.ceil(size/chunksize);
  var bitfield = new Uint8Array(Math.ceil(Math.ceil(chunks/8)/3)*3);
  var dec = d64("" + localStorage[name+'_bitset']);
  if(dec.length == bitfield.length){
    bitfield = dec;
  }else{
    console.log("warning! bitset invalid. building new one.", bitfield.length);
  }
  
  function checkBlock(position){
    var c = Math.floor(position / chunksize);
    return getbit(c);
  }
  
  function errorHandler(f){ 
    console.log(f);
  }
  var rfs = (window.requestFileSystem||window.webkitRequestFileSystem);
  var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
  if(rfs && window.webkitStorageInfo){
    persistent = true;
    webkitStorageInfo.requestQuota(webkitStorageInfo.PERSISTENT, defaultsize,
      function(grantedQuota){
        console.log("Granted quota:", grantedQuota)
        rfs(window.PERSISTENT, defaultsize, function(filesystem){
          filesystem.root.getFile(name+'_fs', {create:true, exclusive: false}, function(e){
            fileEntry = e;
            e.file(function(f){
              file = f;
              initialized = true;
            })
          }, errorHandler);
        }, errorHandler);
      }, 
      function(e){
        console.log("Quota Request error:", e)
      }); 
  }else if(indexedDB){
    /*
      I REALLY HAVE NO IDEA HOW TO DO THIS
      PLZ FIX
    */
    persistent = true;
    console.log('loading indexed db');
    if ('webkitIndexedDB' in window) {
      window.IDBTransaction = window.webkitIDBTransaction;
      window.IDBKeyRange = window.webkitIDBKeyRange;
    }
    var ver = 1;
    function tryConnecting(){
      var req = indexedDB.open(name+'_indexed', ver);
      console.log('trying to open version', ver, name);
      req.onsuccess = function(e){
        var d = req.result; 
        if(!d.objectStoreNames.contains('fs')){
          console.log('fs not in db', name)
          ver++;
          tryConnecting();
        }else{
          db = d;
          console.log('finally initialized', name);
          initialized = true;
        }
      }
      req.onerror = function(e){
        if(e.target.errorCode == IDBDatabaseException.VERSION_ERR){
          ver++;
          tryConnecting();
        }
        console.log('index db error', e.target.errorCode, name)
      }
      req.onupgradeneeded = function(e){
        var db = req.result;
        if(!db.objectStoreNames.contains('fs')){
          var store = db.createObjectStore('fs', {keyPath: 'chunk'});
        }
      }
    }
    tryConnecting()
  }else if(window.openDatabase){
    persistent = true;
    console.log('opening websql database');
    sql = openDatabase(name+'_sql', '1.0', 'Offline Wiki '+name, 20 * 1024 * 1024);
    console.log('got db');
    sql.transaction(function(tx){
      tx.executeSql('CREATE TABLE IF NOT EXISTS fs (chunk PRIMARY KEY, data)');
    }, SQLErrorHandler, function(){
      initialized = true;
    })
  }else {
    console.log("no persistant storage space!");
    initialized = true;
  }
  
  
  function SQLErrorHandler(e){
    console.log(e.message)
  }
  
  function readBlock(position, blocksize, callback){
    var result = new Uint8Array(blocksize);
    var delta = 0;
    position = Math.max(0, position);
    function readPart(){
      var chunk = Math.floor(position/chunksize);
      readChunk(chunk, function(ab){
        if(ab == false) return callback(false);
        var ta = new Uint8Array(ab);
        var offset = position % chunksize;
        var arr = ta.subarray(offset, offset + result.length - delta);
        result.set(arr, delta);
        delta += arr.length;
        position += arr.length;
        //console.log(offset, chunk, delta, arr.length, result.length, ab.length);
        if(delta < result.length){
          if(arr.length == 0){
            //callback(false);
            callback(result.buffer);
          }else{
            readPart()
          }
        }else{
          callback(result.buffer);
        }
      })
    }
    readPart();
  }
  
  function readText(position, blocksize, callback){
    readBlock(position, blocksize, textReader(callback))
  }
  
  function textReader(callback){
    return function(buffer){
      if(buffer == false){
        callback(false)
      }else if(window.FileReader){
        var bb = createBlobBuilder();
        bb.append(buffer);
        var fr = new FileReader();
        fr.onload = function(){
          callback(fr.result);
        }
        fr.onerror = function(e){
          console.debug("file read error");
          console.error(e)
        }
        fr.readAsText(bb.getBlob())
      }else{
        var arr = new Uint8Array(buffer);
        for(var i = 0, s = ''; i < arr.length; i++)
          s += String.fromCharCode(arr[i]);
        callback(decodeURIComponent(escape(s)));
      }
    }
  }
  
  function readChunkText(chunk, callback){
    readChunk(chunk, textReader(callback));
  }

  function readChunk(chunk, callback, redownload){
   /* if(!initialized) return setTimeout(function(){
      readChunk(chunk, callback, redownload);
    }, 100);*/
    chunk = Math.max(0, chunk);
    //console.log("reading chunk", chunk, name);
    readChunkPersistent(chunk, function(e){
      if(e == false || redownload){
        if(getbit(chunk)) console.log('inconsistency arghleflarg');
        downloadContiguousChunks(chunk, 2, function(e){
          //technically, this should work async, but firefox doesn't like it
          callback(e);
          //console.log('read from network store');
        });
      }else{
        //console.log("read from persistent store", name);
        checkbit(chunk);
        callback(e);
      }
    });
  }
  
  function downloadContiguousChunks(start, maximum, callback){
    var end = start + 1; //read minimum of one chunk
    if(start > chunks) return callback(false);
    while(!getbit(end) && (end - start) < maximum && end < chunks) end++;
    //console.log('reading', end-start,'chunks starting at',start);
    
    readChunksXHR(start, end - start, function(e){
      //console.log("read from XHR", name);
      if(e != false) writeChunksPersistent(start, e, callback);
    });
    
  }
  
  function readChunkPersistent(chunk, callback){
    if(terminate) return;
    if(fileEntry){
      readChunkFile(chunk, callback);
    }else if(db){
      readChunkDB(chunk, callback);
    }else if(sql){
      readChunkSql(chunk, callback);
    }else{
      callback(false); 
    }
  }
  
  function readChunkSql(chunk, callback){
    sql.readTransaction(function (t) {
      t.executeSql('SELECT data FROM fs WHERE chunk=?', [chunk], function (t, r) {
        //span.textContent = r.rows[0].c;
        if(r.rows.length == 0){
          callback(false);
        }else{
          var ta = d64(r.rows.item(0).data);
          //console.log('reading sql', ta.length);
          callback(ta.buffer);
        }
      }, function (t, e) {
        // couldn't read database
        console.log('(unknown: ' + e.message + ')');
      });
    });
  }
  
  
  function writeChunksPersistent(chunk, data, callback){
    if(terminate) return;
    if(fileEntry){
      writeChunksFile(chunk, data, callback);
    }else if(db || sql){
      writeChunksDB(chunk, data, callback);
    }else{
      callback(data, -1);
    }
  }
  
  function writeChunksDB(chunk, data, callback){
    /*var bb = createBlobBuilder();
    bb.append(data);
    var blob = bb.getBlob();
    function writeBlobDB(chunk, blob){
      var fr = new FileReader();
      fr.onload = function(){
        writeChunkDB(chunk, fr.result);
      }
      fr.readAsArrayBuffer(blob);
    }*/
    var fmt = new Uint8Array(data);
    /*for(var i = 0; i < data.byteLength; i += chunksize){
      var arr = new Uint8Array(chunksize);
      arr.set(fmt.subarray(i, i + chunksize), 0);
      //console.log(data.byteLength, arr.buffer.byteLength);
      writeChunkDB(chunk + i/chunksize, arr.buffer);
    }*/
    var i = 0;
    function iterate(){
      if(i < data.byteLength){
        var arr = new Uint8Array(chunksize);
        arr.set(fmt.subarray(i, i + chunksize), 0);
        writeChunkDB(chunk + i/chunksize, arr.buffer, iterate);
        i += chunksize;
      }else{
        callback(data)
      }
    }
    iterate();
  }
  
  
  
  function writeChunksFile(chunk, data, callback){
    fileEntry.createWriter(function(fileWriter) {    
      if(fileWriter.readyState != 0){
        console.debug("sopmething weird happened, readySTate not zero", fileWriter.readyState);
      }
      
      function writeData(){
        fileWriter.seek(chunksize * chunk);
        fileWriter.write(blob);
        fileWriter.onwrite = function(){
          //console.log(data.byteLength);
          for(var i = 0; i < data.byteLength; i += chunksize){
            setbit(chunk + i/chunksize);
            //console.log("wrote chunk", chunk + i/chunksize);
          }
          //console.log("wrote another chunk", popcount());
          callback(data);
        }
      }
      var bb = createBlobBuilder();
      bb.append(data);
      var blob = bb.getBlob();
      
      if(chunksize * chunk > fileWriter.length){
        fileWriter.truncate(chunksize * chunk);
        fileWriter.onwrite = function(){
          writeData();
        }
      }else writeData();
    })
  }
  
  function writeChunkDB(chunk, data, callback){
    if(db){
      writeChunkIndexedDB(chunk, data, callback);
    }else if(sql){
      writeChunkSql(chunk, data, callback);
    }
  }
  
  
  function writeChunkSql(chunk, data, callback){

    sql.transaction(function(tx){
      var arr = new Uint8Array(data);
      //console.log('writing sql', arr.length);
      tx.executeSql('INSERT OR REPLACE INTO fs VALUES (?, ?)', [chunk, b64(arr)]);
    }, SQLErrorHandler, function(){
      setbit(chunk);
      callback(data);
    })
  }
  
  function writeChunkIndexedDB(chunk, data, callback){
    var trans = db.transaction(['fs'], IDBTransaction.READ_WRITE);
    var store = trans.objectStore('fs');
    var req = store.put({
      data: data,
      chunk: chunk
    });
    req.onsuccess = function(){
      setbit(chunk);
      callback(data);
      //console.log('wrote another chunk (current count)', popcount());
    }
    req.onerror = function(e){
      console.log('write error', e);
    }
  }
  function readChunkFile(chunk, callback){
    var fr = new FileReader();
    fr.onload = function(){
      var t = new Uint8Array(fr.result);
      if(t[2] || t[3] || t[5] || t[7] || t[11] || t[13] || t[17]){
        callback(fr.result);
      }else callback(false);
    }
    fr.onerror = function(e){
      console.debug("file read error at read file chunk");
      console.error(e)
    }
    fr.readAsArrayBuffer(blobSlice(file, chunksize * chunk, chunksize));
  }

  function readChunkDB(chunk, callback){
    var trans = db.transaction(['fs'], IDBTransaction.READ_ONLY);
    var store = trans.objectStore('fs');
    var keyRange = IDBKeyRange.only(chunk);
    var cursorRequest = store.openCursor(keyRange);
    cursorRequest.onsuccess = function(e){
      var result = e.target.result;
      if(!!result == false) return callback(false);
      //console.log(result);
      callback(result.value.data);
    }
  }
  
  function readChunkXHR(chunk, callback){
    readChunksXHR(chunk, chunksize, callback);
  }
  
  function readChunksXHR(chunk, size, callback){
    //return callback(false); //simulate offline
    var xhr = new XMLHttpRequest();
    var url = network(chunk * chunksize);
    xhr.open('GET', url[0], true);
    xhr.setRequestHeader('Range', 'bytes='+url[1]+'-'+(url[1] + chunksize*size - 1));
    xhr.responseType = 'arraybuffer';
    xhr.onload = function(){
      //console.log("xhr done woot"+xhr.response);
      if(terminate) return;
      if(xhr.status >= 200 && xhr.status < 300 && xhr.readyState == 4){
        callback(xhr.response);
      }else{
        callback(false);
      }
    }
    xhr.onerror = function(){
      callback(false);
    }
    xhr.send(null);
  }
  
  function reset(){
    if(db){
      resetDB(); 
    }else if(fileEntry){
      resetFile();
    }else if(sql){
      resetSql();
    }
    localStorage[name+'_bitset'] = '';
    initialized = false;
  }
  
  function resetFile(){
    fileEntry.remove(function(){
      console.log("removed file")
    })
  }
  
  function resetDB(){
    
    console.log('could not delete database', name);
  }
  
  function resetSql(){
    sql.transaction(function(tx){
      tx.executeSql('DROP TABLE fs');
    }, SQLErrorHandler, function(){
      console.log('successfully terminated websql');
    })
  }
  return {
    readBlock: readBlock,
    readText: readText,
    readChunkText: readChunkText,
    popcount: popcount,
    checkBlock: checkBlock,
    checkChunk: getbit,
    getChunksize: function(){
      return chunksize;
    },
    getChunks: function(){
      return chunks;
    },
    progress: function(){
      return popcount() / chunks;
    },
    persistent: persistent,
    downloadContiguousChunks: downloadContiguousChunks,
    readChunk: readChunk,
    terminate: function(){
      terminate = true
    },
    db: function(){return (db || fileEntry || sql)},
    reset: reset
  };
}


var can_download = true;
var concurrencyKey = +new Date;
var downloading_dump = false, downloading_index = false;

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

var index, dump;
var indexsize, dumpsize, indexurl, dumpurl;
/*
function indexsize(){
  return 7924566;
}
function dumpsize(){
  return 1025405491;
}
function indexurl(ptr){
  return ['/Downloads/split2/pi.index', ptr];
}
function dumpurl(ptr){
  var CHUNK_SIZE = 100000000;
  return ['/Downloads/split2/splitpi/pi_' +
  'aa,ab,ac,ad,ae,af,ag,ah,ai,aj,ak'.split(',')[Math.floor(ptr / CHUNK_SIZE)],
    ptr % CHUNK_SIZE];
}*/


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

var index = null, dump = null;

function switch_dump(name, dft){
  if(!dumps[name] && dft){name = dft}
  if((location.host=='localhost' || /\.local/.test(location.host)) && !/local_/.test(name)) name = 'local_'+name;
  document.getElementById('dump').value = name.replace('local_','');
  var d = dumps[name];
  //dumpname = name;
  localStorage.dumpname = name;
  
  if(index) index.terminate();
  if(dump) dump.terminate();
  
  indexsize = function(){return d.indexsize};
  dumpsize = function(){return d.dumpsize};
  indexurl = typeof d.indexurl == 'function' ? d.indexurl : function(p){return [d.indexurl, p]};
  dumpurl = typeof d.dumpurl == 'function' ? d.dumpurl : function(p){return [d.dumpurl, p]};

  index_progress = 0;
  dump_progress = 0;

  index = VirtualFile(name+'_index', indexsize(), 1024 * 4, indexurl); //4KiB chunk size
  dump = VirtualFile(name+'_dump', dumpsize(), 1024 * 500, dumpurl); //500KB chunk size (note, that it has to be a multiple of the underlying file subdivision size

  console.log("initialized fs "+name);
  setTimeout(updateProgress, 10);
  setTimeout(beginDownload, 1337);
}
switch_dump(localStorage.dumpname, 'leet');





var index_progress = 0, dump_progress = 0;
function beginDownload(){
  updateProgress();
  if(!downloading_dump) downloadDump();
  if(!downloading_index) downloadIndex();
}


function updateProgress(){
  var progress = (dump.progress() * dumpsize() + index.progress() * indexsize())/(dumpsize() + indexsize());
  if(progress < 1 && dump.persistent && index.persistent){
    updatePreview();
    document.getElementById('download').style.display = '';
    document.getElementById('progress').value = progress;
    document.getElementById('download').title = (100 * progress).toFixed(5)+"%";
    document.getElementById('status').innerHTML = '<b>Downloading</b> <a href="?'+lastPreview.title+'">'+lastPreview.title+'</a>';
  }else{
    document.getElementById('download').style.display = 'none';
  }
}

var lastPreview = {chunk: -999, entries: [], title: '', lastTime: 0};
function updatePreview(){
  var chunk = dump.progress() * index.getChunks() * 0.92195; //0.92195 is the sqrt(.85), and I won't tell you how it's significant
  var shiftconst = Math.pow(3.16, 2);
  
  if(chunk - lastPreview.chunk > shiftconst){
    index.readChunkText(Math.floor(chunk), function(e){
      lastPreview.entries = e.split('\n').slice(1, -1).map(function(e){return e.split(/>|\|/)[0]});
      lastPreview.chunk = Math.floor(chunk);
      updateProgress();
    })
  }else{
    if(new Date - lastPreview.lastTime > 2718){
      lastPreview.title = lastPreview.entries[Math.floor(lastPreview.entries.length * (chunk - lastPreview.chunk) / shiftconst)] || '';
      lastPreview.lastTime = +new Date;
    }
  }
}

var stop_download = false;

function downloadDump(){
  if(stop_download) return;
  downloading_dump = false;
  if(!dump.persistent) return console.log("no persistent store");
  while(dump.checkChunk(dump_progress)) dump_progress++;
  if(dump_progress >= dump.getChunks()) return;
  dump.downloadContiguousChunks(dump_progress, Math.floor((1024 * 1024 * 2)/ dump.getChunksize()), function(){
    updateProgress();
    downloading_dump = true;
    setTimeout(downloadDump, 200);
  });
}

var lastTitleChange = 0;

function downloadIndex(){
  if(stop_download) return;
  downloading_index = false;
  if(!index.persistent) return console.log("no persistent store");
  while(index.checkChunk(index_progress)) index_progress++;
  if(index_progress >= index.getChunks()) return;
  //index.readChunk(index_progress, function(){
  index.downloadContiguousChunks(index_progress, Math.floor((1024 * 1024 * 1)/ index.getChunksize()), function(e, fail){
    if(fail == -1) return;
    updateProgress();
    downloading_index = true;  
    setTimeout(downloadIndex, 200);
  })
  //});
}


function nero(){
  index.reset();
  dump.reset();
}
