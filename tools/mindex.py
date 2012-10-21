import sys, libstrip, re, subprocess
action = 0
xtitle = ''
title = ''
ptr = 0
xartstart = 0
artstart = 0
xbody = ''
buff = ''
out = open('semega.lzma', 'w')
index = open('semega.index', 'w')

def compress(s):
  proc = subprocess.Popen(['lzma', '-f'], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
  return proc.communicate(s)[0]

import string
ALPHABET = string.ascii_uppercase + string.ascii_lowercase + \
           string.digits + '-_'
ALPHABET_REVERSE = dict((c, i) for (i, c) in enumerate(ALPHABET))
BASE = len(ALPHABET)
SIGN_CHARACTER = '$'

#http://stackoverflow.com/questions/561486/how-to-convert-an-integer-to-the-shortest-url-safe-string-in-python
def num_encode(n):
    s = []
    while True:
        n, r = divmod(n, BASE)
        s.append(ALPHABET[r])
        if n == 0: break
    return ''.join(reversed(s))


last0 = ''
last1 = ''
last2 = ''
last3 = ''
article = ''
header = ''
title = ''
for line in sys.stdin:
  last1, last2, last3, last4 = last0, last1, last2, last3
  last0 = line
  article += line
  if last0 == '\n' and last1 == '\n' and last2 == '\n' and last3.startswith('= '):
    new_header = last3 + last2 + last1 + last0
    m = re.match('\#REDIRECT.*\[\[([^\]]+)\]\]', article, re.I)
    if m is None:
      index.write(title + "|" + num_encode(out.tell()) + '\n')
      buff += header + libstrip.minify(article[:-len(new_header)])
      if len(buff) > 256 * 1024:
        print "Wrote buffer", len(buff)
        out.write(compress(buff))
        buff = ''
    else:
  		index.write(title + ">" + m.group(1) + "\n")
    title = last3[2:-3]
    header = new_header
    article = ''
