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

import sys
pointer = ''
buf = []
for line in sys.stdin:
  if line.startswith('$$$$'):
    pointer = int(line[4:-1])
    for i in buf:
      if ">" in i:
        print i
      else:
        print i + "|" + num_encode(pointer)
    buf = []
  else:
    buf.append(line[:-1])
